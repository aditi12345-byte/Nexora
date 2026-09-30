import crypto from 'crypto';

export function layoutFromOcr(documentId, ocrPages) {
  const blocks = [];
  for (const page of ocrPages) {
    const source = page.words?.length ? page.words : [];
    if (!source.length && page.text) {
      blocks.push({
        id: crypto.randomUUID(),
        documentId,
        page: page.page,
        blockType: 'page-text',
        text: page.text,
        bbox: null,
        confidence: page.confidenceAvailable ? page.confidence : null,
        confidenceAvailable: Boolean(page.confidenceAvailable),
      });
      continue;
    }
    for (const word of source) {
      blocks.push({
        id: crypto.randomUUID(),
        documentId,
        page: page.page,
        blockType: 'word',
        text: word.text,
        bbox: word.bbox || null,
        confidence: word.confidenceAvailable ? word.confidence : null,
        confidenceAvailable: Boolean(word.confidenceAvailable),
      });
    }
  }
  return blocks;
}
