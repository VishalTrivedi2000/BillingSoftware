import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'Capabilities', href: '#features' },
  { label: 'Run locally', href: '#howitworks' },
  { label: 'Database', href: '#database' },
  { label: 'Ships today', href: '#ships' },
];

export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-b border-slate-800 bg-slate-950/90 backdrop-blur-md shadow-lg shadow-black/20' : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-600/25">
            <span className="text-sm font-black text-white">B</span>
          </div>
          <div className="leading-tight">
            <span className="block text-lg font-bold text-white">Billing</span>
            <span className="hidden text-[10px] font-medium uppercase tracking-wider text-slate-500 sm:block">BS workspace</span>
          </div>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map(({ label, href }) => (
            <a key={href} href={href} className="text-sm font-medium text-slate-400 transition hover:text-blue-400">
              {label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link to="/login" className="px-3 py-2 text-sm font-medium text-slate-300 transition hover:text-white">
            Sign in
          </Link>
          <Link
            to="/dashboard"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-all duration-200 hover:bg-blue-500 hover:shadow-blue-500/40"
          >
            Dashboard
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="rounded-lg p-2 text-slate-300 hover:bg-slate-800"
            aria-expanded={open}
            aria-label="Toggle menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-800 bg-slate-950 px-4 py-4 md:hidden">
          <div className="flex flex-col gap-2">
            {navLinks.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="rounded-lg py-2 text-sm font-medium text-slate-300 hover:text-blue-400"
              >
                {label}
              </a>
            ))}
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-xl border border-slate-700 py-2.5 text-center text-sm font-medium text-white"
            >
              Sign in
            </Link>
            <Link
              to="/dashboard"
              onClick={() => setOpen(false)}
              className="rounded-xl bg-blue-600 py-2.5 text-center text-sm font-semibold text-white"
            >
              Dashboard
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
