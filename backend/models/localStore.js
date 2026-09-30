import fs from 'fs/promises';
import path from 'path';
import { getConfig } from '../config/env.js';

function emptyState() {
  return {
    users: [],
    documents: [],
    documentPages: [],
    ocrResults: [],
    layoutBlocks: [],
    extractedFields: [],
    extractedTables: [],
    validationResults: [],
    reviewTasks: [],
    auditLogs: [],
    revokedTokens: [],
  };
}

export function createLocalStore() {
  const filePath = path.join(getConfig().dataDir, 'store.json');
  let queue = Promise.resolve();

  async function read() {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return { ...emptyState(), ...JSON.parse(raw) };
    } catch (error) {
      if (error.code === 'ENOENT') return emptyState();
      throw error;
    }
  }

  function update(mutator) {
    const run = queue.then(async () => {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const state = await read();
      const result = await mutator(state);
      await fs.writeFile(filePath, JSON.stringify(state, null, 2));
      return result;
    });
    queue = run.then(() => undefined, () => undefined);
    return run;
  }

  return {
    mode: 'local',
    async ping() {
      await fs.mkdir(getConfig().dataDir, { recursive: true });
      await read();
      return { ok: true, mode: 'local' };
    },
    createUser(user) {
      return update((state) => {
        if (state.users.some((item) => item.email === user.email)) return null;
        state.users.push(user);
        return user;
      });
    },
    findUserByEmail(email) {
      return update(async (state) => state.users.find((item) => item.email === email) || null);
    },
    findUserById(id) {
      return update(async (state) => state.users.find((item) => item.id === id) || null);
    },
    createDocument(document) {
      return update((state) => {
        state.documents.push(document);
        return document;
      });
    },
    updateDocument(id, patch) {
      return update((state) => {
        const index = state.documents.findIndex((item) => item.id === id);
        if (index === -1) return null;
        state.documents[index] = { ...state.documents[index], ...patch };
        return state.documents[index];
      });
    },
    getDocument(id) {
      return update(async (state) => state.documents.find((item) => item.id === id) || null);
    },
    listDocuments(userId) {
      return update(async (state) => state.documents
        .filter((item) => item.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },
    deleteDocument(id) {
      return update((state) => {
        const remove = (list) => list.filter((item) => item.documentId !== id);
        state.documents = state.documents.filter((item) => item.id !== id);
        state.documentPages = remove(state.documentPages);
        state.ocrResults = remove(state.ocrResults);
        state.layoutBlocks = remove(state.layoutBlocks);
        state.extractedFields = remove(state.extractedFields);
        state.extractedTables = remove(state.extractedTables);
        state.validationResults = remove(state.validationResults);
        state.reviewTasks = remove(state.reviewTasks);
        state.auditLogs = state.auditLogs.filter((item) => item.documentId !== id);
      });
    },
    replacePages(documentId, pages) {
      return update((state) => {
        state.documentPages = state.documentPages.filter((item) => item.documentId !== documentId);
        state.documentPages.push(...pages);
        return pages;
      });
    },
    listPages(documentId) {
      return update(async (state) => state.documentPages
        .filter((item) => item.documentId === documentId)
        .sort((a, b) => a.pageNumber - b.pageNumber));
    },
    replaceOcrResults(documentId, results) {
      return update((state) => {
        state.ocrResults = state.ocrResults.filter((item) => item.documentId !== documentId);
        state.ocrResults.push(...results);
        return results;
      });
    },
    getOcrResults(documentId) {
      return update(async (state) => state.ocrResults
        .filter((item) => item.documentId === documentId)
        .sort((a, b) => a.page - b.page));
    },
    replaceLayoutBlocks(documentId, blocks) {
      return update((state) => {
        state.layoutBlocks = state.layoutBlocks.filter((item) => item.documentId !== documentId);
        state.layoutBlocks.push(...blocks);
        return blocks;
      });
    },
    getLayoutBlocks(documentId) {
      return update(async (state) => state.layoutBlocks.filter((item) => item.documentId === documentId));
    },
    replaceFields(documentId, fields) {
      return update((state) => {
        state.extractedFields = state.extractedFields.filter((item) => item.documentId !== documentId);
        state.extractedFields.push(...fields);
        return fields;
      });
    },
    getFields(documentId) {
      return update(async (state) => state.extractedFields.filter((item) => item.documentId === documentId));
    },
    updateField(documentId, fieldName, patch) {
      return update((state) => {
        const field = state.extractedFields.find((item) => item.documentId === documentId && item.fieldName === fieldName);
        if (!field) return null;
        Object.assign(field, patch);
        return field;
      });
    },
    replaceTables(documentId, tables) {
      return update((state) => {
        state.extractedTables = state.extractedTables.filter((item) => item.documentId !== documentId);
        state.extractedTables.push(...tables);
        return tables;
      });
    },
    getTables(documentId) {
      return update(async (state) => state.extractedTables.filter((item) => item.documentId === documentId));
    },
    updateTable(documentId, tableId, patch) {
      return update((state) => {
        const table = state.extractedTables.find((item) => item.documentId === documentId && item.tableId === tableId);
        if (!table) return null;
        Object.assign(table, patch);
        return table;
      });
    },
    addValidationResult(result) {
      return update((state) => {
        state.validationResults.push(result);
        return result;
      });
    },
    getValidationResults(documentId) {
      return update(async (state) => state.validationResults.filter((item) => item.documentId === documentId));
    },
    replaceReviewTasks(documentId, tasks) {
      return update((state) => {
        state.reviewTasks = state.reviewTasks.filter((item) => item.documentId !== documentId);
        state.reviewTasks.push(...tasks);
        return tasks;
      });
    },
    listReviewTasks({ userId, documentId, status }) {
      return update(async (state) => state.reviewTasks.filter((item) => {
        if (userId && item.userId !== userId) return false;
        if (documentId && item.documentId !== documentId) return false;
        if (status && item.status !== status) return false;
        return true;
      }));
    },
    getReviewTask(id) {
      return update(async (state) => state.reviewTasks.find((item) => item.id === id) || null);
    },
    updateReviewTask(id, patch) {
      return update((state) => {
        const task = state.reviewTasks.find((item) => item.id === id);
        if (!task) return null;
        Object.assign(task, patch);
        return task;
      });
    },
    addAudit(entry) {
      return update((state) => {
        state.auditLogs.push(entry);
        return entry;
      });
    },
    listAudit(documentId) {
      return update(async (state) => state.auditLogs
        .filter((item) => item.documentId === documentId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    },
    revokeToken(jti, expiresAt) {
      return update((state) => {
        state.revokedTokens = state.revokedTokens.filter((item) => item.expiresAt > new Date().toISOString());
        state.revokedTokens.push({ jti, expiresAt });
      });
    },
    isTokenRevoked(jti) {
      return update(async (state) => state.revokedTokens.some((item) => item.jti === jti && item.expiresAt > new Date().toISOString()));
    },
  };
}
