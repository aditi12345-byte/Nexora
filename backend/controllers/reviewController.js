import { getStore } from '../models/store.js';
import { approveReview, rejectReview, updateReviewDraft } from '../services/review/reviewService.js';
import { AppError } from '../utils/errors.js';
import { toPublicDocument } from '../utils/files.js';
import { sendSuccess } from '../utils/response.js';

function publicTask(task) {
  return {
    id: task.id,
    documentId: task.documentId,
    field: task.fieldName,
    value: task.value,
    suggestedValue: task.suggestedValue,
    grounded: task.grounded,
    confidence: task.confidenceAvailable ? task.confidence : null,
    confidenceAvailable: task.confidenceAvailable,
    sourcePage: task.sourcePage,
    sourceText: task.sourceText,
    validationStatus: task.validationStatus,
    status: task.status,
    correction: task.correction,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export async function listReviews(req, res, next) {
  try {
    const tasks = await getStore().listReviewTasks({
      userId: req.user.sub,
      documentId: req.query.documentId || undefined,
      status: req.query.status || undefined,
    });
    sendSuccess(res, { reviews: tasks.map(publicTask) });
  } catch (error) {
    next(error);
  }
}

export async function getReview(req, res, next) {
  try {
    const task = await getStore().getReviewTask(req.params.id);
    if (!task) {
      throw new AppError('INGESTION_ERROR', 'Review task not found', { status: 404, stage: 'review' });
    }
    if (task.userId !== req.user.sub) {
      throw new AppError('AUTHORIZATION_ERROR', 'You cannot view this review', {
        status: 403,
        stage: 'authorization',
      });
    }
    sendSuccess(res, { review: publicTask(task) });
  } catch (error) {
    next(error);
  }
}

export async function patchReview(req, res, next) {
  try {
    if (!req.body || !Object.prototype.hasOwnProperty.call(req.body, 'value')) {
      throw new AppError('SCHEMA_VALIDATION_ERROR', 'A corrected value is required', {
        status: 400,
        stage: 'review',
        recoverable: true,
      });
    }
    const task = await updateReviewDraft(req.params.id, req.user.sub, req.body.value);
    sendSuccess(res, { review: publicTask(task) }, 'Correction saved');
  } catch (error) {
    next(error);
  }
}

export async function approve(req, res, next) {
  try {
    const result = await approveReview(req.params.id, req.user.sub, req.body?.value);
    sendSuccess(res, { review: publicTask(result.task), document: toPublicDocument(result.document) }, 'Review approved');
  } catch (error) {
    next(error);
  }
}

export async function reject(req, res, next) {
  try {
    const result = await rejectReview(req.params.id, req.user.sub);
    sendSuccess(res, { review: publicTask(result.task), document: toPublicDocument(result.document) }, 'Review rejected');
  } catch (error) {
    next(error);
  }
}
