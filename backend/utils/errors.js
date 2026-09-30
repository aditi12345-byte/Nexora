export class AppError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = options.status || 400;
    this.stage = options.stage || null;
    this.recoverable = Boolean(options.recoverable);
    this.details = options.details || [];
  }
}

export function toAppError(error) {
  if (error instanceof AppError) return error;
  if (error?.code === 'CONFIGURATION_ERROR') {
    return new AppError('CONFIGURATION_ERROR', error.message, {
      status: 500,
      stage: 'configuration',
      recoverable: false,
      details: error.missing || [],
    });
  }
  return new AppError('SYSTEM_ERROR', 'An unexpected error occurred', {
    status: 500,
    stage: 'system',
    recoverable: false,
  });
}

export function classifyExternalError(error, stage) {
  const message = String(error?.message || '');
  const status = Number(error?.status || error?.statusCode || 0);

  if (error instanceof AppError) return error;
  if (status === 401 || status === 403 || /api[_ ]key/i.test(message)) {
    return new AppError('API_ERROR', 'The Gemini API key was rejected. Check GEMINI_API_KEY.', {
      status: 502,
      stage,
      recoverable: false,
    });
  }
  if (status === 429 || /quota|rate limit/i.test(message)) {
    return new AppError('API_ERROR', 'The AI service rate limit was reached', {
      status: 429,
      stage,
      recoverable: true,
    });
  }
  if (error?.name === 'TimeoutError' || /timeout/i.test(message)) {
    return new AppError('API_ERROR', 'The AI service timed out', {
      status: 504,
      stage,
      recoverable: true,
    });
  }
  if (status >= 500 || /unavailable|econnrefused|enotfound/i.test(message)) {
    return new AppError('INTEGRATION_ERROR', 'The AI service is unavailable', {
      status: 503,
      stage,
      recoverable: true,
    });
  }
  return new AppError('EXTRACTION_ERROR', 'Document extraction failed', {
    status: 502,
    stage,
    recoverable: true,
  });
}
