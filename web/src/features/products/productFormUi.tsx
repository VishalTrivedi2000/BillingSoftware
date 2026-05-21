import type { ComponentType, ReactNode } from 'react';
import { Info } from 'lucide-react';

export function StockProPage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`stockpro-product-form -mx-4 -mt-4 min-h-full bg-[#f4f6fb] px-4 pb-16 pt-6 text-slate-900 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 ${className}`}
    >
      {children}
    </div>
  );
}

export function FormCard({
  title,
  children,
  className = '',
  span = 1,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  span?: 1 | 2 | 3;
}) {
  const spanClass = span === 3 ? 'md:col-span-3' : span === 2 ? 'md:col-span-2' : '';
  return (
    <section
      className={`rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${spanClass} ${className}`}
    >
      {title && <h3 className="mb-4 text-sm font-bold text-slate-800">{title}</h3>}
      {children}
    </section>
  );
}

export function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs text-blue-900">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function Field({
  label,
  required,
  hint,
  children,
  className = '',
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-500';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="number" {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputClass} ${props.className ?? ''}`}>
      {props.children}
    </select>
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-[88px] resize-y ${inputClass} ${props.className ?? ''}`}
    />
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-[11px] text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </button>
    </div>
  );
}

export type ProductTabId =
  | 'basic'
  | 'category'
  | 'pricing'
  | 'variants'
  | 'inventory'
  | 'custom'
  | 'images';

export function ProductTabBar({
  active,
  onChange,
  tabs,
}: {
  active: ProductTabId;
  onChange: (id: ProductTabId) => void;
  tabs: { id: ProductTabId; label: string; icon: ComponentType<{ className?: string }> }[];
}) {
  return (
    <nav
      className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 pb-px"
      aria-label="Product form sections"
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const on = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              on
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <Icon className={`h-4 w-4 ${on ? 'text-blue-600' : 'text-slate-400'}`} aria-hidden />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

export function CharCounter({ current, max }: { current: number; max: number }) {
  return (
    <span className="text-[11px] text-slate-400">
      {current}/{max}
    </span>
  );
}
