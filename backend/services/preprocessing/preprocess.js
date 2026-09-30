import sharp from 'sharp';
import { extractText, getDocumentProxy, renderPageAsImage } from 'unpdf';
import { AppError } from '../../utils/errors.js';

async function preprocessImage(buffer) {
  try {
    const rotated = await sharp(buffer, { failOn: 'error' }).rotate().toBuffer();
    const output = await sharp(rotated)
      .grayscale()
      .normalize()
      .sharpen()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    const metadata = await sharp(output).metadata();
    return {
      pngBuffer: output,
      width: metadata.width || null,
      height: metadata.height || null,
      method: 'sharp',
    };
  } catch {
    throw new AppError('IMAGE_PREPROCESSING_ERROR', 'Image preprocessing failed', {
      status: 422,
      stage: 'preprocessing',
      recoverable: false,
    });
  }
}

async function preprocessPdf(buffer) {
  let pdf;
  let extracted;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buffer));
    extracted = await extractText(pdf, { mergePages: false });
  } catch {
    throw new AppError('IMAGE_PREPROCESSING_ERROR', 'The PDF could not be prepared for processing', {
      status: 422,
      stage: 'preprocessing',
      recoverable: false,
    });
  }

  const pages = [];
  for (let pageNumber = 1; pageNumber <= extracted.totalPages; pageNumber += 1) {
    const textLayer = String(extracted.text[pageNumber - 1] || '').trim();
    try {
      const rendered = await renderPageAsImage(pdf, pageNumber, {
        canvasImport: () => import('@napi-rs/canvas'),
        scale: 2,
      });
      const prepared = await preprocessImage(Buffer.from(rendered));
      pages.push({ page: pageNumber, textLayer: textLayer || null, ...prepared });
    } catch (error) {
      if (error instanceof AppError && error.code === 'IMAGE_PREPROCESSING_ERROR' && !textLayer) {
        throw error;
      }
      if (textLayer) {
        pages.push({
          page: pageNumber,
          pngBuffer: null,
          width: null,
          height: null,
          textLayer,
          method: 'pdf-text-layer',
        });
      } else {
        throw new AppError('IMAGE_PREPROCESSING_ERROR', `Could not render PDF page ${pageNumber}`, {
          status: 422,
          stage: 'preprocessing',
          recoverable: false,
        });
      }
    }
  }

  if (!pages.length) {
    throw new AppError('IMAGE_PREPROCESSING_ERROR', 'The PDF did not produce any pages', {
      status: 422,
      stage: 'preprocessing',
      recoverable: false,
    });
  }

  return { pages };
}

export async function preprocessDocument(buffer, mimeType) {
  if (mimeType === 'application/pdf') return preprocessPdf(buffer);
  const page = await preprocessImage(buffer);
  return { pages: [{ page: 1, textLayer: null, ...page }] };
}
