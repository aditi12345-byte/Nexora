import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../components/Alert';
import StatusBadge from '../components/StatusBadge';
import api, { errorMessage } from '../services/api';
import { formatWhen, isProcessing } from '../utils/format';

export default function DashboardPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/documents')
      .then((response) => setDocuments(response.data.data.documents))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const counts = {
    total: documents.length,
    completed: documents.filter((doc) => doc.status === 'COMPLETED').length,
    processing: documents.filter((doc) => isProcessing(doc.status)).length,
    failed: documents.filter((doc) => doc.status === 'FAILED').length,
    review: documents.filter((doc) => doc.status === 'REVIEW_REQUIRED').length,
  };
  const max = Math.max(1, ...Object.values(counts).slice(1));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-serif text-4xl">Dashboard</h1>
      <p className="mt-2 text-stone-600">A count of your documents and the ones that still need a person.</p>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      {loading ? <p className="mt-6 text-sm text-stone-600">Loading documents…</p> : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Total', counts.total],
              ['Completed', counts.completed],
              ['Processing', counts.processing],
              ['Failed', counts.failed],
              ['Review', counts.review],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
                <p className="mt-2 font-serif text-3xl">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-stone-200 bg-white p-4">
            <h2 className="font-serif text-2xl">Status mix</h2>
            <div className="mt-4 space-y-3">
              {[
                ['Completed', counts.completed],
                ['Processing', counts.processing],
                ['Failed', counts.failed],
                ['Review required', counts.review],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{label}</span><span>{value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-stone-100">
                    <div className="h-2 rounded-full bg-moss" style={{ width: `${(value / max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-stone-200 bg-white">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="font-serif text-2xl">Recent documents</h2>
              <Link className="text-sm text-moss underline" to="/upload">Upload</Link>
            </div>
            {documents.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-stone-600">No documents yet. Upload a PDF or image to start a processing run.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {documents.slice(0, 5).map((doc) => (
                  <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <Link className="font-medium underline" to={`/documents/${doc.id}`}>{doc.originalName}</Link>
                    <span className="text-stone-500">{formatWhen(doc.createdAt)}</span>
                    <StatusBadge status={doc.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
