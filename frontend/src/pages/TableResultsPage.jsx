import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Alert from '../components/Alert';
import api, { errorMessage } from '../services/api';

export default function TableResultsPage() {
  const { id } = useParams();
  const [tables, setTables] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/documents/${id}/extraction`)
      .then((response) => setTables(response.data.data.payload?.tables || []))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p>Loading tables…</p>;
  if (error) return <Alert>{error}</Alert>;

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm"><Link className="underline" to={`/documents/${id}`}>Back to document</Link></p>
      <h1 className="mt-2 font-serif text-4xl">Table results</h1>
      <p className="mt-2 text-sm text-stone-600">Cells that were not found in the document are left empty. Tables without an OCR confidence score stay in review.</p>
      {tables.length === 0 ? <p className="mt-6 text-sm">No tables were extracted.</p> : tables.map((table) => (
        <section key={table.tableId} className="mt-6 overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <h2 className="px-4 py-3 font-serif text-2xl">{table.tableId} · page {table.page}</h2>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50">
              <tr>{(table.columns || []).map((column) => <th key={column} className="px-3 py-2">{column}</th>)}</tr>
            </thead>
            <tbody>
              {(table.rows || []).map((row, index) => (
                <tr key={index} className="border-t border-stone-100">
                  {row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2">{cell == null ? '—' : String(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
