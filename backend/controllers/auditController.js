import { getStore } from '../models/store.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export async function getAudit(req, res, next) {
  try {
    const document = await getStore().getDocument(req.params.documentId);
    if (!document) {
      throw new AppError('INGESTION_ERROR', 'Document not found', { status: 404, stage: 'audit' });
    }
    if (document.userId !== req.user.sub) {
      throw new AppError('AUTHORIZATION_ERROR', 'You cannot view this audit history', {
        status: 403,
        stage: 'authorization',
      });
    }
    const entries = await getStore().listAudit(document.id);
    sendSuccess(res, {
      entries: entries.map((entry) => ({
        id: entry.id,
        documentId: entry.documentId,
        action: entry.action,
        stage: entry.stage,
        status: entry.status,
        metadata: entry.metadata,
        timestamp: entry.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}
