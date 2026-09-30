import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'vendor', 'getCore.js');
const target = path.join(root, 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'getCore.js');

if (!fs.existsSync(target)) {
  console.error('tesseract.js is not installed; skip OCR worker patch');
  process.exit(0);
}

fs.copyFileSync(source, target);
