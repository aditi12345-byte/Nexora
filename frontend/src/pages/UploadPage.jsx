import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '../components/Alert';
import api, { errorMessage } from '../services/api';
import { formatBytes } from '../utils/format';

const ACCEPT = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';

export default function UploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
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
    const selected = file || inputRef.current?.files?.[0] || null;
    if (!selected) {
      setTone('error');
      setMessage('Choose a PDF, JPG, or PNG first.');
      return;
    }
    const data = new FormData();
    data.append('file', selected);
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
      setMessage('Upload received. Opening the document…');
      try {
        await api.post(`/api/documents/${document.id}/process`);
      } catch {
        // The file is already stored. The document page shows processing status.
      }
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
      <form
        className="mt-6 rounded-2xl border border-dashed border-stone-400 bg-white p-6"
        onSubmit={upload}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const dropped = event.dataTransfer.files?.[0];
          choose(dropped);
          if (inputRef.current && dropped) {
            const transfer = new DataTransfer();
            transfer.items.add(dropped);
            inputRef.current.files = transfer.files;
          }
        }}
      >
        <label className="inline-flex cursor-pointer rounded-lg border border-stone-300 bg-stone-50 px-4 py-2 text-sm font-medium" htmlFor="document-file">
          Choose a PDF, JPG, or PNG
        </label>
        <input
          ref={inputRef}
          id="document-file"
          name="document"
          className="mt-3 block w-full text-sm"
          type="file"
          accept={ACCEPT}
          onChange={(event) => choose(event.target.files?.[0])}
        />
        <p className="mt-3 text-sm text-stone-700">
          {file
            ? <><span className="font-medium">{file.name}</span> · {formatBytes(file.size)}</>
            : 'No file selected yet. Choose a file, or drop it in this box.'}
        </p>
        {progress > 0 && (
          <div className="mt-4 h-2 rounded-full bg-stone-100">
            <div className="h-2 rounded-full bg-moss" style={{ width: `${progress}%` }} />
          </div>
        )}
        {message && <div className="mt-4"><Alert tone={tone}>{message}</Alert></div>}
        <div className="mt-4 flex gap-3">
          <button type="submit" disabled={pending || !file} className="rounded-lg bg-moss px-4 py-2 text-white disabled:opacity-60">
            {pending ? 'Uploading…' : 'Upload and process'}
          </button>
        </div>
      </form>
    </div>
  );
}
