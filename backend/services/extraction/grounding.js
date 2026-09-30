export function normalizeForMatch(value) {
  return String(value)
    .toLowerCase()
    .replace(/[$€£]/g, '')
    .replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asNumber(value) {
  const numeric = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function numbersMatch(left, right) {
  const a = asNumber(left);
  const b = asNumber(right);
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.001;
}

function evidenceFromWords(words, page) {
  const available = words.length > 0 && words.every((word) => word.confidenceAvailable && typeof word.confidence === 'number');
  const confidence = available
    ? Math.round((words.reduce((sum, word) => sum + word.confidence, 0) / words.length) * 1000) / 1000
    : null;
  return {
    found: true,
    confidence,
    confidenceAvailable: available,
    page,
    source: words.map((word) => word.text).join(' '),
  };
}

export function findEvidence(value, pages) {
  const missing = { found: false, confidence: null, confidenceAvailable: false, page: null, source: null };
  if (value == null) return missing;
  const needle = normalizeForMatch(value);
  if (!needle) return missing;
  const needleTokens = needle.split(' ');

  for (const page of pages || []) {
    const words = (page.words || []).filter((word) => word?.text);
    const tokens = words.map((word) => ({ ...word, token: normalizeForMatch(word.text) }));

    for (let start = 0; start < tokens.length; start += 1) {
      const collected = [];
      const joinedTokens = [];
      for (let index = start; index < tokens.length && joinedTokens.length < needleTokens.length; index += 1) {
        if (!tokens[index].token) continue;
        collected.push(tokens[index]);
        joinedTokens.push(tokens[index].token);
        const joined = joinedTokens.join(' ');
        if (joined === needle || (needleTokens.length === 1 && numbersMatch(needle, tokens[index].token))) {
          return evidenceFromWords(collected, page.page);
        }
        if (!needle.startsWith(joined)) break;
      }
    }

    const pageText = normalizeForMatch(page.text || '');
    if (pageText.includes(needle)) {
      return {
        found: true,
        confidence: null,
        confidenceAvailable: false,
        page: page.page,
        source: String(page.text || '').slice(0, 240),
      };
    }
  }

  return missing;
}

export function findBestEvidence(candidates, pages) {
  for (const candidate of candidates) {
    if (candidate == null || candidate === '' || candidate === 'NOT_FOUND') continue;
    const evidence = findEvidence(candidate, pages);
    if (evidence.found) return evidence;
  }
  return { found: false, confidence: null, confidenceAvailable: false, page: null, source: null };
}
