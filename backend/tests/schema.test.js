import assert from 'node:assert/strict';
import test from 'node:test';
import { validateExtraction } from '../services/validation/schemaValidation.js';

function invoice(overrides = {}) {
  return {
    documentType: 'invoice',
    fields: {
      invoiceNumber: '1001',
      invoiceDate: '2024-05-01',
      vendorName: 'Acme Supplies',
      totalAmount: 42.5,
      currency: 'USD',
      ...overrides.fields,
    },
    items: overrides.items || [],
    entities: overrides.entities || [],
    tables: overrides.tables || [],
  };
}

test('valid invoice data passes schema validation', () => {
  const result = validateExtraction(invoice());
  assert.equal(result.passed, true);
  assert.equal(result.errors.length, 0);
});

test('missing required field fails schema validation', () => {
  const payload = invoice();
  delete payload.fields.invoiceNumber;
  const result = validateExtraction(payload);
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.path.includes('invoiceNumber')));
});

test('wrong field type fails schema validation', () => {
  const result = validateExtraction(invoice({ fields: { totalAmount: '42.50' } }));
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.path.includes('totalAmount')));
});

test('invalid date fails schema validation', () => {
  const result = validateExtraction(invoice({ fields: { invoiceDate: '2024-13-40' } }));
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.path.includes('invoiceDate')));
});

test('invalid nested object fails schema validation', () => {
  const result = validateExtraction(invoice({
    items: [{ description: 12, quantity: 1, unitPrice: 1, amount: 1 }],
  }));
  assert.equal(result.passed, false);
});

test('invalid array fails schema validation', () => {
  const payload = invoice();
  payload.items = { description: 'Paper' };
  const result = validateExtraction(payload);
  assert.equal(result.passed, false);
});
