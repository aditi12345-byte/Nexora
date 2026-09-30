const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};

export function isBlank(value) {
  return value == null || value === '' || value === 'NOT_FOUND';
}

export function isRealIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isoFromParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return { ok: false, error: 'Invalid date' };
  }
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (!isRealIsoDate(iso)) return { ok: false, error: 'Invalid date' };
  return { ok: true, value: iso };
}

export function normalizeDate(value) {
  if (isBlank(value)) return { ok: true, value: null };
  if (typeof value !== 'string' && typeof value !== 'number') {
    return { ok: false, error: 'Invalid date' };
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return isRealIsoDate(text) ? { ok: true, value: text } : { ok: false, error: 'Invalid date' };
  }

  let match = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (match) {
    const month = MONTHS[match[2].toLowerCase()];
    if (!month) return { ok: false, error: 'Invalid date' };
    return isoFromParts(Number(match[3]), month, Number(match[1]));
  }

  match = text.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (match) {
    const month = MONTHS[match[1].toLowerCase()];
    if (!month) return { ok: false, error: 'Invalid date' };
    return isoFromParts(Number(match[3]), month, Number(match[2]));
  }

  return { ok: false, error: 'Invalid date' };
}

export function normalizeMoney(value) {
  if (isBlank(value)) return { ok: true, value: null };
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { ok: true, value } : { ok: false, error: 'Invalid amount' };
  }
  if (typeof value !== 'string') return { ok: false, error: 'Invalid amount' };
  const cleaned = value.trim().replace(/[$€£\s]/g, '').replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return { ok: false, error: 'Invalid amount' };
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return { ok: false, error: 'Invalid amount' };
  return { ok: true, value: amount };
}

export function normalizeString(value) {
  if (isBlank(value)) return { ok: true, value: null };
  if (typeof value !== 'string' && typeof value !== 'number') {
    return { ok: false, error: 'Invalid text value' };
  }
  const text = String(value).trim();
  if (!text) return { ok: true, value: null };
  if (text.length > 500) return { ok: false, error: 'Value is too long' };
  return { ok: true, value: text };
}

export function normalizeCurrency(value) {
  if (isBlank(value)) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, error: 'Invalid currency' };
  const text = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(text)) return { ok: false, error: 'Invalid currency' };
  return { ok: true, value: text };
}

export function normalizeByKind(kind, value) {
  if (kind === 'date') return normalizeDate(value);
  if (kind === 'money') return normalizeMoney(value);
  if (kind === 'currency') return normalizeCurrency(value);
  return normalizeString(value);
}
