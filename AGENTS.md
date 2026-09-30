# Folio agent guide

Folio is a two-app Intelligent Document Processing project. The React client lives in `frontend/`. The Express API lives in `backend/`. Do not merge them into one application, and do not add another top-level app.

## Architecture rules

- Routes call controllers. Controllers validate input and shape responses. Business logic stays in `backend/services`.
- Persistence goes through `backend/models`. Use Supabase when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set. Otherwise use the local JSON store and say so in `/api/health`.
- The processing pipeline is `backend/services/pipeline/processDocument.js`. Keep stage order intact.

## Coding rules

- Prefer small modules and plain names.
- Do not add queues, Redis, or extra services for this MVP.
- Match the existing error shape. Never return stack traces to clients.

## Security rules

- Hash passwords with bcrypt. Never store or return plaintext passwords or password hashes.
- Protect document, review, and audit routes with JWT middleware.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, and `GEMINI_API_KEY` on the server only.
- Validate upload extension, MIME type, magic bytes, size, and readability before saving a file.
- Do not commit `.env` files or the `uploads/` directory.

## IDP pipeline rules

- Validate the file before preprocessing, OCR, or extraction.
- OCR confidence must come from the engine. If the engine does not provide a score, store `confidenceAvailable: false`. Do not invent a number.
- Gemini may only supply candidates. Keep a value only when it is present in the OCR text. Otherwise store `null` and send the suggestion to review.
- Run Zod schema validation before a result is treated as approved.
- Confidence at or above 0.90 can be auto-approved when the schema passes. From 0.70 to 0.89 requires verification. Below 0.70, or when confidence is unavailable, requires human review.
- A reviewer correction is approved only after schema validation passes.
- Write an audit event for each important stage. Never put secrets in audit metadata.

## Testing rules

- Unit tests must not call paid APIs. Mock Gemini and, except for the OCR smoke test, mock Tesseract.
- Do not delete a failing test to make the suite pass.
- Run `npm test` from the repository root.

## Git rules

- Do not rewrite history.
- Do not commit secrets, `node_modules`, build output, or uploaded documents.

## Environment rules

- Required to boot the API: `JWT_SECRET` (at least 16 characters).
- Required for Supabase mode: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Required for live extraction: `GEMINI_API_KEY`.
- If a required variable is missing, return `CONFIGURATION_ERROR`. Do not pretend the service is healthy.

## Error handling rules

- Classify failures with the project error codes (`FILE_VALIDATION_ERROR`, `OCR_ERROR`, `SCHEMA_VALIDATION_ERROR`, and the rest in `backend/utils/errors.js`).
- A failed stage marks the document `FAILED` and keeps earlier successful stage output when it is safe, especially OCR text.
- No silent `catch` blocks on the pipeline.

## No-fake-data rules

- Do not invent field values, table cells, bounding boxes, or confidence scores.
- Missing information is `null` or `NOT_FOUND` before normalization, then `null` after normalization.
- Ungrounded model output is not persisted as the field value.

## Phase-gate rules

- Finish and test the current change before expanding scope.
- When a command fails, read the full error, fix the smallest cause, and run that command again.
- If the same error happens three times, stop and inspect versions, imports, and configuration before changing more code.
