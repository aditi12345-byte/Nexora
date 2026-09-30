import { GoogleGenAI } from '@google/genai';
import { getConfig } from '../../config/env.js';
import { AppError, classifyExternalError } from '../../utils/errors.js';

const MAX_OCR_CHARS = 20000;

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

  let response;
  try {
    response = await Promise.race([
      ai.models.generateContent({
        model: config.geminiModel,
        contents: prompt,
        config: {
          temperature: 0,
          responseMimeType: 'application/json',
          maxOutputTokens: 4096,
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
  } catch (error) {
    throw classifyExternalError(error, 'extraction');
  }

  const parsed = parseModelJson(response?.text);
  return { ...parsed, ocrTruncated: truncated };
}
