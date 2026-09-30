import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '../components/Alert';
import api, { errorMessage } from '../services/api';

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('error');
  const [pending, setPending] = useState(false);

  function choose(nextFile) {
    setFile(nextFile || null);
    setMessage('');
    setProgress(0);
  }

  async function upload(event) {
    event.preventDefault();
    if (!file) {
      setTone('error');
      setMessage('Choose a PDF, JPG, or PNG first.');
      return;
    }
    const data = new FormData();
    data.append('file', file);
    setPending(true);
    setMessage('');
    try {
      const response = await api.post('/api/documents/upload', data, {
        onUploadProgress(eventProgress) {
          if (!eventProgress.total) return;
          setProgress(Math.round((eventProgress.loaded / eventProgress.total) * 100));
        },
      });
      const document = response.data.data.document;
      setTone('success');
      setMessage('Upload received. Starting processing…');
      await api.post(`/api/documents/${document.id}/process`);
      navigate(`/documents/${document.id}`);
    } catch (error) {
      setTone('error');
      setMessage(errorMessage(error));
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-4xl">Upload a document</h1>
      <p className="mt-2 text-stone-600">PDF, JPG, and PNG files are checked before anything is stored. Empty, oversized, and unreadable files are rejected.</p>
      <form className="mt-6 rounded-2xl border border-dashed border-stone-400 bg-white p-6" onSubmit={upload}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          choose(event.dataTransfer.files?.[0]);
        }}
      >
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          onChange={(event) => choose(event.target.files?.[0])}
        />
        <p className="mt-3 text-sm text-stone-600">{file ? file.name : 'Drag a file here or choose one from your computer.'}</p>
        {progress > 0 && (
          <div className="mt-4 h-2 rounded-full bg-stone-100">
            <div className="h-2 rounded-full bg-moss" style={{ width: `${progress}%` }} />
          </div>
        )}
        {message && <div className="mt-4"><Alert tone={tone}>{message}</Alert></div>}
        <div className="mt-4 flex gap-3">
          <button type="submit" disabled={pending} className="rounded-lg bg-moss px-4 py-2 text-white disabled:opacity-60">
            {pending ? 'Uploading…' : 'Upload and process'}
          </button>
        </div>
      </form>
    </div>
  );
}
