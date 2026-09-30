import path from 'path';
import sharp from 'sharp';
import { extractText, getDocumentProxy } from 'unpdf';
import { EXTENSION_TO_MIME } from '../../config/constants.js';
import { getConfig } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { detectMime, sanitizeFilename } from '../../utils/files.js';

async function inspectPdf(buffer) {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const extracted = await extractText(pdf, { mergePages: false });
    const pageCount = extracted.totalPages;
    if (!pageCount || pageCount < 1) {
      throw new Error('no pages');
    }
    return { pageCount };
  } catch {
    throw new AppError('FILE_VALIDATION_ERROR', 'The PDF could not be read', {
      status: 400,
      stage: 'ingestion',
      recoverable: false,
      details: [{ path: 'file', message: 'The PDF is missing, corrupted, or has no pages' }],
    });
  }
}

async function inspectImage(buffer) {
  try {
    const metadata = await sharp(buffer, { failOn: 'error' }).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('missing dimensions');
    }
    return { width: metadata.width, height: metadata.height, pageCount: 1 };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('FILE_VALIDATION_ERROR', 'The image could not be read', {
      status: 400,
      stage: 'ingestion',
      recoverable: false,
      details: [{ path: 'file', message: 'The image is corrupted or incomplete' }],
    });
  }
}

export async function validateUploadedFile({ buffer, originalName, mimeType }) {
  const config = getConfig();
  const safeName = sanitizeFilename(originalName);

  if (!buffer || buffer.length === 0) {
    throw new AppError('FILE_VALIDATION_ERROR', 'The file is empty', {
      status: 400,
      stage: 'ingestion',
      recoverable: false,
      details: [{ path: 'file', message: 'Choose a non-empty PDF, JPG, or PNG' }],
    });
  }

  if (buffer.length > config.maxUploadBytes) {
    throw new AppError('FILE_VALIDATION_ERROR', 'The file is too large', {
      status: 400,
      stage: 'ingestion',
      recoverable: false,
      details: [{ path: 'file', message: `Maximum size is ${config.maxUploadBytes} bytes` }],
    });
  }

  const extension = path.extname(safeName).toLowerCase();
  const expectedMime = EXTENSION_TO_MIME[extension];
  if (!expectedMime) {
    throw new AppError('FILE_VALIDATION_ERROR', 'This file type is not supported', {
      status: 400,
      stage: 'ingestion',
      recoverable: false,
      details: [{ path: 'file', message: 'Upload a PDF, JPG, JPEG, or PNG file' }],
    });
  }

  if (mimeType && !Object.values(EXTENSION_TO_MIME).includes(mimeType)) {
    throw new AppError('FILE_VALIDATION_ERROR', 'The file MIME type is not supported', {
      status: 400,
      stage: 'ingestion',
      recoverable: false,
      details: [{ path: 'file', message: `Received ${mimeType}` }],
    });
  }

  const detected = detectMime(buffer);
  if (!detected) {
    throw new AppError('FILE_VALIDATION_ERROR', 'The file content does not match a supported document', {
      status: 400,
      stage: 'ingestion',
      recoverable: false,
      details: [{ path: 'file', message: 'The file header is not a valid PDF, JPG, or PNG' }],
    });
  }

  if (detected !== expectedMime) {
    throw new AppError('FILE_VALIDATION_ERROR', 'The file extension does not match its contents', {
      status: 400,
      stage: 'ingestion',
      recoverable: false,
      details: [{ path: 'file', message: `Extension ${extension} does not match ${detected}` }],
    });
  }

  if (detected === 'application/pdf') {
    const pdf = await inspectPdf(buffer);
    if (pdf.pageCount > config.maxPdfPages) {
      throw new AppError('FILE_VALIDATION_ERROR', 'The PDF has too many pages', {
        status: 400,
        stage: 'ingestion',
        recoverable: false,
        details: [{ path: 'file', message: `Maximum page count is ${config.maxPdfPages}` }],
      });
    }
    return {
      originalName: safeName,
      extension,
      mimeType: detected,
      pageCount: pdf.pageCount,
      width: null,
      height: null,
      sizeBytes: buffer.length,
    };
  }

  const image = await inspectImage(buffer);
  return {
    originalName: safeName,
    extension,
    mimeType: detected,
    pageCount: image.pageCount,
    width: image.width,
    height: image.height,
    sizeBytes: buffer.length,
  };
}
