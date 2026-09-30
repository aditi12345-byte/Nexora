import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import fs from 'fs';
import { recognizeImage, shutdownOcr } from '../services/ocr/ocrService.js';

const fontCandidates = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
];

test('tesseract reads a rendered sample and reports real confidence', { timeout: 120000 }, async () => {
  try {
    const fontPath = fontCandidates.find((candidate) => fs.existsSync(candidate));
    assert.ok(fontPath, 'A system font is required for the OCR sample');
    GlobalFonts.registerFromPath(fontPath, 'SampleSans');

    const canvas = createCanvas(640, 180);
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 640, 180);
    context.fillStyle = '#000000';
    context.font = '42px SampleSans';
    context.fillText('INVOICE 1001', 40, 100);
    const png = canvas.toBuffer('image/png');

    const result = await recognizeImage(png);
    assert.match(result.text.toUpperCase(), /INVOICE/);
    assert.match(result.text, /1001/);
    assert.equal(result.confidenceAvailable, true);
    assert.equal(typeof result.confidence, 'number');
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
    assert.ok(result.words.some((word) => word.bbox && typeof word.bbox.x0 === 'number'));
  } finally {
    await shutdownOcr();
  }
});
