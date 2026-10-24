export type InvoiceSelectedSerial = {
  productSerialId: number;
  serialNumber: string;
  imei2?: string | null;
  warehouseName?: string | null;
  purchaseCostPerUnit?: number | null;
};

export type InvoiceDraftLine = {
  key: string;
  productId: number | null;
  productVariantId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRatePercent: number;
  selectedSerials: InvoiceSelectedSerial[];
};

export type InvoiceComposerDraft = {
  customerId: number | '';
  billingAddress: string;
  gstin: string;
  warehouseId: number | '';
  orderDate: string;
  dueDate: string;
  paymentMethod: string;
  salesChannel: string;
  reference: string;
  shippingAmount: number;
  documentDiscount: number;
  amountPaid: number;
  shipToDifferent: boolean;
  deliveryRecipient: string;
  deliveryAddress: string;
  lines: InvoiceDraftLine[];
};

export type InvoiceComposerTab = {
  id: string;
  title: string;
};
