import { Link, useParams } from 'react-router-dom';
import Alert from '../components/Alert';
import StatusBadge from '../components/StatusBadge';
import { useDocument } from '../hooks/useDocument';
import api, { errorMessage } from '../services/api';
import { formatBytes, formatWhen } from '../utils/format';
import { useState } from 'react';

export default function DocumentDetailsPage() {
  const { id } = useParams();
  const { document, pages, loading, error } = useDocument(id);
  const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState(false);

  async function retry() {
    setPending(true);
    setActionError('');
    try {
      await api.post(`/api/documents/${id}/process`);
      window.location.reload();
    } catch (err) {
      setActionError(errorMessage(err));
      setPending(false);
    }
  }

  if (loading) return <p>Loading document…</p>;
  if (error) return <Alert>{error}</Alert>;
  if (!document) return <Alert>Document not found.</Alert>;

  const links = [
    [`/documents/${id}/ocr`, 'OCR results'],
    [`/documents/${id}/extraction`, 'Extracted data'],
    [`/documents/${id}/tables`, 'Tables'],
    [`/review?documentId=${id}`, 'Review'],
    [`/audit/${id}`, 'Audit history'],
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-stone-500"><Link className="underline" to="/documents">Documents</Link></p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-4xl">{document.originalName}</h1>
        <StatusBadge status={document.status} />
      </div>
      <dl className="mt-6 grid gap-3 rounded-xl border border-stone-200 bg-white p-4 text-sm sm:grid-cols-2">
        <div><dt className="text-stone-500">Type</dt><dd>{document.mimeType}</dd></div>
        <div><dt className="text-stone-500">Size</dt><dd>{formatBytes(document.sizeBytes)}</dd></div>
        <div><dt className="text-stone-500">Pages</dt><dd>{document.pageCount || pages.length || '—'}</dd></div>
        <div><dt className="text-stone-500">Document class</dt><dd>{document.documentType || 'Not classified yet'}</dd></div>
        <div><dt className="text-stone-500">Added</dt><dd>{formatWhen(document.createdAt)}</dd></div>
        <div><dt className="text-stone-500">Updated</dt><dd>{formatWhen(document.updatedAt)}</dd></div>
      </dl>
      {document.errorMessage && (
        <div className="mt-4">
          <Alert>
            <p>{document.errorMessage}</p>
            {document.errorCode && <p className="mt-1 text-xs">Code: {document.errorCode}{document.recoverable ? ' · retry is available' : ''}</p>}
            {document.errorDetails?.length > 0 && (
              <ul className="mt-2 list-disc pl-4">
                {document.errorDetails.map((detail, index) => (
                  <li key={index}>{detail.path ? `${detail.path}: ` : ''}{detail.message || String(detail)}</li>
                ))}
              </ul>
            )}
          </Alert>
        </div>
      )}
      {actionError && <div className="mt-4"><Alert>{actionError}</Alert></div>}
      <div className="mt-4 flex flex-wrap gap-2">
        {['QUEUED', 'FAILED', 'REVIEW_REQUIRED', 'PREPROCESSING', 'OCR_PROCESSING', 'EXTRACTING', 'VALIDATING', 'VALIDATING_DATA'].includes(document.status) && (
          <button type="button" onClick={retry} disabled={pending} className="rounded-lg bg-moss px-3 py-2 text-sm text-white disabled:opacity-60">
            {pending ? 'Starting…' : document.status === 'QUEUED' ? 'Process' : 'Retry processing'}
          </button>
        )}
        {links.map(([to, label]) => (
          <Link key={to} to={to} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm">{label}</Link>
        ))}
      </div>
    </div>
  );
}
