'use strict';

const fs = require('fs');
const path = require('path');
const { simd, relaxedSimd } = require('wasm-feature-detect');
const OEM = require('../../constants/OEM');

let TesseractCore = null;

function factoryWithWasm(moduleId, wasmName) {
  const factory = require(moduleId);
  const beside = path.join(path.dirname(require.resolve(moduleId)), wasmName);
  if (fs.existsSync(beside)) return factory;
  const roots = [
    path.resolve(__dirname, '../../../../../tesseract-core'),
    path.resolve(process.cwd(), 'tesseract-core'),
  ];
  const vendored = roots.map((root) => path.join(root, wasmName)).find((file) => fs.existsSync(file));
  if (!vendored) return factory;
  const wasmBinary = fs.readFileSync(vendored);
  return (options = {}) => factory({ ...options, wasmBinary });
}

module.exports = async (oem, _, res) => {
  if (TesseractCore === null) {
    const statusText = 'loading tesseract core';
    const simdSupport = await simd();
    const relaxedSimdSupport = await relaxedSimd();
    res.progress({ status: statusText, progress: 0 });
    if (relaxedSimdSupport) {
      if ([OEM.DEFAULT, OEM.LSTM_ONLY].includes(oem)) {
        TesseractCore = factoryWithWasm('tesseract.js-core/tesseract-core-relaxedsimd-lstm', 'tesseract-core-relaxedsimd-lstm.wasm');
      } else {
        TesseractCore = factoryWithWasm('tesseract.js-core/tesseract-core-relaxedsimd', 'tesseract-core-relaxedsimd.wasm');
      }
    } else if (simdSupport) {
      if ([OEM.DEFAULT, OEM.LSTM_ONLY].includes(oem)) {
        TesseractCore = factoryWithWasm('tesseract.js-core/tesseract-core-simd-lstm', 'tesseract-core-simd-lstm.wasm');
      } else {
        TesseractCore = factoryWithWasm('tesseract.js-core/tesseract-core-simd', 'tesseract-core-simd.wasm');
      }
    } else if ([OEM.DEFAULT, OEM.LSTM_ONLY].includes(oem)) {
      TesseractCore = factoryWithWasm('tesseract.js-core/tesseract-core-lstm', 'tesseract-core-lstm.wasm');
    } else {
      TesseractCore = factoryWithWasm('tesseract.js-core/tesseract-core', 'tesseract-core.wasm');
    }
    res.progress({ status: statusText, progress: 1 });
  }
  return TesseractCore;
};
