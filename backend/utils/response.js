export function sendSuccess(res, data = {}, message = 'Operation completed successfully', status = 200) {
  res.status(status).json({ success: true, data, message });
}

export function sendFailure(res, status, code, message, extra = {}) {
  const error = {
    code,
    message,
    details: extra.details || [],
  };
  if (extra.stage) error.stage = extra.stage;
  if (typeof extra.recoverable === 'boolean') error.recoverable = extra.recoverable;
  res.status(status).json({ success: false, error });
}
