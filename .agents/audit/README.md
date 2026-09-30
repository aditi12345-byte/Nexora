# Audit notes

Runtime audit entries are stored in the database (`audit_logs`), not in this folder.

Each entry has a timestamp, document id, action, stage, status, and small metadata. The API never writes passwords, tokens, API keys, or full document text into that metadata.

This folder is for contributor notes about audit behavior. Do not drop uploaded documents or secrets here.
