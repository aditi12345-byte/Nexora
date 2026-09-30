import { FIELD_KINDS, KNOWN_DOCUMENT_TYPES } from '../../config/constants.js';
import { getConfig } from '../../config/env.js';
import { decideConfidence, needsHumanReview } from '../validation/confidence.js';
import { findBestEvidence } from './grounding.js';
import { isBlank, normalizeByKind, normalizeMoney, normalizeString } from './normalize.js';

function unwrapField(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && ('value' in raw || 'sourceQuote' in raw)) {
    return {
      rawValue: raw.value,
      sourceQuote: raw.sourceQuote ?? raw.source ?? null,
    };
  }
  return { rawValue: raw, sourceQuote: null };
}

function scoreScalar(fieldName, raw, pages, kind) {
  const { rawValue, sourceQuote } = unwrapField(raw);
  const base = {
    fieldName,
    value: null,
    schemaValue: null,
    suggestedValue: null,
    grounded: true,
    confidence: null,
    confidenceAvailable: false,
    sourcePage: null,
    sourceText: null,
    validationStatus: 'NOT_FOUND',
  };

  if (isBlank(rawValue)) return base;

  const evidence = findBestEvidence([sourceQuote, rawValue], pages);
  if (!evidence.found) {
    return {
      ...base,
      suggestedValue: rawValue,
      grounded: false,
      validationStatus: 'REVIEW_REQUIRED',
    };
  }

  const normalized = normalizeByKind(kind, rawValue);
  const thresholds = {
    high: getConfig().highConfidenceThreshold,
    review: getConfig().reviewConfidenceThreshold,
  };
  const decision = decideConfidence(evidence.confidence, evidence.confidenceAvailable, thresholds);

  if (!normalized.ok) {
    return {
      ...base,
      value: rawValue,
      schemaValue: rawValue,
      grounded: true,
      confidence: evidence.confidence,
      confidenceAvailable: evidence.confidenceAvailable,
      sourcePage: evidence.page,
      sourceText: evidence.source,
      validationStatus: 'REVIEW_REQUIRED',
    };
  }

  return {
    ...base,
    value: normalized.value,
    schemaValue: normalized.value,
    grounded: true,
    confidence: evidence.confidence,
    confidenceAvailable: evidence.confidenceAvailable,
    sourcePage: evidence.page,
    sourceText: evidence.source,
    validationStatus: normalized.value == null ? 'NOT_FOUND' : decision.status,
  };
}

function groundLooseValue(value, pages, kind) {
  if (isBlank(value)) return { value: null, grounded: true };
  const evidence = findBestEvidence([value], pages);
  if (!evidence.found) return { value: null, grounded: false, suggested: value, evidence };
  const normalized = kind === 'money' ? normalizeMoney(value) : normalizeString(value);
  if (!normalized.ok) return { value, grounded: true, invalid: true, evidence };
  return { value: normalized.value, grounded: true, evidence };
}

function assembleItems(rawItems, pages) {
  if (rawItems == null) return { schemaItems: [], review: false, value: [] };
  if (!Array.isArray(rawItems)) {
    return { schemaItems: rawItems, review: true, value: rawItems };
  }

  let review = false;
  const schemaItems = rawItems.map((item) => {
    const source = item && typeof item === 'object' ? item : {};
    const description = groundLooseValue(source.description, pages, 'string');
    const quantity = groundLooseValue(source.quantity, pages, 'money');
    const unitPrice = groundLooseValue(source.unitPrice, pages, 'money');
    const amount = groundLooseValue(source.amount, pages, 'money');
    const parts = [description, quantity, unitPrice, amount];
    if (parts.some((part) => part.invalid || !part.grounded || (part.value != null && !part.evidence?.confidenceAvailable))) {
      review = true;
    }
    return {
      description: description.invalid ? description.value : description.value,
      quantity: quantity.invalid ? quantity.value : quantity.value,
      unitPrice: unitPrice.invalid ? unitPrice.value : unitPrice.value,
      amount: amount.invalid ? amount.value : amount.value,
    };
  });

  return { schemaItems, review, value: schemaItems };
}

function assembleTables(rawTables, pages) {
  if (rawTables == null) return [];
  if (!Array.isArray(rawTables)) {
    return [{
      tableId: 'table-001',
      page: 1,
      columns: [],
      rows: [],
      schemaValue: rawTables,
      reviewRequired: true,
      sourceNote: 'Model table output was not an array',
    }];
  }

  return rawTables.map((table, index) => {
    const columns = Array.isArray(table?.columns) ? table.columns.map((column) => String(column)) : table?.columns;
    const rows = Array.isArray(table?.rows) ? table.rows.map((row) => {
      if (!Array.isArray(row)) return row;
      return row.map((cell) => {
        if (isBlank(cell)) return null;
        const evidence = findBestEvidence([cell], pages);
        return evidence.found ? cell : null;
      });
    }) : table?.rows;

    const hadCells = Array.isArray(table?.rows) && table.rows.some((row) => Array.isArray(row) && row.some((cell) => !isBlank(cell)));
    const dropped = hadCells && JSON.stringify(rows) !== JSON.stringify(table.rows);
    return {
      tableId: typeof table?.tableId === 'string' ? table.tableId : `table-${String(index + 1).padStart(3, '0')}`,
      page: Number.isInteger(table?.page) ? table.page : 1,
      columns,
      rows,
      schemaValue: {
        tableId: typeof table?.tableId === 'string' ? table.tableId : `table-${String(index + 1).padStart(3, '0')}`,
        page: Number.isInteger(table?.page) ? table.page : 1,
        columns,
        rows,
      },
      reviewRequired: hadCells || dropped,
      sourceNote: dropped
        ? 'Some table cells were not found in the document and were removed'
        : hadCells
          ? 'Table cells have no OCR confidence and require review'
          : null,
    };
  });
}

function assembleEntities(rawEntities, pages) {
  if (!Array.isArray(rawEntities)) {
    return { schemaEntities: [], fields: [], reviewFields: [] };
  }
  const schemaEntities = [];
  const fields = [];
  rawEntities.forEach((entity, index) => {
    const type = entity?.type;
    const evidence = findBestEvidence([entity?.sourceQuote, entity?.value], pages);
    if (!evidence.found || isBlank(entity?.value)) return;
    const normalized = normalizeString(entity.value);
    if (!normalized.ok || normalized.value == null) return;
    const fieldName = `entity.${type || 'other'}.${index}`;
    const thresholds = {
      high: getConfig().highConfidenceThreshold,
      review: getConfig().reviewConfidenceThreshold,
    };
    const decision = decideConfidence(evidence.confidence, evidence.confidenceAvailable, thresholds);
    schemaEntities.push({
      type: ['person', 'organization', 'date', 'money', 'address', 'identifier', 'other'].includes(type) ? type : 'other',
      value: normalized.value,
      page: evidence.page,
    });
    fields.push({
      fieldName,
      value: normalized.value,
      schemaValue: normalized.value,
      suggestedValue: null,
      grounded: true,
      confidence: evidence.confidence,
      confidenceAvailable: evidence.confidenceAvailable,
      sourcePage: evidence.page,
      sourceText: evidence.source,
      validationStatus: decision.status,
    });
  });
  return { schemaEntities, fields };
}

export function assembleExtraction(modelJson, ocrPages) {
  const requestedType = typeof modelJson?.documentType === 'string' ? modelJson.documentType : 'generic';
  const documentType = KNOWN_DOCUMENT_TYPES.includes(requestedType) ? requestedType : 'generic';
  const kinds = FIELD_KINDS[documentType];
  const rawFields = modelJson?.fields && typeof modelJson.fields === 'object' && !Array.isArray(modelJson.fields)
    ? modelJson.fields
    : {};

  const names = kinds ? Object.keys(kinds) : Object.keys(rawFields);
  const fields = names.map((name) => scoreScalar(name, rawFields[name], ocrPages, kinds?.[name] || 'string'));
  const items = assembleItems(modelJson?.items, ocrPages);
  const tables = assembleTables(modelJson?.tables, ocrPages);
  const entities = assembleEntities(modelJson?.entities, ocrPages);

  if (items.review) {
    fields.push({
      fieldName: 'items',
      value: items.value,
      schemaValue: items.schemaItems,
      suggestedValue: null,
      grounded: true,
      confidence: null,
      confidenceAvailable: false,
      sourcePage: null,
      sourceText: null,
      validationStatus: 'REVIEW_REQUIRED',
    });
  }

  const schemaInput = {
    documentType,
    fields: Object.fromEntries(fields.filter((field) => field.fieldName !== 'items').map((field) => [field.fieldName, field.schemaValue])),
    items: items.schemaItems,
    entities: entities.schemaEntities,
    tables: tables.map((table) => table.schemaValue),
  };

  return {
    documentType,
    originalDocumentType: requestedType,
    fields: [...fields, ...entities.fields],
    tables,
    schemaInput,
    reviewFieldNames: [...fields, ...entities.fields]
      .filter((field) => needsHumanReview(field.validationStatus))
      .map((field) => field.fieldName),
  };
}
