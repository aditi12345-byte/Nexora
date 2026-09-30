import { createClient } from '@supabase/supabase-js';
import { getConfig } from '../config/env.js';
import { AppError } from '../utils/errors.js';

function client() {
  const config = getConfig();
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function dbError(error) {
  console.error({ code: 'DATABASE_ERROR', message: error?.message || 'Supabase request failed' });
  return new AppError('DATABASE_ERROR', 'Database operation failed', {
    status: 500,
    stage: 'database',
    recoverable: true,
  });
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

function mapDocument(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    storagePath: row.storage_path,
    status: row.status,
    pageCount: row.page_count,
    width: row.width,
    height: row.height,
    documentType: row.document_type,
    extractedPayload: row.extracted_payload,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    errorStage: row.error_stage,
    errorDetails: row.error_details || [],
    recoverable: row.recoverable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function documentRow(doc) {
  return {
    id: doc.id,
    user_id: doc.userId,
    original_name: doc.originalName,
    mime_type: doc.mimeType,
    size_bytes: doc.sizeBytes,
    storage_path: doc.storagePath,
    status: doc.status,
    page_count: doc.pageCount,
    width: doc.width,
    height: doc.height,
    document_type: doc.documentType,
    extracted_payload: doc.extractedPayload,
    error_code: doc.errorCode,
    error_message: doc.errorMessage,
    error_stage: doc.errorStage,
    error_details: doc.errorDetails || [],
    recoverable: doc.recoverable,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

export function createSupabaseStore() {
  return {
    mode: 'supabase',
    async ping() {
      const { error } = await client().from('users').select('id').limit(1);
      if (error) throw dbError(error);
      return { ok: true, mode: 'supabase' };
    },
    async createUser(user) {
      const { data, error } = await client()
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          name: user.name,
          password_hash: user.passwordHash,
          created_at: user.createdAt,
        })
        .select('id, email, name, password_hash, created_at')
        .single();
      if (error) {
        if (error.code === '23505') return null;
        throw dbError(error);
      }
      return mapUser(data);
    },
    async findUserByEmail(email) {
      const { data, error } = await client().from('users').select('*').eq('email', email).maybeSingle();
      if (error) throw dbError(error);
      return mapUser(data);
    },
    async findUserById(id) {
      const { data, error } = await client().from('users').select('*').eq('id', id).maybeSingle();
      if (error) throw dbError(error);
      return mapUser(data);
    },
    async createDocument(document) {
      const { data, error } = await client().from('documents').insert(documentRow(document)).select('*').single();
      if (error) throw dbError(error);
      return mapDocument(data);
    },
    async updateDocument(id, patch) {
      const current = await this.getDocument(id);
      if (!current) return null;
      const next = { ...current, ...patch };
      const { data, error } = await client().from('documents').update(documentRow(next)).eq('id', id).select('*').single();
      if (error) throw dbError(error);
      return mapDocument(data);
    },
    async getDocument(id) {
      const { data, error } = await client().from('documents').select('*').eq('id', id).maybeSingle();
      if (error) throw dbError(error);
      return mapDocument(data);
    },
    async listDocuments(userId) {
      const { data, error } = await client().from('documents').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) throw dbError(error);
      return (data || []).map(mapDocument);
    },
    async deleteDocument(id) {
      const tables = ['review_tasks', 'validation_results', 'extracted_tables', 'extracted_fields', 'layout_blocks', 'ocr_results', 'document_pages', 'audit_logs'];
      for (const table of tables) {
        const { error } = await client().from(table).delete().eq('document_id', id);
        if (error) throw dbError(error);
      }
      const { error } = await client().from('documents').delete().eq('id', id);
      if (error) throw dbError(error);
    },
    async replacePages(documentId, pages) {
      const { error: deleteError } = await client().from('document_pages').delete().eq('document_id', documentId);
      if (deleteError) throw dbError(deleteError);
      if (!pages.length) return [];
      const rows = pages.map((page) => ({
        id: page.id,
        document_id: page.documentId,
        page_number: page.pageNumber,
        width: page.width,
        height: page.height,
        image_path: page.imagePath,
      }));
      const { error } = await client().from('document_pages').insert(rows);
      if (error) throw dbError(error);
      return pages;
    },
    async listPages(documentId) {
      const { data, error } = await client().from('document_pages').select('*').eq('document_id', documentId).order('page_number');
      if (error) throw dbError(error);
      return (data || []).map((row) => ({
        id: row.id,
        documentId: row.document_id,
        pageNumber: row.page_number,
        width: row.width,
        height: row.height,
        imagePath: row.image_path,
      }));
    },
    async replaceOcrResults(documentId, results) {
      const { error: deleteError } = await client().from('ocr_results').delete().eq('document_id', documentId);
      if (deleteError) throw dbError(deleteError);
      if (!results.length) return [];
      const rows = results.map((item) => ({
        id: item.id,
        document_id: item.documentId,
        page: item.page,
        text: item.text,
        confidence: item.confidence,
        confidence_available: item.confidenceAvailable,
        blocks: item.blocks,
        created_at: item.createdAt,
      }));
      const { error } = await client().from('ocr_results').insert(rows);
      if (error) throw dbError(error);
      return results;
    },
    async getOcrResults(documentId) {
      const { data, error } = await client().from('ocr_results').select('*').eq('document_id', documentId).order('page');
      if (error) throw dbError(error);
      return (data || []).map((row) => ({
        id: row.id,
        documentId: row.document_id,
        page: row.page,
        text: row.text,
        confidence: row.confidence,
        confidenceAvailable: row.confidence_available,
        blocks: row.blocks || [],
        createdAt: row.created_at,
      }));
    },
    async replaceLayoutBlocks(documentId, blocks) {
      const { error: deleteError } = await client().from('layout_blocks').delete().eq('document_id', documentId);
      if (deleteError) throw dbError(deleteError);
      if (!blocks.length) return [];
      const rows = blocks.map((block) => ({
        id: block.id,
        document_id: block.documentId,
        page: block.page,
        block_type: block.blockType,
        text: block.text,
        bbox: block.bbox,
        confidence: block.confidence,
        confidence_available: block.confidenceAvailable,
      }));
      const { error } = await client().from('layout_blocks').insert(rows);
      if (error) throw dbError(error);
      return blocks;
    },
    async getLayoutBlocks(documentId) {
      const { data, error } = await client().from('layout_blocks').select('*').eq('document_id', documentId);
      if (error) throw dbError(error);
      return (data || []).map((row) => ({
        id: row.id,
        documentId: row.document_id,
        page: row.page,
        blockType: row.block_type,
        text: row.text,
        bbox: row.bbox,
        confidence: row.confidence,
        confidenceAvailable: row.confidence_available,
      }));
    },
    async replaceFields(documentId, fields) {
      const { error: deleteError } = await client().from('extracted_fields').delete().eq('document_id', documentId);
      if (deleteError) throw dbError(deleteError);
      if (!fields.length) return [];
      const rows = fields.map((field) => ({
        id: field.id,
        document_id: field.documentId,
        field_name: field.fieldName,
        value: field.value,
        suggested_value: field.suggestedValue,
        grounded: field.grounded,
        confidence: field.confidence,
        confidence_available: field.confidenceAvailable,
        source_page: field.sourcePage,
        source_text: field.sourceText,
        validation_status: field.validationStatus,
        created_at: field.createdAt,
      }));
      const { error } = await client().from('extracted_fields').insert(rows);
      if (error) throw dbError(error);
      return fields;
    },
    async getFields(documentId) {
      const { data, error } = await client().from('extracted_fields').select('*').eq('document_id', documentId);
      if (error) throw dbError(error);
      return (data || []).map((row) => ({
        id: row.id,
        documentId: row.document_id,
        fieldName: row.field_name,
        value: row.value,
        suggestedValue: row.suggested_value,
        grounded: row.grounded,
        confidence: row.confidence,
        confidenceAvailable: row.confidence_available,
        sourcePage: row.source_page,
        sourceText: row.source_text,
        validationStatus: row.validation_status,
        createdAt: row.created_at,
      }));
    },
    async updateField(documentId, fieldName, patch) {
      const fields = await this.getFields(documentId);
      const current = fields.find((field) => field.fieldName === fieldName);
      if (!current) return null;
      const next = { ...current, ...patch };
      const { error } = await client().from('extracted_fields').update({
        value: next.value,
        suggested_value: next.suggestedValue,
        grounded: next.grounded,
        confidence: next.confidence,
        confidence_available: next.confidenceAvailable,
        source_page: next.sourcePage,
        source_text: next.sourceText,
        validation_status: next.validationStatus,
      }).eq('id', current.id);
      if (error) throw dbError(error);
      return next;
    },
    async replaceTables(documentId, tables) {
      const { error: deleteError } = await client().from('extracted_tables').delete().eq('document_id', documentId);
      if (deleteError) throw dbError(deleteError);
      if (!tables.length) return [];
      const rows = tables.map((table) => ({
        id: table.id,
        document_id: table.documentId,
        table_id: table.tableId,
        page: table.page,
        columns: table.columns,
        rows: table.rows,
        review_required: table.reviewRequired,
        source_note: table.sourceNote,
        created_at: table.createdAt,
      }));
      const { error } = await client().from('extracted_tables').insert(rows);
      if (error) throw dbError(error);
      return tables;
    },
    async getTables(documentId) {
      const { data, error } = await client().from('extracted_tables').select('*').eq('document_id', documentId);
      if (error) throw dbError(error);
      return (data || []).map((row) => ({
        id: row.id,
        documentId: row.document_id,
        tableId: row.table_id,
        page: row.page,
        columns: row.columns || [],
        rows: row.rows || [],
        reviewRequired: row.review_required,
        sourceNote: row.source_note,
        createdAt: row.created_at,
      }));
    },
    async updateTable(documentId, tableId, patch) {
      const tables = await this.getTables(documentId);
      const current = tables.find((table) => table.tableId === tableId);
      if (!current) return null;
      const next = { ...current, ...patch };
      const { error } = await client().from('extracted_tables').update({
        columns: next.columns,
        rows: next.rows,
        review_required: next.reviewRequired,
        source_note: next.sourceNote,
      }).eq('id', current.id);
      if (error) throw dbError(error);
      return next;
    },
    async addValidationResult(result) {
      const { error } = await client().from('validation_results').insert({
        id: result.id,
        document_id: result.documentId,
        schema_name: result.schemaName,
        passed: result.passed,
        errors: result.errors,
        created_at: result.createdAt,
      });
      if (error) throw dbError(error);
      return result;
    },
    async getValidationResults(documentId) {
      const { data, error } = await client().from('validation_results').select('*').eq('document_id', documentId).order('created_at');
      if (error) throw dbError(error);
      return (data || []).map((row) => ({
        id: row.id,
        documentId: row.document_id,
        schemaName: row.schema_name,
        passed: row.passed,
        errors: row.errors || [],
        createdAt: row.created_at,
      }));
    },
    async replaceReviewTasks(documentId, tasks) {
      const { error: deleteError } = await client().from('review_tasks').delete().eq('document_id', documentId);
      if (deleteError) throw dbError(deleteError);
      if (!tasks.length) return [];
      const rows = tasks.map((task) => ({
        id: task.id,
        document_id: task.documentId,
        user_id: task.userId,
        field_name: task.fieldName,
        value: task.value,
        suggested_value: task.suggestedValue,
        grounded: task.grounded,
        confidence: task.confidence,
        confidence_available: task.confidenceAvailable,
        source_page: task.sourcePage,
        source_text: task.sourceText,
        validation_status: task.validationStatus,
        status: task.status,
        correction: task.correction,
        reviewer_id: task.reviewerId,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
      }));
      const { error } = await client().from('review_tasks').insert(rows);
      if (error) throw dbError(error);
      return tasks;
    },
    async listReviewTasks({ userId, documentId, status }) {
      let query = client().from('review_tasks').select('*');
      if (userId) query = query.eq('user_id', userId);
      if (documentId) query = query.eq('document_id', documentId);
      if (status) query = query.eq('status', status);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw dbError(error);
      return (data || []).map(mapReview);
    },
    async getReviewTask(id) {
      const { data, error } = await client().from('review_tasks').select('*').eq('id', id).maybeSingle();
      if (error) throw dbError(error);
      return mapReview(data);
    },
    async updateReviewTask(id, patch) {
      const current = await this.getReviewTask(id);
      if (!current) return null;
      const next = { ...current, ...patch };
      const { error } = await client().from('review_tasks').update({
        value: next.value,
        suggested_value: next.suggestedValue,
        correction: next.correction,
        status: next.status,
        validation_status: next.validationStatus,
        reviewer_id: next.reviewerId,
        updated_at: next.updatedAt,
      }).eq('id', id);
      if (error) throw dbError(error);
      return next;
    },
    async addAudit(entry) {
      const { error } = await client().from('audit_logs').insert({
        id: entry.id,
        document_id: entry.documentId,
        user_id: entry.userId,
        action: entry.action,
        stage: entry.stage,
        status: entry.status,
        metadata: entry.metadata,
        created_at: entry.createdAt,
      });
      if (error) throw dbError(error);
      return entry;
    },
    async listAudit(documentId) {
      const { data, error } = await client().from('audit_logs').select('*').eq('document_id', documentId).order('created_at');
      if (error) throw dbError(error);
      return (data || []).map((row) => ({
        id: row.id,
        documentId: row.document_id,
        userId: row.user_id,
        action: row.action,
        stage: row.stage,
        status: row.status,
        metadata: row.metadata || {},
        createdAt: row.created_at,
      }));
    },
    async revokeToken(jti, expiresAt) {
      const { error } = await client().from('revoked_tokens').upsert({ jti, expires_at: expiresAt });
      if (error) throw dbError(error);
    },
    async isTokenRevoked(jti) {
      const { data, error } = await client().from('revoked_tokens').select('jti, expires_at').eq('jti', jti).maybeSingle();
      if (error) throw dbError(error);
      return Boolean(data && new Date(data.expires_at).getTime() > Date.now());
    },
  };
}

function mapReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    documentId: row.document_id,
    userId: row.user_id,
    fieldName: row.field_name,
    value: row.value,
    suggestedValue: row.suggested_value,
    grounded: row.grounded,
    confidence: row.confidence,
    confidenceAvailable: row.confidence_available,
    sourcePage: row.source_page,
    sourceText: row.source_text,
    validationStatus: row.validation_status,
    status: row.status,
    correction: row.correction,
    reviewerId: row.reviewer_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
