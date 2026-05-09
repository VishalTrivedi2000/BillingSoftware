/** Mirrors BillingApp.Application.Billing JSON payloads (camelCase from ASP.NET). */

export type DashboardMetricsDto = {
  customerCount: number;
  activeProductCount: number;
  invoiceCount: number;
  totalInvoicedAmount: number;
};

export type InvoiceSummaryDto = {
  invoiceId: number;
  invoiceNumber: string | null;
  customerId: number;
  customerName: string;
  issueUtc: string;
  totalAmount: number;
  status: string;
};

export type InvoiceLineDto = {
  invoiceLineId: number;
  productId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type InvoiceDetailDto = {
  invoiceId: number;
  invoiceNumber: string | null;
  customerId: number;
  customerName: string;
  issueUtc: string;
  currency: string;
  totalAmount: number;
  status: string;
  lines: InvoiceLineDto[];
};

export type CreateInvoiceLineBody = {
  productId?: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type CreateInvoiceBody = {
  customerId: number;
  lines: CreateInvoiceLineBody[];
};

export type CustomerDto = {
  customerId: number;
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  createdUtc: string;
};

export type ProductDto = {
  productId: number;
  sku: string | null;
  name: string;
  unitPrice: number;
  isActive: boolean;
  createdUtc: string;
};
