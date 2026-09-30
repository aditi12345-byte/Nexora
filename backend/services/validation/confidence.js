export function decideConfidence(confidence, available, thresholds = { high: 0.9, review: 0.7 }) {
  if (!available || typeof confidence !== 'number' || !Number.isFinite(confidence)) {
    return { status: 'REVIEW_REQUIRED', reason: 'CONFIDENCE_UNAVAILABLE' };
  }
  if (confidence >= thresholds.high) {
    return { status: 'AUTO_APPROVED', reason: 'HIGH_CONFIDENCE' };
  }
  if (confidence >= thresholds.review) {
    return { status: 'VERIFICATION_REQUIRED', reason: 'MEDIUM_CONFIDENCE' };
  }
  return { status: 'REVIEW_REQUIRED', reason: 'LOW_CONFIDENCE' };
}

export function needsHumanReview(status) {
  return status === 'REVIEW_REQUIRED' || status === 'VERIFICATION_REQUIRED';
}

export function fromTesseractConfidence(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return { confidence: null, confidenceAvailable: false };
  }
  const confidence = Math.round((value / 100) * 1000) / 1000;
  if (confidence > 1) return { confidence: null, confidenceAvailable: false };
  return { confidence, confidenceAvailable: true };
}
