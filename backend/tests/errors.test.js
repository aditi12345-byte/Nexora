import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyExternalError } from '../utils/errors.js';
import { sanitizeMetadata } from '../services/audit/auditService.js';
import { parseModelJson } from '../services/extraction/geminiExtractor.js';

test('classifies AI timeout, rate limit, and auth failures', () => {
  const timeout = classifyExternalError(Object.assign(new Error('timeout'), { name: 'TimeoutError' }), 'extraction');
  assert.equal(timeout.code, 'API_ERROR');
  assert.equal(timeout.recoverable, true);

  const limited = classifyExternalError({ status: 429, message: 'rate limit' }, 'extraction');
  assert.equal(limited.httpStatus, 429);

  const denied = classifyExternalError({ status: 401, message: 'API key invalid' }, 'extraction');
  assert.equal(denied.recoverable, false);
});

test('malformed model JSON becomes an extraction error', () => {
  assert.throws(() => parseModelJson('not json'), (error) => error.code === 'EXTRACTION_ERROR');
  assert.equal(parseModelJson('```json\n{"documentType":"generic"}\n```').documentType, 'generic');
});

test('audit metadata drops secrets', () => {
  const safe = sanitizeMetadata({
    pageCount: 1,
    token: 'secret-token',
    apiKey: 'key',
    note: 'uploaded',
  });
  assert.equal(safe.pageCount, 1);
  assert.equal(safe.note, 'uploaded');
  assert.equal('token' in safe, false);
  assert.equal('apiKey' in safe, false);
});
