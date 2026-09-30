import { getStore } from '../../models/store.js';
import { AppError } from '../../utils/errors.js';
import { recordAudit } from '../audit/auditService.js';
import { normalizeByKind } from '../extraction/normalize.js';
import { validateExtraction } from '../validation/schemaValidation.js';
import { FIELD_KINDS } from '../../config/constants.js';
import { tableSchema } from '../validation/schemaValidation.js';
import { z } from 'zod';

function ownedTask(task, userId) {
  if (!task) {
    throw new AppError('INGESTION_ERROR', 'Review task not found', { status: 404, stage: 'review' });
  }
  if (task.userId !== userId) {
    throw new AppError('AUTHORIZATION_ERROR', 'You cannot review this task', {
      status: 403,
      stage: 'authorization',
    });
  }
  return task;
}

function kindFor(documentType, fieldName) {
  return FIELD_KINDS[documentType]?.[fieldName] || 'string';
}

function normalizeCorrection(documentType, fieldName, value) {
  if (fieldName === 'items') {
    const parsed = z.array(z.object({
      description: z.string().min(1).max(500).nullable(),
      quantity: z.number().finite().nullable(),
      unitPrice: z.number().finite().nullable(),
      amount: z.number().finite().nullable(),
    }).strict()).safeParse(value);
    if (!parsed.success) {
      throw new AppError('SCHEMA_VALIDATION_ERROR', 'Corrected line items are invalid', {
        status: 422,
        stage: 'review',
        recoverable: true,
        details: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      });
    }
    return parsed.data;
  }

  if (fieldName.startsWith('table:')) {
    const parsed = tableSchema.safeParse(value);
    if (!parsed.success) {
      throw new AppError('SCHEMA_VALIDATION_ERROR', 'Corrected table is invalid', {
        status: 422,
        stage: 'review',
        recoverable: true,
        details: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      });
    }
    return parsed.data;
  }

  if (fieldName.startsWith('entity.')) {
    const parsed = z.string().min(1).max(500).safeParse(value);
    if (!parsed.success) {
      throw new AppError('SCHEMA_VALIDATION_ERROR', 'Corrected entity is invalid', {
        status: 422,
        stage: 'review',
        recoverable: true,
        details: [{ path: fieldName, message: 'Entity value must be text' }],
      });
    }
    return parsed.data;
  }

  const normalized = normalizeByKind(kindFor(documentType, fieldName), value);
  if (!normalized.ok) {
    throw new AppError('SCHEMA_VALIDATION_ERROR', normalized.error, {
      status: 422,
      stage: 'review',
      recoverable: true,
      details: [{ path: fieldName, message: normalized.error }],
    });
  }
  return normalized.value;
}

function applyPayload(payload, fieldName, value) {
  const next = structuredClone(payload);
  if (fieldName === 'items') next.items = value;
  else if (fieldName.startsWith('entity.')) {
    const [, type, indexText] = fieldName.split('.');
    const index = Number(indexText);
    if (!next.entities[index]) {
      throw new AppError('SCHEMA_VALIDATION_ERROR', 'Entity could not be updated', {
        status: 422,
        stage: 'review',
        recoverable: true,
      });
    }
    next.entities[index] = { ...next.entities[index], type: next.entities[index].type || type, value };
  } else if (fieldName.startsWith('table:')) {
    const tableId = fieldName.slice('table:'.length);
    const tables = Array.isArray(next.tables) ? [...next.tables] : [];
    const index = tables.findIndex((table) => table.tableId === tableId || table.tableId === value.tableId);
    if (index >= 0) tables[index] = value;
    else tables.push(value);
    next.tables = tables;
  } else {
    next.fields[fieldName] = value;
  }
  return next;
}

async function finishIfDone(document, userId) {
  const store = getStore();
  const tasks = await store.listReviewTasks({ documentId: document.id });
  if (tasks.some((task) => task.status === 'OPEN')) return store.getDocument(document.id);

  const validation = validateExtraction(document.extractedPayload);
  await store.addValidationResult({
    id: cryptoRandom(),
    documentId: document.id,
    schemaName: validation.schemaName,
    passed: validation.passed,
    errors: validation.errors,
    createdAt: new Date().toISOString(),
  });

  if (!validation.passed) {
    return store.updateDocument(document.id, {
      status: 'REVIEW_REQUIRED',
      errorCode: 'SCHEMA_VALIDATION_ERROR',
      errorMessage: 'Approved data still fails schema validation',
      errorStage: 'review',
      errorDetails: validation.errors,
      recoverable: true,
      updatedAt: new Date().toISOString(),
    });
  }

  await recordAudit({
    documentId: document.id,
    userId,
    action: 'DOCUMENT_APPROVED',
    stage: 'review',
    status: 'COMPLETED',
  });
  return store.updateDocument(document.id, {
    status: 'COMPLETED',
    extractedPayload: validation.data,
    errorCode: null,
    errorMessage: null,
    errorStage: null,
    errorDetails: [],
    recoverable: null,
    updatedAt: new Date().toISOString(),
  });
}

function cryptoRandom() {
  return globalThis.crypto.randomUUID();
}

export async function updateReviewDraft(taskId, userId, value) {
  const store = getStore();
  const task = ownedTask(await store.getReviewTask(taskId), userId);
  if (task.status !== 'OPEN') {
    throw new AppError('INGESTION_ERROR', 'This review task is already closed', {
      status: 409,
      stage: 'review',
      recoverable: false,
    });
  }
  return store.updateReviewTask(taskId, {
    correction: value,
    updatedAt: new Date().toISOString(),
  });
}

export async function approveReview(taskId, userId, value) {
  const store = getStore();
  const task = ownedTask(await store.getReviewTask(taskId), userId);
  if (task.status !== 'OPEN') {
    throw new AppError('INGESTION_ERROR', 'This review task is already closed', {
      status: 409,
      stage: 'review',
      recoverable: false,
    });
  }
  const document = await store.getDocument(task.documentId);
  const submitted = value !== undefined ? value : (task.correction !== null && task.correction !== undefined ? task.correction : task.value);
  const normalized = normalizeCorrection(document.documentType || 'generic', task.fieldName, submitted);
  const nextPayload = applyPayload(document.extractedPayload || {
    documentType: document.documentType || 'generic',
    fields: {},
    items: [],
    entities: [],
    tables: [],
  }, task.fieldName, normalized);
  const validation = validateExtraction(nextPayload);
  if (!validation.passed) {
    throw new AppError('SCHEMA_VALIDATION_ERROR', 'Corrected data did not pass schema validation', {
      status: 422,
      stage: 'review',
      recoverable: true,
      details: validation.errors,
    });
  }

  if (task.fieldName.startsWith('table:')) {
    const tableId = task.fieldName.slice('table:'.length);
    await store.updateTable(document.id, tableId, {
      columns: normalized.columns,
      rows: normalized.rows,
      page: normalized.page,
      reviewRequired: false,
      sourceNote: 'Approved by reviewer',
    });
  } else {
    await store.updateField(document.id, task.fieldName, {
      value: normalized,
      validationStatus: 'APPROVED',
      suggestedValue: null,
    });
  }

  const updatedTask = await store.updateReviewTask(taskId, {
    status: 'APPROVED',
    correction: normalized,
    validationStatus: 'APPROVED',
    reviewerId: userId,
    updatedAt: new Date().toISOString(),
  });
  const updatedDocument = await store.updateDocument(document.id, {
    extractedPayload: validation.data,
    updatedAt: new Date().toISOString(),
  });
  await recordAudit({
    documentId: document.id,
    userId,
    action: 'REVIEW_COMPLETED',
    stage: 'review',
    status: 'APPROVED',
    metadata: { field: task.fieldName },
  });
  const finalDocument = await finishIfDone(updatedDocument, userId);
  return { task: updatedTask, document: finalDocument };
}

export async function rejectReview(taskId, userId) {
  const store = getStore();
  const task = ownedTask(await store.getReviewTask(taskId), userId);
  if (task.status !== 'OPEN') {
    throw new AppError('INGESTION_ERROR', 'This review task is already closed', {
      status: 409,
      stage: 'review',
      recoverable: false,
    });
  }
  const document = await store.getDocument(task.documentId);
  const cleared = task.fieldName.startsWith('table:') || task.fieldName === 'items' ? null : null;
  if (task.fieldName.startsWith('table:')) {
    const tableId = task.fieldName.slice('table:'.length);
    await store.updateTable(document.id, tableId, {
      columns: [],
      rows: [],
      reviewRequired: false,
      sourceNote: 'Rejected by reviewer',
    });
    const payload = structuredClone(document.extractedPayload || {});
    payload.tables = (payload.tables || []).filter((table) => table.tableId !== tableId);
    document.extractedPayload = payload;
  } else if (task.fieldName === 'items') {
    await store.updateField(document.id, task.fieldName, { value: [], validationStatus: 'REJECTED' });
    document.extractedPayload = { ...document.extractedPayload, items: [] };
  } else if (task.fieldName.startsWith('entity.')) {
    const index = Number(task.fieldName.split('.')[2]);
    const payload = structuredClone(document.extractedPayload || { entities: [] });
    if (payload.entities[index]) payload.entities.splice(index, 1);
    await store.updateField(document.id, task.fieldName, { value: null, validationStatus: 'REJECTED' });
    document.extractedPayload = payload;
  } else {
    await store.updateField(document.id, task.fieldName, { value: cleared, validationStatus: 'REJECTED' });
    document.extractedPayload = applyPayload(document.extractedPayload, task.fieldName, null);
  }

  const updatedTask = await store.updateReviewTask(taskId, {
    status: 'REJECTED',
    validationStatus: 'REJECTED',
    reviewerId: userId,
    updatedAt: new Date().toISOString(),
  });
  const updatedDocument = await store.updateDocument(document.id, {
    extractedPayload: document.extractedPayload,
    updatedAt: new Date().toISOString(),
  });
  await recordAudit({
    documentId: document.id,
    userId,
    action: 'REVIEW_COMPLETED',
    stage: 'review',
    status: 'REJECTED',
    metadata: { field: task.fieldName },
  });
  const finalDocument = await finishIfDone(updatedDocument, userId);
  return { task: updatedTask, document: finalDocument };
}
