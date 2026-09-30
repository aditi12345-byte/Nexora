import path from 'path';

export function sanitizeFilename(name) {
  const base = path.basename(String(name || 'document'));
  const cleaned = base.replace(/[^\w.\- ()]/g, '_').slice(0, 180);
  return cleaned || 'document';
}

export function detectMime(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer.slice(0, 4).toString('utf8') === '%PDF') return 'application/pdf';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  return null;
}

export function toPublicDocument(doc) {
  if (!doc) return null;
  return {
    id: doc.id,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    status: doc.status,
    pageCount: doc.pageCount,
    width: doc.width,
    height: doc.height,
    documentType: doc.documentType,
    errorCode: doc.errorCode,
    errorMessage: doc.errorMessage,
    errorStage: doc.errorStage,
    errorDetails: doc.errorDetails || [],
    recoverable: doc.recoverable,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
