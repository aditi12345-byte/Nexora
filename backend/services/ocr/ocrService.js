import { AppError } from '../../utils/errors.js';
import { transcribeImage } from '../extraction/geminiExtractor.js';
import { fromTesseractConfidence } from '../validation/confidence.js';

let workerPromise;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('eng');
    })();
  }
  try {
    return await workerPromise;
  } catch (error) {
    workerPromise = null;
    throw error;
  }
}

export async function recognizeImage(buffer) {
  if (process.env.VERCEL || process.env.OCR_ENGINE === 'gemini') {
    try {
      return await transcribeImage(buffer);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('OCR_ERROR', 'Document OCR processing failed', {
        status: 422,
        stage: 'ocr',
        recoverable: true,
      });
    }
  }

  try {
    const worker = await getWorker();
    const result = await worker.recognize(buffer, {}, { blocks: true });
    const data = result?.data || {};
    const words = [];
    for (const block of data.blocks || []) {
      for (const paragraph of block.paragraphs || []) {
        for (const line of paragraph.lines || []) {
          for (const word of line.words || []) {
            if (!word.text || !String(word.text).trim()) continue;
            const score = fromTesseractConfidence(word.confidence);
            words.push({
              text: String(word.text).trim(),
              confidence: score.confidence,
              confidenceAvailable: score.confidenceAvailable,
              bbox: word.bbox
                ? { x0: word.bbox.x0, y0: word.bbox.y0, x1: word.bbox.x1, y1: word.bbox.y1 }
                : null,
            });
          }
        }
      }
    }

    const scored = words.filter((word) => word.confidenceAvailable);
    const pageScore = fromTesseractConfidence(data.confidence);
    const confidenceAvailable = scored.length > 0 || pageScore.confidenceAvailable;
    const confidence = scored.length > 0
      ? Math.round((scored.reduce((sum, word) => sum + word.confidence, 0) / scored.length) * 1000) / 1000
      : pageScore.confidence;

    return {
      text: typeof data.text === 'string' ? data.text.trim() : '',
      confidence,
      confidenceAvailable,
      words,
      blocks: words,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('OCR_ERROR', 'Document OCR processing failed', {
      status: 422,
      stage: 'ocr',
      recoverable: true,
    });
  }
}

export async function shutdownOcr() {
  if (!workerPromise) return;
  const pending = workerPromise;
  workerPromise = null;
  const worker = await pending;
  await worker.terminate();
}

export function textLayerResult(text) {
  return {
    text,
    confidence: null,
    confidenceAvailable: false,
    words: [],
    blocks: text
      ? [{ text, confidence: null, confidenceAvailable: false, bbox: null }]
      : [],
  };
}
