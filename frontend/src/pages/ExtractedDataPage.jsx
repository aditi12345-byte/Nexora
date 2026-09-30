import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Alert from '../components/Alert';
import api, { errorMessage } from '../services/api';
import { formatConfidence } from '../utils/format';

export default function ExtractedDataPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [validation, setValidation] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/api/documents/${id}/extraction`),
      api.get(`/api/documents/${id}/validation`),
    ]).then(([extraction, checks]) => {
      setData(extraction.data.data);
      setValidation(checks.data.data.results || []);
    }).catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p>Loading extracted data…</p>;
  if (error) return <Alert>{error}</Alert>;

  const fields = data.fields || [];
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm"><Link className="underline" to={`/documents/${id}`}>Back to document</Link></p>
      <h1 className="mt-2 font-serif text-4xl">Extracted data</h1>
      <p className="mt-2 text-sm text-stone-600">Class: {data.documentType || 'Not available'}. Missing values stay empty.</p>
      {fields.length === 0 ? <p className="mt-6 text-sm">Nothing has been extracted yet.</p> : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50 text-stone-500">
              <tr>
                <th className="px-3 py-2">Field</th>
                <th className="px-3 py-2">Value</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Validation</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.field} className="border-t border-stone-100 align-top">
                  <td className="px-3 py-2 font-medium">{field.field}</td>
                  <td className="px-3 py-2">{displayValue(field.value)}</td>
                  <td className="px-3 py-2">{formatConfidence(field.confidence, field.confidenceAvailable)}</td>
                  <td className="px-3 py-2">{field.sourcePage ? `Page ${field.sourcePage}` : '—'}{field.sourceText ? ` · ${field.sourceText}` : ''}</td>
                  <td className="px-3 py-2">{field.validationStatus}{field.grounded === false ? ' · not found in document' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2 className="mt-8 font-serif text-2xl">Schema checks</h2>
      {validation.length === 0 ? <p className="mt-2 text-sm">No validation results yet.</p> : (
        <ul className="mt-3 space-y-2 text-sm">
          {validation.map((result) => (
            <li key={result.id} className="rounded-lg border border-stone-200 bg-white px-3 py-2">
              {result.schemaName}: {result.passed ? 'passed' : 'failed'}
              {!result.passed && result.errors?.length > 0 && (
                <span> — {result.errors.map((item) => `${item.path}: ${item.message}`).join('; ')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function displayValue(value) {
  if (value == null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
