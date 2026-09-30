import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const configDir = path.dirname(fileURLToPath(import.meta.url));

let loaded = false;

export function loadEnv() {
  if (loaded) return;
  // Do not override variables already set by the shell or tests.
  dotenv.config({ path: path.resolve(configDir, '../.env') });
  dotenv.config({ path: path.resolve(configDir, '../../.env') });
  loaded = true;
}

export function getConfig() {
  loadEnv();

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const provider = (process.env.DATA_PROVIDER || 'auto').toLowerCase();

  let databaseMode = 'local';
  if (provider === 'supabase') databaseMode = 'supabase';
  else if (provider === 'local') databaseMode = 'local';
  else if (supabaseUrl && supabaseServiceKey) databaseMode = 'supabase';

  return {
    port: Number(process.env.PORT || 5000),
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    supabaseUrl,
    supabaseServiceKey,
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-flash-latest',
    geminiTimeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 30000),
    databaseMode,
    highConfidenceThreshold: Number(process.env.HIGH_CONFIDENCE_THRESHOLD || 0.9),
    reviewConfidenceThreshold: Number(process.env.REVIEW_CONFIDENCE_THRESHOLD || 0.7),
    maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024),
    maxPdfPages: Number(process.env.MAX_PDF_PAGES || 20),
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    dataDir: process.env.DATA_DIR || path.resolve(configDir, '../data'),
    uploadDir: process.env.UPLOAD_DIR || path.resolve(configDir, '../uploads'),
    nodeEnv: process.env.NODE_ENV || 'development',
    authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),
  };
}

export function assertRuntimeConfig() {
  const config = getConfig();
  const missing = [];

  if (!config.jwtSecret || config.jwtSecret.length < 16) {
    missing.push('JWT_SECRET (minimum 16 characters)');
  }
  if (config.databaseMode === 'supabase') {
    if (!config.supabaseUrl) missing.push('SUPABASE_URL');
    if (!config.supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!Number.isFinite(config.highConfidenceThreshold) || !Number.isFinite(config.reviewConfidenceThreshold)) {
    missing.push('confidence thresholds');
  }
  if (config.reviewConfidenceThreshold > config.highConfidenceThreshold) {
    missing.push('REVIEW_CONFIDENCE_THRESHOLD must be less than or equal to HIGH_CONFIDENCE_THRESHOLD');
  }

  if (missing.length) {
    const error = new Error(`Missing or invalid environment variables: ${missing.join(', ')}`);
    error.code = 'CONFIGURATION_ERROR';
    error.missing = missing;
    throw error;
  }

  return config;
}
