import { useEffect, useState } from 'react';
import Alert from '../components/Alert';
import { useAuth } from '../hooks/useAuth';
import api, { errorMessage } from '../services/api';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/health')
      .then((response) => setHealth(response.data))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-4xl">Settings</h1>
      <p className="mt-2 text-sm text-stone-600">Secrets stay on the server. This page only shows whether each service is configured.</p>
      <div className="mt-6 rounded-xl border border-stone-200 bg-white p-4 text-sm">
        <p><span className="text-stone-500">Signed in as</span> {user?.name} · {user?.email}</p>
        <button type="button" className="mt-3 underline" onClick={logout}>Sign out</button>
      </div>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      {health && (
        <dl className="mt-4 space-y-3 rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <div><dt className="text-stone-500">API</dt><dd>{health.status}</dd></div>
          <div><dt className="text-stone-500">Database</dt><dd>{health.services.database.mode} · {health.services.database.status}</dd></div>
          <div><dt className="text-stone-500">Gemini</dt><dd>{health.services.gemini.status}</dd></div>
          <div><dt className="text-stone-500">OCR</dt><dd>{health.services.ocr.engine} · {health.services.ocr.status}</dd></div>
          <div>
            <dt className="text-stone-500">Confidence routing</dt>
            <dd>90% and above can be approved when the schema passes. 70–89% needs verification. Below 70%, or when a score is unavailable, a person reviews the field.</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
