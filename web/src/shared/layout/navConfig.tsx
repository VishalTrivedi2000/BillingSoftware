import type { LucideIcon } from 'lucide-react';
import { BarChart3, Building2, FileText, KeyRound, LayoutDashboard, Package, PlusCircle, Settings, Store, Truck, UserCircle, Users } from 'lucide-react';

export type NavItem = {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Sidebar grouping label */
  section: string;
  /** When set, item is hidden unless the JWT includes this permission claim. */
  requiredPermission?: string;
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
    to: '/purchases',
    label: 'Purchases',
    description: 'Supplier inward bills — purchases.read / purchases.create',
    icon: Truck,
    section: 'Billing',
  },
  {
    to: '/reports',
    label: 'Reports',
    description: 'Sale & purchase registers, filters, CSV exports',
    icon: BarChart3,
    section: 'Billing',
  },
  {
    to: '/sales',
    label: 'Sales overview',
    description: 'Receivables, collections, and recent invoices',
    icon: Store,
    section: 'Sales',
  },
  {
    to: '/invoices',
    label: 'Invoices',
    description: 'Create and review posted invoices',
    icon: FileText,
    section: 'Sales',
  },
  {
    to: '/invoices/new',
    label: 'New invoice',
    description: 'Issue a posted invoice with line items',
    icon: PlusCircle,
    section: 'Sales',
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
    to: '/settings',
    label: 'Settings',
    description: 'Default purchase invoice theme & print options',
    icon: Settings,
    section: 'Account',
  },
  {
    to: '/settings/rbac/roles',
    label: 'Roles & permissions',
    description: 'roles.read / roles.manage — RBAC catalog',
    icon: KeyRound,
    section: 'Account',
    requiredPermission: 'roles.read',
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
  const order = ['Billing', 'Sales', 'Masters', 'Account'];
  const map = new Map<string, NavItem[]>();
  for (const item of APP_NAV) {
    const list = map.get(item.section) ?? [];
    list.push(item);
    map.set(item.section, list);
  }
  return order.filter((k) => map.has(k)).map((title) => ({ title, items: map.get(title)! }));
}
