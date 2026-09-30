import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { bootApp, registerAndLogin } from './helpers.js';

test('registration hashes passwords and does not return them', async () => {
  const ctx = await bootApp();
  try {
    const response = await request(ctx.app).post('/api/auth/register').send({
      name: 'Ada Lovelace',
      email: 'Ada@Folio.test',
      password: 'correct-horse',
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.user.email, 'ada@folio.test');
    assert.equal(response.body.data.user.passwordHash, undefined);
    assert.equal(JSON.stringify(response.body).includes('correct-horse'), false);

    const { getStore } = await import('../models/store.js');
    const stored = await getStore().findUserByEmail('ada@folio.test');
    assert.notEqual(stored.passwordHash, 'correct-horse');
    assert.equal(await bcrypt.compare('correct-horse', stored.passwordHash), true);
  } finally {
    await ctx.cleanup();
  }
});

test('login succeeds and invalid or missing credentials fail', async () => {
  const ctx = await bootApp();
  try {
    await registerAndLogin(ctx.app);
    const bad = await request(ctx.app).post('/api/auth/login').send({
      email: 'ada@folio.test',
      password: 'wrong-password',
    });
    assert.equal(bad.status, 401);
    assert.equal(bad.body.error.code, 'AUTHENTICATION_ERROR');

    const missing = await request(ctx.app).post('/api/auth/login').send({ email: 'ada@folio.test' });
    assert.equal(missing.status, 400);
  } finally {
    await ctx.cleanup();
  }
});

test('protected routes reject missing and logged out tokens', async () => {
  const ctx = await bootApp();
  try {
    const open = await request(ctx.app).get('/api/documents');
    assert.equal(open.status, 401);

    const { token } = await registerAndLogin(ctx.app);
    const allowed = await request(ctx.app).get('/api/documents').set('Authorization', `Bearer ${token}`);
    assert.equal(allowed.status, 200);

    const loggedOut = await request(ctx.app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    assert.equal(loggedOut.status, 200);
    const after = await request(ctx.app).get('/api/documents').set('Authorization', `Bearer ${token}`);
    assert.equal(after.status, 401);
  } finally {
    await ctx.cleanup();
  }
});

test('health reports local database status without pretending Gemini is configured', async () => {
  const ctx = await bootApp();
  try {
    const response = await request(ctx.app).get('/api/health');
    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'ok');
    assert.equal(response.body.services.database.mode, 'local');
    assert.equal(response.body.services.database.status, 'ok');
    assert.equal(response.body.services.gemini.configured, false);
  } finally {
    await ctx.cleanup();
  }
});
