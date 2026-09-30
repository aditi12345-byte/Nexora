import assert from 'node:assert/strict';
import test from 'node:test';
import { decideConfidence, fromTesseractConfidence, needsHumanReview } from '../services/validation/confidence.js';

const thresholds = { high: 0.9, review: 0.7 };

test('high confidence can be approved automatically', () => {
  const decision = decideConfidence(0.94, true, thresholds);
  assert.equal(decision.status, 'AUTO_APPROVED');
  assert.equal(needsHumanReview(decision.status), false);
});

test('medium confidence requires verification', () => {
  assert.equal(decideConfidence(0.75, true, thresholds).status, 'VERIFICATION_REQUIRED');
});

test('low confidence requires human review', () => {
  assert.equal(decideConfidence(0.61, true, thresholds).status, 'REVIEW_REQUIRED');
});

test('unavailable confidence is not invented', () => {
  const decision = decideConfidence(null, false, thresholds);
  assert.equal(decision.status, 'REVIEW_REQUIRED');
  assert.equal(decision.reason, 'CONFIDENCE_UNAVAILABLE');
});

test('tesseract confidence is scaled from 0-100 and negative scores stay unavailable', () => {
  assert.deepEqual(fromTesseractConfidence(95), { confidence: 0.95, confidenceAvailable: true });
  assert.equal(fromTesseractConfidence(-1).confidenceAvailable, false);
  assert.equal(fromTesseractConfidence(undefined).confidenceAvailable, false);
});
