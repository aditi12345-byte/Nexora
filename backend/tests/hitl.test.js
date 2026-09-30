import assert from 'node:assert/strict';
import fs from 'fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import request from 'supertest';
import { bootApp, registerAndLogin } from './helpers.js';

function word(text, confidence) {
  return { text, confidence, confidenceAvailable: true, bbox: null };
}

test('low confidence creates a review task and invalid corrections are not approved', async () => {
  const ctx = await bootApp();
  try {
    const { token, user } = await registerAndLogin(ctx.app);
    const image = await sharp({
      create: { width: 20, height: 20, channels: 3, background: 'white' },
    }).png().toBuffer();
    const uploaded = await request(ctx.app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', image, { filename: 'invoice.png', contentType: 'image/png' });
    const documentId = uploaded.body.data.document.id;

    const { processDocument } = await import('../services/pipeline/processDocument.js');
    await processDocument(documentId, user.id, {
      async recognize() {
        return {
          text: 'Invoice 1001 Acme Supplies Total 42.50 USD 2024-05-01',
          confidence: 0.8,
          confidenceAvailable: true,
          words: [
            word('Invoice', 0.96),
            word('1001', 0.97),
            word('Acme', 0.61),
            word('Supplies', 0.62),
            word('Total', 0.95),
            word('42.50', 0.96),
            word('USD', 0.98),
            word('2024-05-01', 0.5),
          ],
          blocks: [],
        };
      },
      async extract() {
        return {
          documentType: 'invoice',
          fields: {
            invoiceNumber: { value: '1001', sourceQuote: '1001' },
            invoiceDate: { value: '2024-05-01', sourceQuote: '2024-05-01' },
            vendorName: { value: 'Acme Supplies', sourceQuote: 'Acme Supplies' },
            totalAmount: { value: '42.50', sourceQuote: '42.50' },
            currency: { value: 'USD', sourceQuote: 'USD' },
          },
          items: [],
          entities: [],
          tables: [],
        };
      },
    });

    const reviews = await request(ctx.app)
      .get(`/api/reviews?documentId=${documentId}`)
      .set('Authorization', `Bearer ${token}`);
    const tasks = reviews.body.data.reviews;
    const vendor = tasks.find((task) => task.field === 'vendorName');
    const date = tasks.find((task) => task.field === 'invoiceDate');
    assert.ok(vendor);
    assert.equal(vendor.validationStatus, 'REVIEW_REQUIRED');
    assert.equal(vendor.confidence < 0.7, true);
    assert.ok(date);

    const invalid = await request(ctx.app)
      .post(`/api/reviews/${date.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: '2024-13-40' });
    assert.equal(invalid.status, 422);
    assert.equal(invalid.body.error.code, 'SCHEMA_VALIDATION_ERROR');

    const stillOpen = await request(ctx.app)
      .get(`/api/reviews/${date.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(stillOpen.body.data.review.status, 'OPEN');

    const fixedDate = await request(ctx.app)
      .post(`/api/reviews/${date.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 'May 2, 2024' });
    assert.equal(fixedDate.status, 200);

    const fixedVendor = await request(ctx.app)
      .post(`/api/reviews/${vendor.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 'Acme Supplies' });
    assert.equal(fixedVendor.status, 200);

    const extraction = await request(ctx.app)
      .get(`/api/documents/${documentId}/extraction`)
      .set('Authorization', `Bearer ${token}`);
    const dateField = extraction.body.data.fields.find((field) => field.field === 'invoiceDate');
    assert.equal(dateField.value, '2024-05-02');
    assert.equal(dateField.validationStatus, 'APPROVED');
    assert.equal(extraction.body.data.payload.fields.invoiceDate, '2024-05-02');
  } finally {
    await ctx.cleanup();
    await fs.rm(ctx.dir, { recursive: true, force: true }).catch(() => undefined);
  }
});
