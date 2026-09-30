import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Alert from '../components/Alert';
import api, { errorDetails, errorMessage } from '../services/api';
import { formatConfidence } from '../utils/format';

export default function ReviewPage() {
  const [params] = useSearchParams();
  const documentId = params.get('documentId') || '';
  const [reviews, setReviews] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [draftSourceId, setDraftSourceId] = useState(null);

  useEffect(() => {
    const query = new URLSearchParams();
    if (documentId) query.set('documentId', documentId);
    query.set('status', 'OPEN');
    let cancelled = false;
    api.get(`/api/reviews?${query.toString()}`)
      .then((response) => {
        if (cancelled) return;
        const rows = response.data.data.reviews;
        setReviews(rows);
        setSelectedId((current) => current || rows[0]?.id || '');
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, refreshKey]);

  const selected = reviews.find((review) => review.id === selectedId) || null;
  const draftKey = selected?.id || '';
  const draftSeed = selected ? (selected.correction ?? selected.value ?? '') : '';
  if (draftKey !== draftSourceId) {
    setDraftSourceId(draftKey);
    setDraft(typeof draftSeed === 'string' ? draftSeed : JSON.stringify(draftSeed, null, 2));
  }

  function parsedDraft() {
    if (!selected) return draft;
    if (selected.field.startsWith('table:') || selected.field === 'items') {
      try {
        return JSON.parse(draft);
      } catch {
        const error = new Error('Table and line-item corrections must be valid JSON.');
        error.local = true;
        throw error;
      }
    }
    return draft;
  }

  async function saveDraft() {
    setPending(true);
    setError('');
    try {
      await api.patch(`/api/reviews/${selected.id}`, { value: parsedDraft() });
      setNotice('Correction saved. It is not approved until schema validation passes.');
    } catch (err) {
      setError(err.local ? err.message : errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function decide(kind) {
    setPending(true);
    setError('');
    setNotice('');
    try {
      if (kind === 'approve') {
        await api.post(`/api/reviews/${selected.id}/approve`, { value: parsedDraft() });
        setNotice('Approved and checked against the schema.');
      } else {
        await api.post(`/api/reviews/${selected.id}/reject`);
        setNotice('Rejected. The value was not stored as approved data.');
      }
      setSelectedId('');
      setRefreshKey((current) => current + 1);
    } catch (err) {
      if (err.local) {
        setError(err.message);
      } else {
        const details = errorDetails(err).map((item) => item.message).filter(Boolean).join(' ');
        setError(details ? `${errorMessage(err)} ${details}` : errorMessage(err));
      }
    } finally {
      setPending(false);
    }
  }

  if (loading) return <p>Loading review tasks…</p>;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-serif text-4xl">Review</h1>
      <p className="mt-2 text-sm text-stone-600">Low-confidence and unverified fields wait here. Approving a correction runs schema validation again.</p>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      {notice && <div className="mt-4"><Alert tone="success">{notice}</Alert></div>}
      {reviews.length === 0 ? (
        <p className="mt-6 text-sm">No open review tasks. <Link className="underline" to="/documents">Browse documents</Link></p>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[280px_1fr]">
          <ul className="rounded-xl border border-stone-200 bg-white">
            {reviews.map((review) => (
              <li key={review.id}>
                <button type="button" className={`block w-full px-3 py-3 text-left text-sm ${review.id === selectedId ? 'bg-stone-100' : ''}`} onClick={() => setSelectedId(review.id)}>
                  <span className="font-medium">{review.field}</span>
                  <span className="mt-1 block text-stone-500">{review.validationStatus}</span>
                </button>
              </li>
            ))}
          </ul>
          {selected && (
            <section className="rounded-xl border border-stone-200 bg-white p-4">
              <h2 className="font-serif text-2xl">{selected.field}</h2>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-stone-500">Value</dt><dd>{formatMaybe(selected.value)}</dd></div>
                <div><dt className="text-stone-500">Confidence</dt><dd>{formatConfidence(selected.confidence, selected.confidenceAvailable)}</dd></div>
                <div><dt className="text-stone-500">Source</dt><dd>{selected.sourcePage ? `Page ${selected.sourcePage}` : '—'}{selected.sourceText ? ` · ${selected.sourceText}` : ''}</dd></div>
                <div><dt className="text-stone-500">Validation</dt><dd>{selected.validationStatus}{selected.grounded === false ? ' · suggestion was not in the document' : ''}</dd></div>
              </dl>
              {selected.suggestedValue != null && (
                <p className="mt-3 text-sm text-amber-900">Ungrounded suggestion: {formatMaybe(selected.suggestedValue)}. It is not saved as the field value.</p>
              )}
              <p className="mt-3 text-sm"><Link className="underline" to={`/documents/${selected.documentId}`}>Open document</Link></p>
              <label className="mt-4 block text-sm">
                Correction
                <textarea className="mt-1 min-h-28 w-full rounded-lg border border-stone-300 px-3 py-2" value={draft} onChange={(event) => setDraft(event.target.value)} />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={pending} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" onClick={saveDraft}>Save draft</button>
                <button type="button" disabled={pending} className="rounded-lg bg-moss px-3 py-2 text-sm text-white" onClick={() => decide('approve')}>Approve</button>
                <button type="button" disabled={pending} className="rounded-lg bg-stone-800 px-3 py-2 text-sm text-white" onClick={() => decide('reject')}>Reject</button>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function formatMaybe(value) {
  if (value == null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
