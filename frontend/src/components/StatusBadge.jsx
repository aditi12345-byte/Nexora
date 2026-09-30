const tones = {
  COMPLETED: 'bg-emerald-100 text-emerald-900',
  FAILED: 'bg-red-100 text-red-900',
  REVIEW_REQUIRED: 'bg-amber-100 text-amber-950',
  QUEUED: 'bg-stone-200 text-stone-800',
};

export default function StatusBadge({ status }) {
  const tone = tones[status] || 'bg-sky-100 text-sky-950';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ${tone}`}>
      {(status || 'UNKNOWN').replaceAll('_', ' ')}
    </span>
  );
}
