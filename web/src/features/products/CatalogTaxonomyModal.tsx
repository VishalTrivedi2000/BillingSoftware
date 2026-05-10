import { FormEvent, useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import axios from 'axios';
import type { ProductCategoryDto } from '../../entities/billing';
import { authApi } from '../../shared/api/axiosClient';

export type TaxonomySection = 'category' | 'brand' | 'unit';

type Props = {
  open: boolean;
  onClose: () => void;
  categories: ProductCategoryDto[];
  initialSection?: TaxonomySection;
  onCreated: () => void | Promise<void>;
};

function slugify(label: string): string {
  const s = label
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (s || 'item').slice(0, 96);
}

export function CatalogTaxonomyModal({ open, onClose, categories, initialSection = 'category', onCreated }: Props) {
  const [section, setSection] = useState<TaxonomySection>(initialSection);

  const [catParentId, setCatParentId] = useState<number | ''>('');
  const [catSlug, setCatSlug] = useState('');
  const [catName, setCatName] = useState('');
  const [catSort, setCatSort] = useState('100');
  const [catBusy, setCatBusy] = useState(false);
  const [catErr, setCatErr] = useState<string | null>(null);

  const [brandSlug, setBrandSlug] = useState('');
  const [brandName, setBrandName] = useState('');
  const [brandSort, setBrandSort] = useState('100');
  const [brandBusy, setBrandBusy] = useState(false);
  const [brandErr, setBrandErr] = useState<string | null>(null);

  const [unitCode, setUnitCode] = useState('');
  const [unitDisplay, setUnitDisplay] = useState('');
  const [unitSort, setUnitSort] = useState('100');
  const [unitBusy, setUnitBusy] = useState(false);
  const [unitErr, setUnitErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSection(initialSection);
  }, [open, initialSection]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const sortedCats = [...categories].filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  async function saveCategory(e: FormEvent) {
    e.preventDefault();
    setCatErr(null);
    const name = catName.trim();
    let slug = catSlug.trim().toLowerCase();
    if (!name) {
      setCatErr('Name is required.');
      return;
    }
    if (!slug) slug = slugify(name);
    const sort = Number(catSort);
    if (!Number.isFinite(sort)) {
      setCatErr('Sort order must be a number.');
      return;
    }
    setCatBusy(true);
    try {
      await authApi.post('/v1/product-categories', {
        parentCategoryId: catParentId === '' ? null : catParentId,
        slug,
        name,
        sortOrder: sort,
      });
      setCatSlug('');
      setCatName('');
      setCatParentId('');
      setCatSort('100');
      await onCreated();
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? String(err.response?.data ?? err.response?.status ?? err.message)
        : 'Could not create category.';
      setCatErr(msg);
    } finally {
      setCatBusy(false);
    }
  }

  async function saveBrand(e: FormEvent) {
    e.preventDefault();
    setBrandErr(null);
    const name = brandName.trim();
    let slug = brandSlug.trim().toLowerCase();
    if (!name) {
      setBrandErr('Name is required.');
      return;
    }
    if (!slug) slug = slugify(name);
    const sort = Number(brandSort);
    if (!Number.isFinite(sort)) {
      setBrandErr('Sort order must be a number.');
      return;
    }
    setBrandBusy(true);
    try {
      await authApi.post('/v1/product-brands', { slug, name, sortOrder: sort });
      setBrandSlug('');
      setBrandName('');
      setBrandSort('100');
      await onCreated();
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? String(err.response?.data ?? err.response?.status ?? err.message)
        : 'Could not create brand.';
      setBrandErr(msg);
    } finally {
      setBrandBusy(false);
    }
  }

  async function saveUnit(e: FormEvent) {
    e.preventDefault();
    setUnitErr(null);
    const displayName = unitDisplay.trim();
    let code = unitCode.trim().toLowerCase();
    if (!displayName) {
      setUnitErr('Display name is required.');
      return;
    }
    if (!code) code = slugify(displayName);
    const sort = Number(unitSort);
    if (!Number.isFinite(sort)) {
      setUnitErr('Sort order must be a number.');
      return;
    }
    setUnitBusy(true);
    try {
      await authApi.post('/v1/product-units', { code, displayName, sortOrder: sort });
      setUnitCode('');
      setUnitDisplay('');
      setUnitSort('100');
      await onCreated();
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? String(err.response?.data ?? err.response?.status ?? err.message)
        : 'Could not create unit.';
      setUnitErr(msg);
    } finally {
      setUnitBusy(false);
    }
  }

  if (!open) return null;

  const tabs: { id: TaxonomySection; label: string }[] = [
    { id: 'category', label: 'Category' },
    { id: 'brand', label: 'Brand' },
    { id: 'unit', label: 'Unit of measure' },
  ];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#111827] shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-white">Catalog taxonomy</h3>
            <p className="mt-0.5 text-xs text-slate-500">Create departments, brands, and units like Flipkart / Amazon listings.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-white/10 px-3 pt-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSection(t.id)}
              className={`rounded-t-lg px-3 py-2 text-xs font-semibold transition ${
                section === t.id ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-4 p-5">
          {section === 'category' && (
            <form className="space-y-3" onSubmit={(ev) => void saveCategory(ev)}>
              <label className="block text-xs font-semibold text-slate-400">
                Parent category
                <select
                  value={catParentId === '' ? '' : catParentId}
                  onChange={(e) => setCatParentId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                >
                  <option value="">Top-level department</option>
                  {sortedCats.map((c) => (
                    <option key={c.categoryId} value={c.categoryId}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-400">
                URL slug
                <input
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  onBlur={() => {
                    if (!catSlug.trim() && catName.trim()) setCatSlug(slugify(catName));
                  }}
                  placeholder="auto from name"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 font-mono text-sm text-white outline-none focus:border-violet-500"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-400">
                Display name
                <input
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-400">
                Sort order
                <input
                  value={catSort}
                  onChange={(e) => setCatSort(e.target.value)}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
              </label>
              {catErr && <p className="text-sm text-rose-300">{catErr}</p>}
              <button
                type="submit"
                disabled={catBusy}
                className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {catBusy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Save category'}
              </button>
            </form>
          )}

          {section === 'brand' && (
            <form className="space-y-3" onSubmit={(ev) => void saveBrand(ev)}>
              <label className="block text-xs font-semibold text-slate-400">
                Slug
                <input
                  value={brandSlug}
                  onChange={(e) => setBrandSlug(e.target.value)}
                  onBlur={() => {
                    if (!brandSlug.trim() && brandName.trim()) setBrandSlug(slugify(brandName));
                  }}
                  placeholder="samsung"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 font-mono text-sm text-white outline-none focus:border-violet-500"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-400">
                Brand name
                <input
                  required
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-400">
                Sort order
                <input
                  value={brandSort}
                  onChange={(e) => setBrandSort(e.target.value)}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
              </label>
              {brandErr && <p className="text-sm text-rose-300">{brandErr}</p>}
              <button
                type="submit"
                disabled={brandBusy}
                className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {brandBusy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Save brand'}
              </button>
            </form>
          )}

          {section === 'unit' && (
            <form className="space-y-3" onSubmit={(ev) => void saveUnit(ev)}>
              <label className="block text-xs font-semibold text-slate-400">
                Code (short)
                <input
                  value={unitCode}
                  onChange={(e) => setUnitCode(e.target.value)}
                  onBlur={() => {
                    if (!unitCode.trim() && unitDisplay.trim()) setUnitCode(slugify(unitDisplay));
                  }}
                  placeholder="crate"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 font-mono text-sm text-white outline-none focus:border-violet-500"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-400">
                Display label
                <input
                  required
                  value={unitDisplay}
                  onChange={(e) => setUnitDisplay(e.target.value)}
                  placeholder="Crate / carton"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-400">
                Sort order
                <input
                  value={unitSort}
                  onChange={(e) => setUnitSort(e.target.value)}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
              </label>
              <p className="text-[11px] text-slate-500">
                Default units (Each, Kilogram, Pack…) are seeded per organization; add customs here for bakery crates, flooring sq.ft.,
                etc.
              </p>
              {unitErr && <p className="text-sm text-rose-300">{unitErr}</p>}
              <button
                type="submit"
                disabled={unitBusy}
                className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {unitBusy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Save unit'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
