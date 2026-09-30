'use strict';

const fs = require('fs');
const path = require('path');
const { parentPort } = require('worker_threads');
const worker = require('tesseract.js/src/worker-script');
const { simd, relaxedSimd } = require('wasm-feature-detect');
const OEM = require('tesseract.js/src/constants/OEM');

const coreDir = path.resolve(__dirname, '../../tesseract-core');
let TesseractCore = null;

function factoryWithWasm(factory, moduleId, wasmName) {
  const beside = path.join(path.dirname(require.resolve(moduleId)), wasmName);
  if (fs.existsSync(beside)) return factory;
  const vendored = path.join(coreDir, wasmName);
  if (!fs.existsSync(vendored)) return factory;
  const wasmBinary = fs.readFileSync(vendored);
  return (options = {}) => factory({ ...options, wasmBinary });
}

async function getCore(oem, corePath, res) {
  if (TesseractCore === null) {
    const statusText = 'loading tesseract core';
    const simdSupport = await simd();
    const relaxedSimdSupport = await relaxedSimd();
    res.progress({ status: statusText, progress: 0 });
    if (relaxedSimdSupport) {
      if ([OEM.DEFAULT, OEM.LSTM_ONLY].includes(oem)) {
        TesseractCore = factoryWithWasm(require('tesseract.js-core/tesseract-core-relaxedsimd-lstm'), 'tesseract.js-core/tesseract-core-relaxedsimd-lstm', 'tesseract-core-relaxedsimd-lstm.wasm');
      } else {
        TesseractCore = factoryWithWasm(require('tesseract.js-core/tesseract-core-relaxedsimd'), 'tesseract.js-core/tesseract-core-relaxedsimd', 'tesseract-core-relaxedsimd.wasm');
      }
    } else if (simdSupport) {
      if ([OEM.DEFAULT, OEM.LSTM_ONLY].includes(oem)) {
        TesseractCore = factoryWithWasm(require('tesseract.js-core/tesseract-core-simd-lstm'), 'tesseract.js-core/tesseract-core-simd-lstm', 'tesseract-core-simd-lstm.wasm');
      } else {
        TesseractCore = factoryWithWasm(require('tesseract.js-core/tesseract-core-simd'), 'tesseract.js-core/tesseract-core-simd', 'tesseract-core-simd.wasm');
      }
    } else if ([OEM.DEFAULT, OEM.LSTM_ONLY].includes(oem)) {
      TesseractCore = factoryWithWasm(require('tesseract.js-core/tesseract-core-lstm'), 'tesseract.js-core/tesseract-core-lstm', 'tesseract-core-lstm.wasm');
    } else {
      TesseractCore = factoryWithWasm(require('tesseract.js-core/tesseract-core'), 'tesseract.js-core/tesseract-core', 'tesseract-core.wasm');
    }
    res.progress({ status: statusText, progress: 1 });
  }
  return TesseractCore;
}

worker.setAdapter({
  getCore,
  gunzip: require('tesseract.js/src/worker-script/node/gunzip'),
  fetch: global.fetch,
  ...require('tesseract.js/src/worker-script/node/cache'),
});

parentPort.on('message', (packet) => {
  worker.dispatchHandlers(packet, (obj) => parentPort.postMessage(obj));
});
