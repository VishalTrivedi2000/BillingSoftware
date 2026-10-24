import type { ComponentType, ReactNode } from 'react';
import { Info } from 'lucide-react';
import {
  appFieldInput,
  appFieldLabel,
  appPageCanvas,
  appSurface,
  appTabBar,
  appTextSubtle,
} from '../../shared/theme/contentThemeClasses';

export function StockProPage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`stockpro-product-form ${appPageCanvas} pt-6 ${className}`}>{children}</div>
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
    <section className={`${appSurface} ${spanClass} ${className}`}>
      {title && <h3 className="app-section-title mb-4">{title}</h3>}
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
      <span className={appFieldLabel}>
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className={`mt-1 ${appTextSubtle}`}>{hint}</p>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${appFieldInput} ${props.className ?? ''}`} />;
}

export function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="number" {...props} className={`${appFieldInput} ${props.className ?? ''}`} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${appFieldInput} ${props.className ?? ''}`}>
      {props.children}
    </select>
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-[88px] resize-y ${appFieldInput} ${props.className ?? ''}`}
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
    <div className="app-surface flex items-center justify-between gap-3 !p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className={appTextSubtle}>{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-[rgb(var(--accent-rgb))]' : 'bg-[rgb(var(--content-border-rgb)/0.35)]'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </button>
    </div>
  );
}

export type ProductTabId = 'basic' | 'variants' | 'inventory' | 'images';

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
    <nav className={appTabBar} aria-label="Product form sections">
      {tabs.map(({ id, label, icon: Icon }) => {
        const on = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              on ? 'app-tab-active' : 'app-tab-inactive'
            }`}
          >
            <Icon className="h-4 w-4 opacity-80" aria-hidden />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

export function CharCounter({ current, max }: { current: number; max: number }) {
  return (
    <span className={appTextSubtle}>
      {current}/{max}
    </span>
  );
}
