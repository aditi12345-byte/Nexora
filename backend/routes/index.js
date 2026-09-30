import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getConfig } from '../config/env.js';
import { getAudit } from '../controllers/auditController.js';
import { login, logout, register } from '../controllers/authController.js';
import {
  deleteDocument,
  downloadOriginal,
  getDocument,
  getExtraction,
  getOcr,
  getPageImage,
  getStatus,
  getValidation,
  listDocuments,
  startProcessing,
  uploadDocument,
} from '../controllers/documentController.js';
import { health } from '../controllers/healthController.js';
import { approve, getReview, listReviews, patchReview, reject } from '../controllers/reviewController.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';
import { AppError } from '../utils/errors.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: getConfig().authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res, next) {
    next(new AppError('AUTHENTICATION_ERROR', 'Too many authentication attempts. Try again later.', {
      status: 429,
      stage: 'authentication',
      recoverable: true,
    }));
  },
});

router.get('/health', health);

router.post('/auth/register', authLimiter, register);
router.post('/auth/login', authLimiter, login);
router.post('/auth/logout', requireAuth, logout);

router.post('/documents/upload', requireAuth, uploadSingle(), uploadDocument);
router.get('/documents', requireAuth, listDocuments);
router.get('/documents/:id', requireAuth, getDocument);
router.delete('/documents/:id', requireAuth, deleteDocument);
router.post('/documents/:id/process', requireAuth, startProcessing);
router.get('/documents/:id/status', requireAuth, getStatus);
router.get('/documents/:id/ocr', requireAuth, getOcr);
router.get('/documents/:id/extraction', requireAuth, getExtraction);
router.get('/documents/:id/validation', requireAuth, getValidation);
router.get('/documents/:id/file', requireAuth, downloadOriginal);
router.get('/documents/:id/pages/:pageNumber/image', requireAuth, getPageImage);

router.get('/reviews', requireAuth, listReviews);
router.get('/reviews/:id', requireAuth, getReview);
router.patch('/reviews/:id', requireAuth, patchReview);
router.post('/reviews/:id/approve', requireAuth, approve);
router.post('/reviews/:id/reject', requireAuth, reject);

router.get('/audit/:documentId', requireAuth, getAudit);

export default router;
