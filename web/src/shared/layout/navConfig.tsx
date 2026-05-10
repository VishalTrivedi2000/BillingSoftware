import type { LucideIcon } from 'lucide-react';
import { Building2, FileText, LayoutDashboard, Package, Truck, UserCircle, Users } from 'lucide-react';

export type NavItem = {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Sidebar grouping label */
  section: string;
};

export const APP_NAV: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    description: 'Metrics, trends, and workspace health',
    icon: LayoutDashboard,
    section: 'Billing',
  },
  {
    to: '/invoices',
    label: 'Invoices',
    description: 'Create and review posted invoices',
    icon: FileText,
    section: 'Billing',
  },
  {
    to: '/purchases',
    label: 'Purchases',
    description: 'Supplier inward bills — purchases.read / purchases.create',
    icon: Truck,
    section: 'Billing',
  },
  {
    to: '/customers',
    label: 'Customers',
    description: 'Buyer accounts scoped to this organization',
    icon: Users,
    section: 'Masters',
  },
  {
    to: '/parties',
    label: 'Parties',
    description: 'Onboard counterparties under this organization',
    icon: Building2,
    section: 'Masters',
  },
  {
    to: '/products',
    label: 'Products',
    description: 'SKU catalog and unit pricing',
    icon: Package,
    section: 'Masters',
  },
  {
    to: '/profile',
    label: 'Profile & workplace',
    description: 'Identity, avatar, tenant / org switching',
    icon: UserCircle,
    section: 'Account',
  },
];

export function navSections(): { title: string; items: NavItem[] }[] {
  const order = ['Billing', 'Masters', 'Account'];
  const map = new Map<string, NavItem[]>();
  for (const item of APP_NAV) {
    const list = map.get(item.section) ?? [];
    list.push(item);
    map.set(item.section, list);
  }
  return order.filter((k) => map.has(k)).map((title) => ({ title, items: map.get(title)! }));
}
