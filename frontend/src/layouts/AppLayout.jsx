import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const links = [
  ['/dashboard', 'Dashboard'],
  ['/upload', 'Upload'],
  ['/documents', 'Documents'],
  ['/review', 'Review'],
  ['/audit', 'Audit'],
  ['/settings', 'Settings'],
];

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-paper md:grid md:grid-cols-[220px_1fr]">
      <aside className="bg-pine text-stone-100 md:min-h-screen">
        <div className="flex items-center justify-between px-4 py-4 md:block">
          <div>
            <p className="font-serif text-2xl">Folio</p>
            <p className="text-xs text-stone-300">Document processing</p>
          </div>
          <button type="button" className="text-sm text-stone-300 md:mt-8 md:hidden" onClick={logout}>Sign out</button>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-3 pb-3 md:block md:space-y-1 md:px-3">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `block whitespace-nowrap rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-white/15 text-white' : 'text-stone-300 hover:bg-white/10'}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-4 py-6 text-sm text-stone-300 md:block">
          <p>{user?.name}</p>
          <button type="button" className="mt-2 underline" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="px-4 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  );
}
