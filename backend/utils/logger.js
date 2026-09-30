export function logError(error) {
  const summary = {
    code: error?.code || 'SYSTEM_ERROR',
    message: error?.message || 'Unknown error',
    stage: error?.stage || null,
  };
  console.error(summary);
  if (process.env.NODE_ENV !== 'production' && error?.stack) {
    console.error(error.stack);
  }
}
