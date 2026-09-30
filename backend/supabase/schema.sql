-- Folio IDP schema for Supabase PostgreSQL.
-- Run this in the Supabase SQL editor. The API uses the service-role key
-- on the server only. Row level security blocks the anon key.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  original_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes >= 0),
  storage_path text not null,
  status text not null,
  page_count integer,
  width integer,
  height integer,
  document_type text,
  extracted_payload jsonb,
  error_code text,
  error_message text,
  error_stage text,
  error_details jsonb not null default '[]'::jsonb,
  recoverable boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_user_id_idx on documents(user_id, created_at desc);
create index if not exists documents_status_idx on documents(status);

create table if not exists document_pages (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  width integer,
  height integer,
  image_path text,
  unique (document_id, page_number)
);

create table if not exists ocr_results (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  page integer not null check (page > 0),
  text text not null,
  confidence double precision,
  confidence_available boolean not null default false,
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ocr_results_document_idx on ocr_results(document_id, page);

create table if not exists layout_blocks (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  page integer not null,
  block_type text not null,
  text text,
  bbox jsonb,
  confidence double precision,
  confidence_available boolean not null default false
);

create index if not exists layout_blocks_document_idx on layout_blocks(document_id);

create table if not exists extracted_fields (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  field_name text not null,
  value jsonb,
  suggested_value jsonb,
  grounded boolean,
  confidence double precision,
  confidence_available boolean not null default false,
  source_page integer,
  source_text text,
  validation_status text not null,
  created_at timestamptz not null default now()
);

create index if not exists extracted_fields_document_idx on extracted_fields(document_id);

create table if not exists extracted_tables (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  table_id text not null,
  page integer not null,
  columns jsonb not null,
  rows jsonb not null,
  review_required boolean not null default true,
  source_note text,
  created_at timestamptz not null default now()
);

create table if not exists validation_results (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  schema_name text not null,
  passed boolean not null,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists review_tasks (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  user_id uuid not null references users(id),
  field_name text not null,
  value jsonb,
  suggested_value jsonb,
  grounded boolean,
  confidence double precision,
  confidence_available boolean not null default false,
  source_page integer,
  source_text text,
  validation_status text not null,
  status text not null,
  correction jsonb,
  reviewer_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists review_tasks_user_idx on review_tasks(user_id, status);

create table if not exists audit_logs (
  id uuid primary key,
  document_id uuid references documents(id) on delete cascade,
  user_id uuid,
  action text not null,
  stage text,
  status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_document_idx on audit_logs(document_id, created_at);

create table if not exists revoked_tokens (
  jti text primary key,
  expires_at timestamptz not null
);

alter table users enable row level security;
alter table documents enable row level security;
alter table document_pages enable row level security;
alter table ocr_results enable row level security;
alter table layout_blocks enable row level security;
alter table extracted_fields enable row level security;
alter table extracted_tables enable row level security;
alter table validation_results enable row level security;
alter table review_tasks enable row level security;
alter table audit_logs enable row level security;
alter table revoked_tokens enable row level security;
