import crypto from 'crypto';
import { getStore } from '../../models/store.js';

const SENSITIVE_KEY = /password|token|secret|api[-_]?key|authorization|service[-_]?role/i;

export function sanitizeMetadata(metadata) {
  const safe = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (typeof value === 'string') safe[key] = value.slice(0, 300);
    else if (typeof value === 'number' || typeof value === 'boolean' || value == null) safe[key] = value;
    else if (Array.isArray(value)) {
      safe[key] = value.slice(0, 20).map((item) => (typeof item === 'string' ? item.slice(0, 120) : item));
    }
  }
  return safe;
}

export async function recordAudit({ documentId, userId = null, action, stage, status, metadata = {} }) {
  return getStore().addAudit({
    id: crypto.randomUUID(),
    documentId,
    userId,
    action,
    stage,
    status,
    metadata: sanitizeMetadata(metadata),
    createdAt: new Date().toISOString(),
  });
}
