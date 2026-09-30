import { useEffect, useState } from 'react';
import api, { errorMessage } from '../services/api';
const terminalStatuses = ['COMPLETED', 'FAILED', 'REVIEW_REQUIRED'];

export function useDocument(id) {
  const [document, setDocument] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let stopped = false;
    let timer;

    async function load() {
      try {
        const response = await api.get(`/api/documents/${id}`);
        if (stopped) return;
        setDocument(response.data.data.document);
        setPages(response.data.data.pages || []);
        setError('');
        setLoading(false);
        const status = response.data.data.document.status;
        if (!terminalStatuses.includes(status)) {
          timer = setTimeout(load, 2000);
        }
      } catch (err) {
        if (stopped) return;
        setError(errorMessage(err));
        setLoading(false);
      }
    }

    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id]);

  return { document, pages, loading, error, setDocument };
}
