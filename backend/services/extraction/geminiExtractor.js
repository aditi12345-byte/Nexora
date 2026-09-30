import { GoogleGenAI } from '@google/genai';
import { getConfig } from '../../config/env.js';
import { AppError, classifyExternalError } from '../../utils/errors.js';

const MAX_OCR_CHARS = 20000;
const FALLBACK_MODELS = ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-3.5-flash'];

function modelsToTry(preferred) {
  return [...new Set([preferred, ...FALLBACK_MODELS].filter(Boolean))];
}

function retryableModelError(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  const message = String(error?.message || '');
  if (status === 401 || status === 403 || /api[_ ]key/i.test(message)) return false;
  return status === 404 || status === 429 || status === 503 || /high demand|unavailable|no longer available|not found/i.test(message);
}

function buildPrompt(filename, ocrPages) {
  const pages = ocrPages.map((page) => `--- page ${page.page} ---\n${page.text || ''}`).join('\n\n');
  const truncated = pages.length > MAX_OCR_CHARS;
  const content = truncated ? pages.slice(0, MAX_OCR_CHARS) : pages;

  return {
    truncated,
    prompt: `You extract structured data from documents for an IDP system.
Use only the OCR text below. Do not invent names, dates, amounts, identifiers, or table cells.
If a value is not present, return null. Do not guess.
Return JSON only, with this shape:
{
  "documentType": "invoice" | "receipt" | "identity" | "generic",
  "fields": {},
  "items": [],
  "entities": [],
  "tables": []
}
Invoice fields: invoiceNumber, invoiceDate, vendorName, totalAmount, currency.
Receipt fields: receiptNumber, receiptDate, merchantName, totalAmount, currency.
Identity fields: fullName, dateOfBirth, documentNumber, address, expiryDate.
Each field may be a raw value or {"value": "...", "sourceQuote": "exact OCR snippet"}.
Dates may be copied as written. Amounts may be copied as written.
entities items use type person|organization|date|money|address|identifier|other and a value copied from the text.
tables use {"tableId":"table-001","page":1,"columns":[],"rows":[]}. Leave tables empty if no real table is present.
File name: ${filename}
OCR:
${content}`,
  };
}

export function parseModelJson(text) {
  if (!text || !String(text).trim()) {
    throw new AppError('EXTRACTION_ERROR', 'The model returned an empty response', {
      status: 502,
      stage: 'extraction',
      recoverable: true,
    });
  }
  let raw = String(text).trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) raw = fenced[1].trim();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return parsed;
  } catch {
    throw new AppError('EXTRACTION_ERROR', 'The model returned malformed JSON', {
      status: 502,
      stage: 'extraction',
      recoverable: true,
    });
  }
}

export async function transcribeImage(buffer) {
  const config = getConfig();
  if (!config.geminiApiKey) {
    throw new AppError('CONFIGURATION_ERROR', 'GEMINI_API_KEY is not configured', {
      status: 503,
      stage: 'ocr',
      recoverable: true,
    });
  }

  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const models = modelsToTry(config.geminiModel);
  let lastError;
  for (const model of models) {
    try {
      const response = await Promise.race([
        ai.models.generateContent({
          model,
          contents: [
            {
              text: 'Transcribe the visible text in this document image. Keep the original line breaks. Do not add headings, translations, or words that are not visible. If nothing is readable, return an empty string.',
            },
            { inlineData: { mimeType: 'image/png', data: Buffer.from(buffer).toString('base64') } },
          ],
          config: { temperature: 0, maxOutputTokens: 4096 },
        }),
        new Promise((_, reject) => {
          const error = new Error('timeout');
          error.name = 'TimeoutError';
          setTimeout(() => reject(error), config.geminiTimeoutMs);
        }),
      ]);
      const text = typeof response?.text === 'string' ? response.text.trim() : '';
      return {
        text,
        confidence: null,
        confidenceAvailable: false,
        words: [],
        blocks: text ? [{ text, confidence: null, confidenceAvailable: false, bbox: null }] : [],
      };
    } catch (error) {
      lastError = error;
      if (!retryableModelError(error) && !(Number(error?.status) === 400)) break;
    }
  }
  throw classifyExternalError(lastError, 'ocr');
}

export async function extractWithGemini({ filename, ocrPages }) {
  const config = getConfig();
  if (!config.geminiApiKey) {
    throw new AppError('CONFIGURATION_ERROR', 'GEMINI_API_KEY is not configured', {
      status: 503,
      stage: 'extraction',
      recoverable: true,
    });
  }

  const { prompt, truncated } = buildPrompt(filename, ocrPages);
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const models = modelsToTry(config.geminiModel);
  let response;
  let lastError;

  for (const model of models) {
    for (const includeThinking of [true, false]) {
      try {
        response = await Promise.race([
          ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              temperature: 0,
              responseMimeType: 'application/json',
              maxOutputTokens: 4096,
              ...(includeThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
            },
          }),
          new Promise((_, reject) => {
            setTimeout(() => {
              const error = new Error('timeout');
              error.name = 'TimeoutError';
              reject(error);
            }, config.geminiTimeoutMs);
          }),
        ]);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        const invalidArgument = Number(error?.status) === 400 && /invalid argument/i.test(String(error?.message || ''));
        if (invalidArgument && includeThinking) continue;
        break;
      }
    }
    if (response) break;
    if (lastError && !retryableModelError(lastError) && !(Number(lastError.status) === 400)) break;
  }

  if (!response) {
    throw classifyExternalError(lastError, 'extraction');
  }

  const parsed = parseModelJson(response?.text);
  return { ...parsed, ocrTruncated: truncated };
}
