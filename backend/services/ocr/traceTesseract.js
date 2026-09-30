import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

// Static paths so the serverless file tracer ships the OCR engine with the API.
require.resolve('../../tesseract-core/tesseract-core.wasm');
require.resolve('../../tesseract-core/tesseract-core-lstm.wasm');
require.resolve('../../tesseract-core/tesseract-core-simd.wasm');
require.resolve('../../tesseract-core/tesseract-core-simd-lstm.wasm');
require.resolve('../../tesseract-core/tesseract-core-relaxedsimd.wasm');
require.resolve('../../tesseract-core/tesseract-core-relaxedsimd-lstm.wasm');
require('tesseract.js-core/tesseract-core');
require('tesseract.js-core/tesseract-core-lstm');
require('tesseract.js-core/tesseract-core-simd');
require('tesseract.js-core/tesseract-core-simd-lstm');
require('tesseract.js-core/tesseract-core-relaxedsimd');
require('tesseract.js-core/tesseract-core-relaxedsimd-lstm');
fs.readFileSync(path.join(here, 'tesseractWorker.cjs'));
