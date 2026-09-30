import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import sharp from 'sharp';
import { validateUploadedFile } from '../services/ingestion/fileValidation.js';

process.env.MAX_UPLOAD_BYTES = String(1024 * 1024);
process.env.MAX_PDF_PAGES = '20';
process.env.DATA_PROVIDER = 'local';

async function png(width = 12, height = 10) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();
}

async function pdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 144]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Invoice 1001', { x: 24, y: 80, size: 18, font });
  return Buffer.from(await doc.save());
}

test('accepts a valid PNG and reads dimensions', async () => {
  const buffer = await png();
  const result = await validateUploadedFile({ buffer, originalName: 'scan.png', mimeType: 'image/png' });
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.width, 12);
  assert.equal(result.height, 10);
});

test('accepts a readable PDF', async () => {
  const buffer = await pdf();
  const result = await validateUploadedFile({ buffer, originalName: 'invoice.pdf', mimeType: 'application/pdf' });
  assert.equal(result.pageCount, 1);
  assert.equal(result.mimeType, 'application/pdf');
});

test('rejects unsupported, empty, oversized, corrupted, and mismatched files', async () => {
  await assert.rejects(
    validateUploadedFile({ buffer: Buffer.from('hello'), originalName: 'notes.txt', mimeType: 'text/plain' }),
    (error) => error.code === 'FILE_VALIDATION_ERROR',
  );
  await assert.rejects(
    validateUploadedFile({ buffer: Buffer.alloc(0), originalName: 'empty.png', mimeType: 'image/png' }),
    (error) => error.message.includes('empty'),
  );

  process.env.MAX_UPLOAD_BYTES = '40';
  const big = await png(30, 30);
  await assert.rejects(
    validateUploadedFile({ buffer: big, originalName: 'big.png', mimeType: 'image/png' }),
    (error) => error.message.includes('too large'),
  );
  process.env.MAX_UPLOAD_BYTES = String(1024 * 1024);

  await assert.rejects(
    validateUploadedFile({
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
      originalName: 'broken.png',
      mimeType: 'image/png',
    }),
    (error) => error.code === 'FILE_VALIDATION_ERROR',
  );

  const image = await png();
  await assert.rejects(
    validateUploadedFile({ buffer: image, originalName: 'photo.jpg', mimeType: 'image/jpeg' }),
    (error) => error.message.includes('does not match'),
  );

  await assert.rejects(
    validateUploadedFile({ buffer: Buffer.from('%PDF-1.4\nbroken'), originalName: 'bad.pdf', mimeType: 'application/pdf' }),
    (error) => error.message.includes('could not be read'),
  );
});
