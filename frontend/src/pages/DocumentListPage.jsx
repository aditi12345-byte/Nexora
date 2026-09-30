import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../components/Alert';
import StatusBadge from '../components/StatusBadge';
import api, { errorMessage } from '../services/api';
import { formatBytes, formatWhen } from '../utils/format';

export default function DocumentListPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    api.get('/api/documents')
      .then((response) => setDocuments(response.data.data.documents))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function remove(id) {
    if (!window.confirm('Delete this document and its extracted data?')) return;
    try {
      await api.delete(`/api/documents/${id}`);
      setDocuments((current) => current.filter((doc) => doc.id !== id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-4xl">Documents</h1>
        <Link className="rounded-lg bg-moss px-3 py-2 text-sm text-white" to="/upload">Upload</Link>
      </div>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      {loading ? <p className="mt-6 text-sm">Loading documents…</p> : documents.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600">The library is empty.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50 text-stone-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-t border-stone-100">
                  <td className="px-4 py-3"><Link className="underline" to={`/documents/${doc.id}`}>{doc.originalName}</Link></td>
                  <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                  <td className="px-4 py-3">{formatBytes(doc.sizeBytes)}</td>
                  <td className="px-4 py-3">{formatWhen(doc.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="text-red-800 underline" onClick={() => remove(doc.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
