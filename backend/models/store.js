import { getConfig } from '../config/env.js';
import { createLocalStore } from './localStore.js';
import { createSupabaseStore } from './supabaseStore.js';

let instance = null;

export function getStore() {
  if (!instance) {
    const config = getConfig();
    instance = config.databaseMode === 'supabase' ? createSupabaseStore() : createLocalStore();
  }
  return instance;
}

export function resetStoreForTests() {
  instance = null;
}
