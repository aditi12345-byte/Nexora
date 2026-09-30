import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { getConfig } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import routes from './routes/index.js';
import { sendSuccess } from './utils/response.js';

export function createApp() {
  const config = getConfig();
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (origin === config.frontendUrl) return callback(null, true);
      if (config.nodeEnv !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
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
