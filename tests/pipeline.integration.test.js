import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { bootApp, registerAndLogin } from '../backend/tests/helpers.js';

const require = createRequire(new URL('../backend/package.json', import.meta.url));
const sharp = require('sharp');
const request = require('supertest');

function word(text, confidence) {
  return { text, confidence, confidenceAvailable: true, bbox: { x0: 1, y0: 1, x1: 20, y1: 10 } };
}

test('upload, grounded extraction, validation, and audit persistence', async () => {
  const ctx = await bootApp();
  try {
    const { token, user } = await registerAndLogin(ctx.app, 'grace@folio.test');
    const image = await sharp({
      create: { width: 24, height: 24, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).png().toBuffer();

    const uploaded = await request(ctx.app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', image, { filename: 'invoice.png', contentType: 'image/png' });
    assert.equal(uploaded.status, 201);
    const documentId = uploaded.body.data.document.id;

    const { processDocument } = await import('../backend/services/pipeline/processDocument.js');
    const processed = await processDocument(documentId, user.id, {
      async recognize() {
        return {
          text: 'Invoice 1001 Acme Supplies 2024-05-01 Total 42.50 USD',
          confidence: 0.96,
          confidenceAvailable: true,
          words: [
            word('Invoice', 0.99),
            word('1001', 0.98),
            word('Acme', 0.97),
            word('Supplies', 0.96),
            word('2024-05-01', 0.95),
            word('Total', 0.97),
            word('42.50', 0.96),
            word('USD', 0.99),
          ],
          blocks: [],
        };
      },
      async extract() {
        return {
          documentType: 'invoice',
          fields: {
            invoiceNumber: '1001',
            invoiceDate: '2024-05-01',
            vendorName: 'Invented Vendor LLC',
            totalAmount: 42.5,
            currency: 'USD',
          },
          items: [{ description: 'Paper', quantity: 1, unitPrice: 42.5, amount: 42.5 }],
          entities: [{ type: 'organization', value: 'Acme Supplies', page: 1 }],
          tables: [{
            tableId: 'table-001',
            page: 1,
            columns: ['Description', 'Amount'],
            rows: [['Paper', '42.50'], ['Mystery row', '999.00']],
          }],
        };
      },
    });

    assert.equal(processed.status, 'REVIEW_REQUIRED');
    assert.equal(processed.documentType, 'invoice');

    const extraction = await request(ctx.app)
      .get(`/api/documents/${documentId}/extraction`)
      .set('Authorization', `Bearer ${token}`);
    const fields = extraction.body.data.fields;
    const vendor = fields.find((field) => field.field === 'vendorName');
    const invoiceNumber = fields.find((field) => field.field === 'invoiceNumber');
    assert.equal(vendor.value, null);
    assert.equal(vendor.grounded, false);
    assert.equal(vendor.suggestedValue, 'Invented Vendor LLC');
    assert.equal(invoiceNumber.value, '1001');
    assert.equal(invoiceNumber.validationStatus, 'AUTO_APPROVED');
    assert.equal(invoiceNumber.confidence >= 0.9, true);

    const tables = await request(ctx.app)
      .get(`/api/documents/${documentId}/extraction`)
      .set('Authorization', `Bearer ${token}`);
    const tableResponse = await request(ctx.app)
      .get(`/api/reviews?documentId=${documentId}&status=OPEN`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(tables.body.success, true);
    assert.ok(tableResponse.body.data.reviews.some((task) => task.field === 'table:table-001'));

    const storedTables = extraction.body.data.payload.tables[0];
    assert.equal(storedTables.rows[1][0], null);
    assert.equal(storedTables.rows[1][1], null);

    const audit = await request(ctx.app)
      .get(`/api/audit/${documentId}`)
      .set('Authorization', `Bearer ${token}`);
    const actions = audit.body.data.entries.map((entry) => entry.action);
    for (const action of ['DOCUMENT_UPLOADED', 'PROCESSING_STARTED', 'OCR_COMPLETED', 'EXTRACTION_COMPLETED', 'SCHEMA_VALIDATION_COMPLETED', 'REVIEW_REQUESTED']) {
      assert.ok(actions.includes(action), action);
    }
    assert.equal(JSON.stringify(audit.body).includes('GEMINI_API_KEY'), false);
  } finally {
    await ctx.cleanup();
  }
});

test('missing Gemini configuration fails extraction without fabricating fields', async () => {
  const ctx = await bootApp();
  try {
    const { extractWithGemini } = await import('../backend/services/extraction/geminiExtractor.js');
    await assert.rejects(
      extractWithGemini({ filename: 'invoice.png', ocrPages: [{ page: 1, text: 'Invoice 1001' }] }),
      (error) => error.code === 'CONFIGURATION_ERROR',
    );
  } finally {
    await ctx.cleanup();
  }
});
