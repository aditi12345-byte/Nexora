import { getConfig } from '../config/env.js';
import { getStore } from '../models/store.js';

export async function health(req, res) {
  const config = getConfig();
  let database = { mode: config.databaseMode, status: 'ok' };
  try {
    await getStore().ping();
  } catch (error) {
    database = {
      mode: config.databaseMode,
      status: 'error',
      message: error.code === 'DATABASE_ERROR' ? error.message : 'Database check failed',
    };
  }

  const gemini = config.geminiApiKey
    ? { configured: true, status: 'configured' }
    : { configured: false, status: 'unconfigured' };

  const degraded = database.status !== 'ok';
  res.status(degraded ? 503 : 200).json({
    status: degraded ? 'degraded' : 'ok',
    services: {
      api: 'ok',
      database,
      gemini,
      ocr: { engine: 'tesseract.js', status: 'available' },
    },
  });
}
