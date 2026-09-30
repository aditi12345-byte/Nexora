import { createApp } from './app.js';
import { assertRuntimeConfig, getConfig } from './config/env.js';

try {
  assertRuntimeConfig();
} catch (error) {
  console.error(JSON.stringify({
    success: false,
    error: {
      code: 'CONFIGURATION_ERROR',
      message: error.message,
      details: error.missing || [],
    },
  }));
  process.exit(1);
}

const config = getConfig();
const app = createApp();
app.listen(config.port, '0.0.0.0', () => {
  console.log(`Folio API listening on port ${config.port}`);
});
