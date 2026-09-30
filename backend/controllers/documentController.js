import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { PROCESSABLE_STATUSES } from '../config/constants.js';
import { getConfig } from '../config/env.js';
import { getStore } from '../models/store.js';
import { recordAudit } from '../services/audit/auditService.js';
import { validateUploadedFile } from '../services/ingestion/fileValidation.js';
import { processDocument } from '../services/pipeline/processDocument.js';
import { readBytes, removeBytes, saveBytes } from '../services/storage/fileStore.js';
import { AppError } from '../utils/errors.js';
import { toPublicDocument } from '../utils/files.js';
import { logError } from '../utils/logger.js';
import { sendSuccess } from '../utils/response.js';

async function ownedDocument(id, userId) {
  const document = await getStore().getDocument(id);
  if (!document) {
    throw new AppError('INGESTION_ERROR', 'Document not found', { status: 404, stage: 'ingestion' });
  }
  if (document.userId !== userId) {
    throw new AppError('AUTHORIZATION_ERROR', 'You cannot access this document', {
      status: 403,
      stage: 'authorization',
    });
  }
  return document;
}

export async function uploadDocument(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('FILE_VALIDATION_ERROR', 'A file is required', {
        status: 400,
        stage: 'ingestion',
        recoverable: false,
      });
    }

    const validated = await validateUploadedFile({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    });

    const id = crypto.randomUUID();
    const storagePath = await saveBytes(
      `documents/${id}${validated.extension}`,
      req.file.buffer,
      validated.mimeType,
    );

    const now = new Date().toISOString();
    try {
      const document = await getStore().createDocument({
        id,
        userId: req.user.sub,
        originalName: validated.originalName,
        mimeType: validated.mimeType,
        sizeBytes: validated.sizeBytes,
        storagePath,
        status: 'QUEUED',
        pageCount: validated.pageCount,
        width: validated.width,
        height: validated.height,
        documentType: null,
        extractedPayload: null,
        errorCode: null,
        errorMessage: null,
        errorStage: null,
        errorDetails: [],
        recoverable: null,
        createdAt: now,
        updatedAt: now,
      });
      await getStore().replacePages(id, [{
        id: crypto.randomUUID(),
        documentId: id,
        pageNumber: 1,
        width: validated.width,
        height: validated.height,
        imagePath: validated.mimeType === 'application/pdf' ? null : storagePath,
      }]);
      await recordAudit({
        documentId: id,
        userId: req.user.sub,
        action: 'DOCUMENT_UPLOADED',
        stage: 'ingestion',
        status: 'QUEUED',
        metadata: { mimeType: validated.mimeType, sizeBytes: validated.sizeBytes, pageCount: validated.pageCount },
      });
      sendSuccess(res, { document: toPublicDocument(document) }, 'Document uploaded successfully', 201);
    } catch (error) {
      await removeBytes(storagePath);
      throw error;
    }
  } catch (error) {
    next(error);
  }
}

export async function listDocuments(req, res, next) {
  try {
    const documents = await getStore().listDocuments(req.user.sub);
    sendSuccess(res, { documents: documents.map(toPublicDocument) });
  } catch (error) {
    next(error);
  }
}

export async function getDocument(req, res, next) {
  try {
    const document = await ownedDocument(req.params.id, req.user.sub);
    const pages = await getStore().listPages(document.id);
    sendSuccess(res, {
      document: toPublicDocument(document),
      pages: pages.map((page) => ({
        pageNumber: page.pageNumber,
        width: page.width,
        height: page.height,
        hasImage: Boolean(page.imagePath),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteDocument(req, res, next) {
  try {
    const document = await ownedDocument(req.params.id, req.user.sub);
    const pages = await getStore().listPages(document.id);
    await getStore().deleteDocument(document.id);
    await removeBytes(document.storagePath);
    for (const page of pages) {
      if (page.imagePath && page.imagePath !== document.storagePath) {
        await removeBytes(page.imagePath);
      }
    }
    await fs.rm(path.join(getConfig().uploadDir, 'pages', document.id), { recursive: true, force: true });
    sendSuccess(res, {}, 'Document deleted successfully');
  } catch (error) {
    next(error);
  }
}

export async function startProcessing(req, res, next) {
  try {
    const document = await ownedDocument(req.params.id, req.user.sub);
    if (!PROCESSABLE_STATUSES.includes(document.status)) {
      throw new AppError('INGESTION_ERROR', `This document cannot be processed while it is ${document.status}`, {
        status: 409,
        stage: 'ingestion',
        recoverable: true,
      });
    }

    const pending = processDocument(document.id, req.user.sub);
    if (process.env.SYNC_PROCESSING === 'true') {
      const updated = await pending;
      sendSuccess(res, { document: toPublicDocument(updated) }, 'Processing completed successfully');
      return;
    }

    pending.catch((error) => logError(error));
    const fresh = await getStore().getDocument(document.id);
    sendSuccess(res, { document: toPublicDocument(fresh) }, 'Processing started', 202);
  } catch (error) {
    next(error);
  }
}

export async function getStatus(req, res, next) {
  try {
    const document = await ownedDocument(req.params.id, req.user.sub);
    sendSuccess(res, { document: toPublicDocument(document) });
  } catch (error) {
    next(error);
  }
}

export async function getOcr(req, res, next) {
  try {
    const document = await ownedDocument(req.params.id, req.user.sub);
    const results = await getStore().getOcrResults(document.id);
    const blocks = await getStore().getLayoutBlocks(document.id);
    sendSuccess(res, {
      pages: results.map((result) => ({
        page: result.page,
        text: result.text,
        confidence: result.confidenceAvailable ? result.confidence : null,
        confidenceAvailable: result.confidenceAvailable,
      })),
      blocks: blocks.map((block) => ({
        page: block.page,
        blockType: block.blockType,
        text: block.text,
        bbox: block.bbox,
        confidence: block.confidenceAvailable ? block.confidence : null,
        confidenceAvailable: block.confidenceAvailable,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function getExtraction(req, res, next) {
  try {
    const document = await ownedDocument(req.params.id, req.user.sub);
    const fields = await getStore().getFields(document.id);
    sendSuccess(res, {
      documentType: document.documentType,
      payload: document.extractedPayload,
      fields: fields.map(publicField),
    });
  } catch (error) {
    next(error);
  }
}

export async function getValidation(req, res, next) {
  try {
    const document = await ownedDocument(req.params.id, req.user.sub);
    const results = await getStore().getValidationResults(document.id);
    sendSuccess(res, { results });
  } catch (error) {
    next(error);
  }
}

export async function getPageImage(req, res, next) {
  try {
    const document = await ownedDocument(req.params.id, req.user.sub);
    const pageNumber = Number(req.params.pageNumber);
    const pages = await getStore().listPages(document.id);
    const page = pages.find((item) => item.pageNumber === pageNumber);
    if (!page?.imagePath) {
      throw new AppError('INGESTION_ERROR', 'No page image is available', {
        status: 404,
        stage: 'ingestion',
      });
    }
    const bytes = await readBytes(page.imagePath);
    res.setHeader('Content-Type', 'image/png');
    res.send(bytes);
  } catch (error) {
    next(error);
  }
}

export async function downloadOriginal(req, res, next) {
  try {
    const document = await ownedDocument(req.params.id, req.user.sub);
    const bytes = await readBytes(document.storagePath);
    const filename = document.originalName.replace(/["\r\n]/g, '');
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(bytes);
  } catch (error) {
    next(error);
  }
}

function publicField(field) {
  return {
    field: field.fieldName,
    value: field.value,
    suggestedValue: field.suggestedValue,
    grounded: field.grounded,
    confidence: field.confidenceAvailable ? field.confidence : null,
    confidenceAvailable: field.confidenceAvailable,
    sourcePage: field.sourcePage,
    sourceText: field.sourceText,
    validationStatus: field.validationStatus,
  };
}
