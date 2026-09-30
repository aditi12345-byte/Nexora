import multer from 'multer';
import { AppError, toAppError } from '../utils/errors.js';
import { logError } from '../utils/logger.js';
import { sendFailure } from '../utils/response.js';

export function notFound(req, res) {
  sendFailure(res, 404, 'SYSTEM_ERROR', 'Route not found');
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'The file is too large'
      : 'The upload could not be read';
    sendFailure(res, 400, 'FILE_VALIDATION_ERROR', message, {
      stage: 'ingestion',
      recoverable: false,
      details: [{ path: 'file', message }],
    });
    return;
  }

  const appError = error instanceof AppError ? error : toAppError(error);
  if (!(error instanceof AppError)) logError(error);
  else if (appError.httpStatus >= 500) logError(appError);

  sendFailure(res, appError.httpStatus, appError.code, appError.message, {
    stage: appError.stage,
    recoverable: appError.recoverable,
    details: appError.details,
  });
}
