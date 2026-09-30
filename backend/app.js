import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { getConfig } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import routes from './routes/index.js';
import { sendSuccess } from './utils/response.js';

export function isAllowedOrigin(origin, config) {
  if (!origin) return true;
  if (origin === config.frontendUrl) return true;
  const extras = String(process.env.FRONTEND_URLS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (extras.includes(origin)) return true;
  if (config.nodeEnv !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }
  try {
    const url = new URL(origin);
    if (url.protocol === 'https:' && url.hostname.endsWith('.vercel.app')) return true;
  } catch {
    return false;
  }
  return false;
}

export function createApp() {
  const config = getConfig();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin, config));
    },
  }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (req, res) => {
    sendSuccess(res, {
      name: 'Nexora API',
      health: '/api/health',
    }, 'Nexora API is running');
  });

  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
