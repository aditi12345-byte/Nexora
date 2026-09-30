export const DOCUMENT_STATUSES = [
  'QUEUED',
  'VALIDATING',
  'PREPROCESSING',
  'OCR_PROCESSING',
  'EXTRACTING',
  'VALIDATING_DATA',
  'REVIEW_REQUIRED',
  'COMPLETED',
  'FAILED',
];

export const PROCESSING_STATUSES = [
  'VALIDATING',
  'PREPROCESSING',
  'OCR_PROCESSING',
  'EXTRACTING',
  'VALIDATING_DATA',
];

export const PROCESSABLE_STATUSES = [
  'QUEUED',
  'FAILED',
  'REVIEW_REQUIRED',
  'PREPROCESSING',
  'OCR_PROCESSING',
  'EXTRACTING',
  'VALIDATING',
  'VALIDATING_DATA',
];

export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export const EXTENSION_TO_MIME = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

export const AUDIT_ACTIONS = [
  'DOCUMENT_UPLOADED',
  'PROCESSING_STARTED',
  'VALIDATION_COMPLETED',
  'OCR_COMPLETED',
  'EXTRACTION_COMPLETED',
  'SCHEMA_VALIDATION_COMPLETED',
  'REVIEW_REQUESTED',
  'REVIEW_COMPLETED',
  'DOCUMENT_APPROVED',
  'PROCESSING_FAILED',
];

export const KNOWN_DOCUMENT_TYPES = ['invoice', 'receipt', 'identity', 'generic'];

export const FIELD_KINDS = {
  invoice: {
    invoiceNumber: 'string',
    invoiceDate: 'date',
    vendorName: 'string',
    totalAmount: 'money',
    currency: 'currency',
  },
  receipt: {
    receiptNumber: 'string',
    receiptDate: 'date',
    merchantName: 'string',
    totalAmount: 'money',
    currency: 'currency',
  },
  identity: {
    fullName: 'string',
    dateOfBirth: 'date',
    documentNumber: 'string',
    address: 'string',
    expiryDate: 'date',
  },
};
