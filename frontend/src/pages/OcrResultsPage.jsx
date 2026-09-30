import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Alert from '../components/Alert';
import api, { errorMessage } from '../services/api';
import { formatConfidence, isProcessing } from '../utils/format';

export default function OcrResultsPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [pages, setPages] = useState([]);
  const [images, setImages] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeBox, setActiveBox] = useState(null);

  useEffect(() => {
    let stopped = false;
    let timer;
    const revoked = [];

    async function load() {
      try {
        const [ocr, doc] = await Promise.all([
          api.get(`/api/documents/${id}/ocr`),
          api.get(`/api/documents/${id}`),
        ]);
        if (stopped) return;
        setData(ocr.data.data);
        const pageRows = doc.data.data.pages || [];
        setPages(pageRows);
        const urls = {};
        for (const page of pageRows.filter((item) => item.hasImage)) {
          const image = await api.get(`/api/documents/${id}/pages/${page.pageNumber}/image`, { responseType: 'blob' });
          if (stopped) return;
          const url = URL.createObjectURL(image.data);
          urls[page.pageNumber] = url;
          revoked.push(url);
        }
        setImages((current) => ({ ...current, ...urls }));
        setError('');
        setLoading(false);
        const status = doc.data.data.document.status;
        const stored = ocr.data.data.pages || [];
        if (isProcessing(status) && stored.length === 0) timer = setTimeout(load, 3000);
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
      revoked.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [id]);

  if (loading) return <p>Loading OCR…</p>;
  if (error) return <Alert>{error}</Alert>;

  const pagesWithText = data.pages || [];
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm"><Link className="underline" to={`/documents/${id}`}>Back to document</Link></p>
      <h1 className="mt-2 font-serif text-4xl">OCR results</h1>
      <p className="mt-2 text-sm text-stone-600">Confidence comes from the OCR engine. If a score is missing, Folio marks it unavailable.</p>
      {pagesWithText.length === 0 ? <p className="mt-6 text-sm">No OCR text has been stored for this document yet.</p> : pagesWithText.map((page) => {
        const meta = pages.find((item) => item.pageNumber === page.page);
        const blocks = (data.blocks || []).filter((block) => block.page === page.page && block.bbox && meta?.width && meta?.height);
        return (
          <section key={page.page} className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <h2 className="font-serif text-2xl">Page {page.page}</h2>
              <p className="mt-1 text-sm text-stone-500">Confidence: {formatConfidence(page.confidence, page.confidenceAvailable)}</p>
              <pre className="mt-3 whitespace-pre-wrap text-sm">{page.text || 'No text detected.'}</pre>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              {images[page.page] ? (
                <div className="relative inline-block max-w-full">
                  <img src={images[page.page]} alt={`Page ${page.page}`} className="max-w-full" />
                  {blocks.map((block, index) => (
                    <button
                      key={`${block.text}-${index}`}
                      type="button"
                      title={block.text}
                      onClick={() => setActiveBox(block)}
                      className="absolute border border-moss/70 bg-moss/10"
                      style={{
                        left: `${(block.bbox.x0 / meta.width) * 100}%`,
                        top: `${(block.bbox.y0 / meta.height) * 100}%`,
                        width: `${((block.bbox.x1 - block.bbox.x0) / meta.width) * 100}%`,
                        height: `${((block.bbox.y1 - block.bbox.y0) / meta.height) * 100}%`,
                      }}
                    />
                  ))}
                </div>
              ) : <p className="text-sm text-stone-600">No page image is available, so bounding boxes are not shown.</p>}
              {activeBox && <p className="mt-3 text-sm">Selected: {activeBox.text} ({formatConfidence(activeBox.confidence, activeBox.confidenceAvailable)})</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
