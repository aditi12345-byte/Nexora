import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import request from 'supertest';

export async function bootApp(overrides = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'folio-'));
  process.env.JWT_SECRET = overrides.JWT_SECRET || 'test-jwt-secret-value-123';
  process.env.DATA_PROVIDER = 'local';
  process.env.DATA_DIR = path.join(dir, 'data');
  process.env.UPLOAD_DIR = path.join(dir, 'uploads');
  process.env.NODE_ENV = 'test';
  process.env.GEMINI_API_KEY = overrides.GEMINI_API_KEY ?? '';
  process.env.SYNC_PROCESSING = 'true';
  process.env.MAX_UPLOAD_BYTES = String(overrides.MAX_UPLOAD_BYTES || 10 * 1024 * 1024);
  process.env.SUPABASE_URL = '';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';

  const { resetStoreForTests } = await import('../models/store.js');
  resetStoreForTests();
  const { createApp } = await import('../app.js');
  return {
    app: createApp(),
    dir,
    async cleanup() {
      resetStoreForTests();
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

export async function registerAndLogin(app, email = 'ada@folio.test') {
  const registered = await request(app).post('/api/auth/register').send({
    name: 'Ada Lovelace',
    email,
    password: 'correct-horse',
  });
  const loggedIn = await request(app).post('/api/auth/login').send({
    email,
    password: 'correct-horse',
  });
  return { registered, loggedIn, token: loggedIn.body?.data?.token, user: loggedIn.body?.data?.user };
}
