import path from 'path';
import { fileURLToPath } from 'url';
import { AppError } from '../../utils/errors.js';
import { fromTesseractConfidence } from '../validation/confidence.js';
import './traceTesseract.js';

const langDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../ocr-data');
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS || 40000);

let workerPromise;

function abandonWorker() {
  const pending = workerPromise;
  workerPromise = null;
  if (!pending) return;
  pending
    .then((worker) => worker.terminate())
    .catch(() => {});
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('eng', 1, {
        workerPath: path.join(path.dirname(fileURLToPath(import.meta.url)), 'tesseractWorker.cjs'),
        langPath: langDir,
        cachePath: process.env.VERCEL ? '/tmp/tesseract-cache' : path.join(langDir, '.cache'),
        gzip: false,
      });
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
  let timer;
  try {
    const result = await Promise.race([
      (async () => {
        const worker = await getWorker();
        return worker.recognize(buffer, {}, { blocks: true });
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error('OCR timed out');
          error.name = 'TimeoutError';
          reject(error);
        }, OCR_TIMEOUT_MS);
      }),
    ]);
    clearTimeout(timer);
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
    clearTimeout(timer);
    if (error instanceof AppError) throw error;
    if (error?.name === 'TimeoutError') {
      abandonWorker();
      throw new AppError('OCR_ERROR', 'OCR did not finish in time', {
        status: 422,
        stage: 'ocr',
        recoverable: true,
      });
    }
    console.error(JSON.stringify({
      code: 'OCR_ERROR',
      message: error?.message || 'Document OCR processing failed',
      name: error?.name || 'Error',
    }));
    const detail = String(error?.message || error || 'unknown OCR error').slice(0, 300);
    throw new AppError('OCR_ERROR', `Document OCR processing failed: ${detail}`, {
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
