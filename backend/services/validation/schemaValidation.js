import { z } from 'zod';
import { isRealIsoDate } from '../extraction/normalize.js';

const nullableString = z.string().min(1).max(500).nullable();
const nullableDate = z.string().refine(isRealIsoDate, 'Invalid date').nullable();
const nullableMoney = z.number().finite().nullable();
const nullableCurrency = z.string().regex(/^[A-Z]{3}$/).nullable();

const itemSchema = z.object({
  description: nullableString,
  quantity: nullableMoney,
  unitPrice: nullableMoney,
  amount: nullableMoney,
}).strict();

const entitySchema = z.object({
  type: z.enum(['person', 'organization', 'date', 'money', 'address', 'identifier', 'other']),
  value: z.string().min(1).max(500),
  page: z.number().int().positive().nullable(),
}).strict();

export const tableSchema = z.object({
  tableId: z.string().min(1),
  page: z.number().int().positive(),
  columns: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
}).strict().superRefine((table, context) => {
  table.rows.forEach((row, index) => {
    if (row.length !== table.columns.length) {
      context.addIssue({
        code: 'custom',
        path: ['rows', index],
        message: `Row ${index + 1} does not match the column count`,
      });
    }
  });
});

function documentSchema(documentType, fieldShape) {
  return z.object({
    documentType: z.literal(documentType),
    fields: z.object(fieldShape).strict(),
    items: z.array(itemSchema),
    entities: z.array(entitySchema),
    tables: z.array(tableSchema),
  }).strict();
}

const invoiceSchema = documentSchema('invoice', {
  invoiceNumber: nullableString,
  invoiceDate: nullableDate,
  vendorName: nullableString,
  totalAmount: nullableMoney,
  currency: nullableCurrency,
});

const receiptSchema = documentSchema('receipt', {
  receiptNumber: nullableString,
  receiptDate: nullableDate,
  merchantName: nullableString,
  totalAmount: nullableMoney,
  currency: nullableCurrency,
});

const identitySchema = documentSchema('identity', {
  fullName: nullableString,
  dateOfBirth: nullableDate,
  documentNumber: nullableString,
  address: nullableString,
  expiryDate: nullableDate,
});

const genericSchema = z.object({
  documentType: z.literal('generic'),
  fields: z.record(z.string(), z.union([z.string().min(1).max(500), z.number().finite(), z.null()])),
  items: z.array(itemSchema),
  entities: z.array(entitySchema),
  tables: z.array(tableSchema),
}).strict();

export const SCHEMAS = {
  invoice: invoiceSchema,
  receipt: receiptSchema,
  identity: identitySchema,
  generic: genericSchema,
};

export function validateExtraction(payload) {
  const schema = SCHEMAS[payload?.documentType];
  if (!schema) {
    return {
      passed: false,
      schemaName: 'unknown',
      errors: [{ path: 'documentType', message: 'Unsupported document type' }],
    };
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return {
      passed: false,
      schemaName: payload.documentType,
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }
  return { passed: true, schemaName: payload.documentType, errors: [], data: parsed.data };
}

export function zodIssues(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

export { itemSchema, entitySchema };
