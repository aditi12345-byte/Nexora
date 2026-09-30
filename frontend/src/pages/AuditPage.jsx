import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Alert from '../components/Alert';
import api, { errorMessage } from '../services/api';
import { formatWhen } from '../utils/format';

export default function AuditPage() {
  const { documentId } = useParams();
  const [documents, setDocuments] = useState([]);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const requests = [api.get('/api/documents')];
    if (documentId) requests.push(api.get(`/api/audit/${documentId}`));
    Promise.all(requests)
      .then(([docs, audit]) => {
        setDocuments(docs.data.data.documents);
        setEntries(audit ? audit.data.data.entries : []);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [documentId]);

  if (loading) return <p>Loading audit history…</p>;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-serif text-4xl">Audit history</h1>
      <p className="mt-2 text-sm text-stone-600">Processing events are recorded without passwords, tokens, or API keys.</p>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      <div className="mt-4 flex flex-wrap gap-2">
        {documents.map((doc) => (
          <Link key={doc.id} to={`/audit/${doc.id}`} className={`rounded-full border px-3 py-1 text-sm ${doc.id === documentId ? 'border-moss bg-white' : 'border-stone-300'}`}>
            {doc.originalName}
          </Link>
        ))}
      </div>
      {!documentId ? <p className="mt-6 text-sm">Choose a document to see its history.</p> : entries.length === 0 ? (
        <p className="mt-6 text-sm">No audit events for this document.</p>
      ) : (
        <ol className="mt-6 space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{entry.action}</strong>
                <span className="text-stone-500">{formatWhen(entry.timestamp)}</span>
              </div>
              <p className="mt-1 text-stone-600">{entry.stage} · {entry.status}</p>
              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                <p className="mt-1 text-stone-500">{Object.entries(entry.metadata).map(([key, value]) => `${key}: ${value}`).join(' · ')}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
