# Folio

Folio is a hackathon-ready intelligent document processing app. You upload a PDF or image, the API checks the file, reads it with OCR, asks Gemini for structured JSON, and keeps a value only when that value appears in the document text. Low-confidence fields wait for a person to correct them.

## Problem

Teams still copy invoice numbers, dates, totals, and table rows out of PDFs by hand. Generic OCR dumps are hard to trust because a model can fill in a vendor or an amount that was never on the page.

## Solution

Folio runs one visible pipeline:

1. Upload and file validation
2. Preprocessing
3. OCR
4. Gemini document understanding
5. Grounding against the OCR text
6. Normalization and Zod schema validation
7. Confidence routing
8. Human review when needed
9. Persistence and audit history

A field is stored as `null` when it is missing. Folio does not invent a confidence score when the OCR engine does not provide one.

## Architecture

```text
React (Vite)  -->  Express API  -->  local JSON store or Supabase PostgreSQL
                         |
                         +--> sharp / unpdf
                         +--> tesseract.js
                         +--> Google Gemini
```

The browser never receives `JWT_SECRET`, `GEMINI_API_KEY`, or `SUPABASE_SERVICE_ROLE_KEY`.

## Technology stack

- Frontend: React, Vite, React Router, Tailwind CSS, Axios
- Backend: Node.js, Express, MVC layout
- Auth: bcrypt and JWT
- Data: Supabase PostgreSQL, with a local JSON store when Supabase is not configured
- AI: Google Gemini
- OCR: Tesseract.js
- Validation: Zod
- Tests: Node.js built-in test runner

## Folder structure

```text
frontend/     React application
backend/      Express API, services, tests, and supabase/schema.sql
tests/        Cross-cutting integration test
.agents/      Contributor rules
```

Backend flow: `routes` → `controllers` → `services` → `models`.

## Installation

Requirements: Node.js 20 or newer (Node 22 is what this project was tested with).

```bash
npm install --prefix backend
npm install --prefix frontend
cp .env.example .env
```

Edit `.env` and set `JWT_SECRET` to a random string of at least 16 characters. The API will not start without it.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Backend | Supabase project URL |
| `SUPABASE_ANON_KEY` | Unused by the app | Listed for Supabase setup only. Do not put it in React code. |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend only | Server access to Postgres |
| `JWT_SECRET` | Backend only | Signs session tokens |
| `GEMINI_API_KEY` | Backend only | Gemini extraction |
| `PORT` | Backend | API port, default `5000` |
| `FRONTEND_URL` | Backend | CORS origin in production |

Optional: `GEMINI_MODEL` (default `gemini-flash-latest`), `DATA_PROVIDER` (`auto`, `local`, or `supabase`), `HIGH_CONFIDENCE_THRESHOLD` (`0.90`), `REVIEW_CONFIDENCE_THRESHOLD` (`0.70`), `MAX_UPLOAD_BYTES`, `MAX_PDF_PAGES`, `VITE_API_URL`.

`DATA_PROVIDER=auto` uses Supabase when both URL and service-role key are present. Otherwise it uses `backend/data/store.json` and `/api/health` reports `database.mode` as `local`. That local mode is real storage for development, not a fake “database healthy” flag.

The frontend reads `VITE_API_URL` at build time. Leave it empty in local development so Vite proxies `/api` to the backend.

## Supabase setup

1. Create a Supabase project.
2. Open the SQL editor and run `backend/supabase/schema.sql`.
3. Put the project URL and service-role key in `.env`.
4. Leave `DATA_PROVIDER` unset or set it to `supabase`.

Row level security is enabled and no anon policies are granted. The API uses the service-role key from the server. Do not ship that key to the browser. If the tables are missing, `/api/health` reports the database as `error` instead of `ok`.

## Gemini setup

1. Create an API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Set `GEMINI_API_KEY` in `.env`.
3. Restart the API.

Without the key, upload, validation, and OCR still run. The extraction stage stops with `CONFIGURATION_ERROR` and the document is marked `FAILED`. No fields are fabricated. Set the key and use Retry on the document page.

The default model is `gemini-3.1-flash-lite`. If that model is busy or rejects the request, the API tries `gemini-flash-lite-latest` and then `gemini-3.5-flash`. Override the first choice with `GEMINI_MODEL`.

## Local development

The Vite server in this project listens on port **5184** so it does not collide with other local apps. The API listens on port **5000**.

```bash
npm run dev:backend
npm run dev:frontend
```

Open [http://127.0.0.1:5184](http://127.0.0.1:5184).

Create an account, upload a clear PNG or a digital PDF, and open the document while it moves through `PREPROCESSING`, `OCR_PROCESSING`, `EXTRACTING`, and `VALIDATING_DATA`. Finished documents land on `COMPLETED`, `REVIEW_REQUIRED`, or `FAILED`.

Supported uploads: PDF, JPG, JPEG, PNG. Default limit: 10 MB and 20 PDF pages.

## Testing

```bash
npm test
```

The suite covers file validation, confidence routing, normalization, schema validation, auth, upload rejection, the review loop, and a grounded extraction path. Gemini is not called. One smoke test renders a sample image and runs Tesseract.js so OCR confidence is checked against the real engine.

## Build

```bash
npm run build:frontend
npm --prefix backend start
```

The frontend build writes `frontend/dist`.

## Deployment

- Frontend: Vercel. Set the project root to `frontend`. Add `VITE_API_URL` as the public Render URL, for example `https://your-api.onrender.com`. `frontend/vercel.json` rewrites client routes to `index.html`.
- Backend: Render. `render.yaml` points at `backend` and `npm start`. Set the same environment variables as `.env.example`, plus a strong `JWT_SECRET`. Set `FRONTEND_URL` to the Vercel origin and `NODE_ENV=production`.
- Database: Supabase, using the schema file above.

On Render, uploaded files live on the instance disk. The MVP does not move them to object storage, so a new instance does not keep old uploads. Document rows in Supabase remain.

Check this list before deploying:

- `npm test` passes
- `npm run build:frontend` passes
- the API boots and `GET /api/health` returns `"status": "ok"` when the database check passes
- CORS allows the real frontend origin
- no `.env` file is committed

## Troubleshooting

- `CONFIGURATION_ERROR` on startup: `JWT_SECRET` is missing or shorter than 16 characters.
- Extraction fails with `CONFIGURATION_ERROR`: add `GEMINI_API_KEY`.
- Health shows `database.status: error`: the Supabase URL or key is wrong, or `schema.sql` has not been run.
- OCR text is empty: use a higher-contrast image. Scanned PDFs are rendered and OCR'd when page rendering works. If rendering fails and the PDF has a text layer, Folio uses that text and marks confidence unavailable, which sends extracted fields to review.
- A document stays on `OCR_PROCESSING`: the API ships `backend/ocr-data/eng.traineddata` and `backend/tesseract-core` so Tesseract does not download an engine at runtime. If the host stops the request before it can save a result, the next document or dashboard load marks that job `FAILED` with a retry message. Retry runs OCR again. It does not invent text.
- A value you expected is null: it was not found in the OCR text. Check the OCR page, then correct it in Review. The correction still has to match the schema.

## Limitations

- English OCR only.
- Gemini is prompted with OCR text, not the original pixels.
- Table cells do not get a reliable per-cell confidence score, so non-empty tables require review.
- Digital PDF text without a rendered image has no OCR confidence.
- Local mode is a single JSON file and is meant for development and demos.
- There is no refresh-token rotation beyond an 8 hour JWT and a logout revocation list.

## Future improvements

- Store uploads in Supabase Storage.
- Add more document schemas.
- Show side-by-side PDF rendering for text-only PDFs.
- Let reviewers edit table cells in a grid instead of JSON.
