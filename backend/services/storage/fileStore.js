import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { getConfig } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';

const BUCKET = 'folio-documents';

function useRemote() {
  const config = getConfig();
  return config.databaseMode === 'supabase' && Boolean(config.supabaseUrl && config.supabaseServiceKey);
}

function client() {
  const config = getConfig();
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let bucketReady;

async function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const supabase = client();
      const existing = await supabase.storage.getBucket(BUCKET);
      if (existing.data) return;
      const created = await supabase.storage.createBucket(BUCKET, { public: false });
      if (created.error && !/already exists/i.test(created.error.message || '')) {
        throw created.error;
      }
    })().catch((error) => {
      bucketReady = null;
      throw error;
    });
  }
  return bucketReady;
}

export function isRemotePath(value) {
  return typeof value === 'string' && value.startsWith(`sb://${BUCKET}/`);
}

function storageError(error) {
  if (error instanceof AppError) return error;
  return new AppError('INGESTION_ERROR', 'The file could not be stored', {
    status: 500,
    stage: 'ingestion',
    recoverable: true,
  });
}

export async function saveBytes(key, buffer, contentType) {
  try {
    if (!useRemote()) {
      const full = path.join(getConfig().uploadDir, key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, buffer, { mode: 0o600 });
      return full;
    }
    await ensureBucket();
    const { error } = await client().storage.from(BUCKET).upload(key, buffer, {
      contentType: contentType || 'application/octet-stream',
      upsert: true,
    });
    if (error) throw error;
    return `sb://${BUCKET}/${key}`;
  } catch (error) {
    throw storageError(error);
  }
}

export async function readBytes(storedPath) {
  try {
    if (!isRemotePath(storedPath)) return fs.readFile(storedPath);
    const key = storedPath.slice(`sb://${BUCKET}/`.length);
    const { data, error } = await client().storage.from(BUCKET).download(key);
    if (error || !data) throw error || new Error('missing file');
    return Buffer.from(await data.arrayBuffer());
  } catch (error) {
    throw storageError(error);
  }
}

export async function removeBytes(storedPath) {
  if (!storedPath) return;
  try {
    if (!isRemotePath(storedPath)) {
      await fs.rm(storedPath, { force: true });
      return;
    }
    const key = storedPath.slice(`sb://${BUCKET}/`.length);
    await client().storage.from(BUCKET).remove([key]);
  } catch {
    // Deleting a missing file should not block document removal.
  }
}
