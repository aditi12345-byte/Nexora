import { Link } from 'react-router-dom';

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-paper px-4 py-10">
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
        <div>
          <Link to="/login" className="font-serif text-3xl text-pine">Folio</Link>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-stone-700">
            Read invoices, receipts, and identity documents. Folio keeps only values it can find in the file.
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h1 className="font-serif text-3xl text-ink">{title}</h1>
          <p className="mt-2 text-sm text-stone-600">{subtitle}</p>
          <div className="mt-6">{children}</div>
          <div className="mt-4 text-sm text-stone-600">{footer}</div>
        </div>
      </div>
    </div>
  );
}
