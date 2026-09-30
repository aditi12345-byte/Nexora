import crypto from 'crypto';
import { PROCESSABLE_STATUSES } from '../../config/constants.js';
import { getStore } from '../../models/store.js';
import { AppError, toAppError } from '../../utils/errors.js';
import { recordAudit } from '../audit/auditService.js';
import { assembleExtraction } from '../extraction/assemble.js';
import { extractWithGemini } from '../extraction/geminiExtractor.js';
import { layoutFromOcr } from '../layout/layoutService.js';
import { recognizeImage, textLayerResult } from '../ocr/ocrService.js';
import { preprocessDocument } from '../preprocessing/preprocess.js';
import { readBytes, saveBytes } from '../storage/fileStore.js';
import { needsHumanReview } from '../validation/confidence.js';
import { validateExtraction } from '../validation/schemaValidation.js';

const locks = new Set();

async function setStatus(id, status, extra = {}) {
  return getStore().updateDocument(id, {
    status,
    updatedAt: new Date().toISOString(),
    ...extra,
  });
}

export async function processDocument(documentId, userId, deps = {}) {
  if (locks.has(documentId)) {
    throw new AppError('INGESTION_ERROR', 'This document is already processing', {
      status: 409,
      stage: 'ingestion',
      recoverable: true,
    });
  }
  locks.add(documentId);

  const store = getStore();
  const recognize = deps.recognize || recognizeImage;
  const extract = deps.extract || extractWithGemini;

  try {
    const doc = await store.getDocument(documentId);
    if (!doc) {
      throw new AppError('INGESTION_ERROR', 'Document not found', { status: 404, stage: 'ingestion' });
    }
    if (doc.userId !== userId) {
      throw new AppError('AUTHORIZATION_ERROR', 'You cannot process this document', {
        status: 403,
        stage: 'authorization',
      });
    }
    if (!PROCESSABLE_STATUSES.includes(doc.status) && doc.status !== 'PREPROCESSING') {
      throw new AppError('INGESTION_ERROR', `This document cannot be processed while it is ${doc.status}`, {
        status: 409,
        stage: 'ingestion',
        recoverable: true,
      });
    }

    await recordAudit({
      documentId,
      userId,
      action: 'PROCESSING_STARTED',
      stage: 'pipeline',
      status: 'PREPROCESSING',
    });

    const buffer = await readBytes(doc.storagePath);
    await setStatus(documentId, 'PREPROCESSING', {
      errorCode: null,
      errorMessage: null,
      errorStage: null,
      errorDetails: [],
      recoverable: null,
    });

    const prepared = await preprocessDocument(buffer, doc.mimeType);

    const pageRows = [];
    for (const page of prepared.pages) {
      let imagePath = null;
      if (page.pngBuffer) {
        imagePath = await saveBytes(`pages/${documentId}/${page.page}.png`, page.pngBuffer, 'image/png');
      }
      pageRows.push({
        id: crypto.randomUUID(),
        documentId,
        pageNumber: page.page,
        width: page.width,
        height: page.height,
        imagePath,
      });
    }
    await store.replacePages(documentId, pageRows);
    await setStatus(documentId, 'OCR_PROCESSING', {
      pageCount: prepared.pages.length,
      width: pageRows[0]?.width || doc.width,
      height: pageRows[0]?.height || doc.height,
    });

    const ocrPages = [];
    for (const page of prepared.pages) {
      let ocr;
      if (page.pngBuffer) {
        ocr = await recognize(page.pngBuffer);
      } else if (page.textLayer) {
        ocr = textLayerResult(page.textLayer);
      } else {
        throw new AppError('OCR_ERROR', 'No image or text was available for OCR', {
          status: 422,
          stage: 'ocr',
          recoverable: true,
        });
      }
      ocrPages.push({ page: page.page, ...ocr });
    }

    const now = new Date().toISOString();
    await store.replaceOcrResults(documentId, ocrPages.map((page) => ({
      id: crypto.randomUUID(),
      documentId,
      page: page.page,
      text: page.text,
      confidence: page.confidenceAvailable ? page.confidence : null,
      confidenceAvailable: page.confidenceAvailable,
      blocks: page.blocks || [],
      createdAt: now,
    })));
    await store.replaceLayoutBlocks(documentId, layoutFromOcr(documentId, ocrPages));
    await recordAudit({
      documentId,
      userId,
      action: 'OCR_COMPLETED',
      stage: 'ocr',
      status: 'OCR_PROCESSING',
      metadata: { pages: ocrPages.length },
    });

    await setStatus(documentId, 'EXTRACTING');
    const modelJson = await extract({ filename: doc.originalName, ocrPages });
    await recordAudit({
      documentId,
      userId,
      action: 'EXTRACTION_COMPLETED',
      stage: 'extraction',
      status: 'EXTRACTING',
      metadata: { documentType: modelJson.documentType || null, ocrTruncated: Boolean(modelJson.ocrTruncated) },
    });

    await setStatus(documentId, 'VALIDATING_DATA');
    const assembled = assembleExtraction(modelJson, ocrPages);
    const validation = validateExtraction(assembled.schemaInput);
    await store.addValidationResult({
      id: crypto.randomUUID(),
      documentId,
      schemaName: validation.schemaName,
      passed: validation.passed,
      errors: validation.errors,
      createdAt: new Date().toISOString(),
    });
    await recordAudit({
      documentId,
      userId,
      action: 'SCHEMA_VALIDATION_COMPLETED',
      stage: 'validation',
      status: validation.passed ? 'VALIDATING_DATA' : 'FAILED',
      metadata: { schemaName: validation.schemaName, errorCount: validation.errors.length },
    });

    if (!validation.passed) {
      throw new AppError('SCHEMA_VALIDATION_ERROR', 'Extracted data did not match the document schema', {
        status: 422,
        stage: 'validation',
        recoverable: true,
        details: validation.errors,
      });
    }

    const fieldRows = assembled.fields.map((field) => ({
      id: crypto.randomUUID(),
      documentId,
      fieldName: field.fieldName,
      value: field.fieldName === 'items' ? validation.data.items : field.value,
      suggestedValue: field.suggestedValue ?? null,
      grounded: field.grounded,
      confidence: field.confidenceAvailable ? field.confidence : null,
      confidenceAvailable: field.confidenceAvailable,
      sourcePage: field.sourcePage,
      sourceText: field.sourceText,
      validationStatus: field.validationStatus,
      createdAt: new Date().toISOString(),
    }));
    const tableRows = assembled.tables.map((table) => ({
      id: crypto.randomUUID(),
      documentId,
      tableId: table.tableId,
      page: table.page,
      columns: table.columns,
      rows: table.rows,
      reviewRequired: table.reviewRequired,
      sourceNote: table.sourceNote,
      createdAt: new Date().toISOString(),
    }));

    await store.replaceFields(documentId, fieldRows);
    await store.replaceTables(documentId, tableRows);

    const reviewTasks = [];
    for (const field of fieldRows) {
      if (!needsHumanReview(field.validationStatus)) continue;
      reviewTasks.push(reviewTaskFrom(doc, field, field.validationStatus));
    }
    for (const table of tableRows) {
      if (!table.reviewRequired) continue;
      reviewTasks.push({
        id: crypto.randomUUID(),
        documentId,
        userId: doc.userId,
        fieldName: `table:${table.tableId}`,
        value: { tableId: table.tableId, page: table.page, columns: table.columns, rows: table.rows },
        suggestedValue: null,
        grounded: true,
        confidence: null,
        confidenceAvailable: false,
        sourcePage: table.page,
        sourceText: table.sourceNote,
        validationStatus: 'REVIEW_REQUIRED',
        status: 'OPEN',
        correction: null,
        reviewerId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    await store.replaceReviewTasks(documentId, reviewTasks);

    const payload = validation.data;
    if (reviewTasks.length) {
      await setStatus(documentId, 'REVIEW_REQUIRED', {
        documentType: payload.documentType,
        extractedPayload: payload,
        errorCode: null,
        errorMessage: null,
        errorStage: null,
        errorDetails: [],
        recoverable: true,
      });
      await recordAudit({
        documentId,
        userId,
        action: 'REVIEW_REQUESTED',
        stage: 'review',
        status: 'REVIEW_REQUIRED',
        metadata: { tasks: reviewTasks.length },
      });
    } else {
      await setStatus(documentId, 'COMPLETED', {
        documentType: payload.documentType,
        extractedPayload: payload,
        errorCode: null,
        errorMessage: null,
        errorStage: null,
        errorDetails: [],
        recoverable: null,
      });
      await recordAudit({
        documentId,
        userId,
        action: 'DOCUMENT_APPROVED',
        stage: 'validation',
        status: 'COMPLETED',
      });
    }

    await recordAudit({
      documentId,
      userId,
      action: 'VALIDATION_COMPLETED',
      stage: 'validation',
      status: reviewTasks.length ? 'REVIEW_REQUIRED' : 'COMPLETED',
    });

    return store.getDocument(documentId);
  } catch (error) {
    const appError = toAppError(error);
    try {
      await setStatus(documentId, 'FAILED', {
        errorCode: appError.code,
        errorMessage: appError.message,
        errorStage: appError.stage,
        errorDetails: appError.details,
        recoverable: appError.recoverable,
      });
      await recordAudit({
        documentId,
        userId,
        action: 'PROCESSING_FAILED',
        stage: appError.stage || 'pipeline',
        status: 'FAILED',
        metadata: { errorCode: appError.code },
      });
    } catch (storeError) {
      console.error({ code: 'DATABASE_ERROR', message: storeError.message });
    }
    throw appError;
  } finally {
    locks.delete(documentId);
  }
}

function reviewTaskFrom(doc, field, validationStatus) {
  return {
    id: crypto.randomUUID(),
    documentId: doc.id,
    userId: doc.userId,
    fieldName: field.fieldName,
    value: field.value,
    suggestedValue: field.suggestedValue,
    grounded: field.grounded,
    confidence: field.confidence,
    confidenceAvailable: field.confidenceAvailable,
    sourcePage: field.sourcePage,
    sourceText: field.sourceText,
    validationStatus,
    status: 'OPEN',
    correction: null,
    reviewerId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
