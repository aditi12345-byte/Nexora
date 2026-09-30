export default function Alert({ tone = 'error', children }) {
  const tones = {
    error: 'border-red-200 bg-red-50 text-red-900',
    info: 'border-stone-200 bg-white text-ink',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  };
  return <div className={`rounded-lg border px-3 py-2 text-sm ${tones[tone] || tones.info}`}>{children}</div>;
}
