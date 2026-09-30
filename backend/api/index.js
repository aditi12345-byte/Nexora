import { createApp } from '../app.js';
import { assertRuntimeConfig } from '../config/env.js';

let app;

function configurationFailure(res, error) {
  res.status(500).json({
    success: false,
    error: {
      code: 'CONFIGURATION_ERROR',
      message: error.message,
      details: error.missing || [],
    },
  });
}

function requestPath(req) {
  const url = req.url || '/';
  if (url.startsWith('/api/') && !url.startsWith('/api/index')) return url;
  const forwarded = req.headers['x-forwarded-uri']
    || req.headers['x-vercel-original-url']
    || req.headers['x-invoke-path']
    || '';
  if (typeof forwarded === 'string' && forwarded.startsWith('/api')) return forwarded;
  return url;
}

export default function handler(req, res) {
  try {
    if (!app) {
      assertRuntimeConfig();
      app = createApp();
    }
  } catch (error) {
    configurationFailure(res, error);
    return;
  }

  req.url = requestPath(req);
  return app(req, res);
}
