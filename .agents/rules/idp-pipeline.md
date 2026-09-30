# IDP pipeline rule

Every document change must keep these gates. Do not skip one because a demo would look more complete.

1. File validation runs before processing. Reject empty files, unsupported types, MIME or extension mismatches, files over the configured size, unreadable images, and unreadable PDFs.
2. OCR output is validated before extraction. A failure is `OCR_ERROR`, the document stays recoverable when retry is safe, and no text is invented.
3. Do not invent document values. If a name, date, amount, identifier, entity, or table cell is not in the supplied text, store `null`.
4. Schema validation is mandatory. Zod checks invoice, receipt, identity, and generic payloads before approval. Invalid dates, types, nested objects, and arrays fail.
5. Confidence comes from OCR word scores. Unavailable confidence stays unavailable and is routed to review.
6. Human review is required below 0.70 confidence, for verification between 0.70 and 0.89, and whenever confidence cannot be calculated. Reviewers can edit, approve, or reject. Corrected data is validated again and is not stored as approved when validation fails.
7. Audit logging records upload, processing, OCR, extraction, schema validation, review, approval, and failure. Logs exclude passwords, JWTs, API keys, and service-role keys.
8. Authentication uses bcrypt password hashes and JWT sessions. Protected routes check the bearer token and the revocation list.
9. Tests cover validation, confidence routing, normalization, schemas, auth, uploads, and the review loop without paid external calls.
10. There are no silent failures. Each failed stage returns a classified error and records a safe message on the document.
