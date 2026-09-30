import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import sharp from 'sharp';
import request from 'supertest';
import { bootApp, registerAndLogin } from './helpers.js';

async function png() {
  return sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 250, g: 250, b: 250 } },
  }).png().toBuffer();
}

async function pdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 144]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Invoice 1001', { x: 24, y: 80, size: 18, font });
  return Buffer.from(await doc.save());
}

test('upload accepts a PNG and a PDF and lists them for the owner', async () => {
  const ctx = await bootApp();
  try {
    const { token } = await registerAndLogin(ctx.app);
    const image = await request(ctx.app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', await png(), { filename: 'receipt.png', contentType: 'image/png' });
    assert.equal(image.status, 201);
    assert.equal(image.body.data.document.status, 'QUEUED');
    assert.equal(image.body.data.document.storagePath, undefined);

    const document = await request(ctx.app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', await pdf(), { filename: 'invoice.pdf', contentType: 'application/pdf' });
    assert.equal(document.status, 201);
    assert.equal(document.body.data.document.pageCount, 1);

    const list = await request(ctx.app).get('/api/documents').set('Authorization', `Bearer ${token}`);
    assert.equal(list.body.data.documents.length, 2);
  } finally {
    await ctx.cleanup();
  }
});

test('upload rejects unsupported, empty, oversized, and corrupted files', async () => {
  const ctx = await bootApp({ MAX_UPLOAD_BYTES: 80 });
  try {
    const { token } = await registerAndLogin(ctx.app);
    const auth = { Authorization: `Bearer ${token}` };

    const text = await request(ctx.app).post('/api/documents/upload').set(auth)
      .attach('file', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' });
    assert.equal(text.status, 400);
    assert.equal(text.body.error.code, 'FILE_VALIDATION_ERROR');

    const empty = await request(ctx.app).post('/api/documents/upload').set(auth)
      .attach('file', Buffer.alloc(0), { filename: 'empty.png', contentType: 'image/png' });
    assert.equal(empty.status, 400);

    const oversized = await request(ctx.app).post('/api/documents/upload').set(auth)
      .attach('file', Buffer.alloc(200, 1), { filename: 'big.png', contentType: 'image/png' });
    assert.equal(oversized.status, 400);
    assert.match(oversized.body.error.message, /too large|not supported|could not be read|empty|content/i);

    const corrupted = await request(ctx.app).post('/api/documents/upload').set(auth)
      .attach('file', Buffer.from('%PDF-1.4\nnot-a-pdf'), { filename: 'bad.pdf', contentType: 'application/pdf' });
    assert.equal(corrupted.status, 400);
    assert.equal(corrupted.body.error.code, 'FILE_VALIDATION_ERROR');
  } finally {
    await ctx.cleanup();
  }
});
