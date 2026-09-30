import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCurrency, normalizeDate, normalizeMoney, normalizeString } from '../services/extraction/normalize.js';

test('normalizes written dates and rejects impossible dates', () => {
  assert.deepEqual(normalizeDate('May 1, 2024'), { ok: true, value: '2024-05-01' });
  assert.equal(normalizeDate('NOT_FOUND').value, null);
  assert.equal(normalizeDate('2024-02-31').ok, false);
  assert.equal(normalizeDate('13/40/2020').ok, false);
});

test('normalizes money and rejects words', () => {
  assert.deepEqual(normalizeMoney('$1,250.50'), { ok: true, value: 1250.5 });
  assert.equal(normalizeMoney('twelve').ok, false);
  assert.equal(normalizeMoney(null).value, null);
});

test('normalizes currency codes and text', () => {
  assert.deepEqual(normalizeCurrency('usd'), { ok: true, value: 'USD' });
  assert.equal(normalizeCurrency('$').ok, false);
  assert.deepEqual(normalizeString('  Acme  '), { ok: true, value: 'Acme' });
  assert.equal(normalizeString('').value, null);
});
