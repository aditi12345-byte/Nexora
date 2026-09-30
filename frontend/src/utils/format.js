export function formatBytes(size) {
  if (!Number.isFinite(size)) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export function formatConfidence(value, available) {
  if (!available || typeof value !== 'number') return 'Unavailable';
  return `${Math.round(value * 1000) / 10}%`;
}

export const ACTIVE_STATUSES = [
  'QUEUED',
  'VALIDATING',
  'PREPROCESSING',
  'OCR_PROCESSING',
  'EXTRACTING',
  'VALIDATING_DATA',
];

export function isProcessing(status) {
  return ACTIVE_STATUSES.includes(status);
}
