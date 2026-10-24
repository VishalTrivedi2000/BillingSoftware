import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  Barcode,
  ChevronDown,
  GitBranch,
  ImagePlus,
  ExternalLink,
  Loader2,
  Package,
  Star,
  Hash,
  Tag,
  Warehouse,
  X,
} from 'lucide-react';
import type {
  ProductBrandDto,
  ProductCategoryDto,
  ProductDto,
  ProductUnitDto,
} from '../../entities/billing';
import type { InventoryTrackingMode, ProductVariantDto, WarehouseDto } from '../../entities/inventory';
import { InventoryTrackingModes } from '../../entities/inventory';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../auth/authSlice';
import { apiJsonAuth, authApi } from '../../shared/api/axiosClient';
import { inventoryApi } from '../inventory/inventoryApi';
import { productApi } from './productApi';
import { fmtInr } from '../inventory/inventoryHelpers';
import {
  CharCounter,
  Field,
  FormCard,
  InfoBanner,
  NumberInput,
  ProductTabBar,
  SelectInput,
  StockProPage,
  TextArea,
  TextInput,
  Toggle,
  type ProductTabId,
} from './productFormUi';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const OK_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DRAFT_KEY = 'billing.productCreate.draft';

export type VariantDraft = {
  key: string;
  sku: string;
  displayName: string;
  barcode: string;
  salePrice: string;
  purchasePrice: string;
  attributeLabel: string;
  additionalFields: CustomFieldDraft[];
};

/** Auto SKU from product name; user can override in the SKU field. */
export function generateSkuFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  let base = words
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8))
    .filter(Boolean)
    .join('-')
    .toUpperCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 28);
  if (!base) base = 'ITEM';
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `${base}-${suffix}`;
}

function emptyVariantDraft(parent: ProductFormState): VariantDraft {
  return {
    key: crypto.randomUUID(),
    sku: '',
    displayName: '',
    barcode: '',
    salePrice: parent.unitPrice,
    purchasePrice: parent.purchasePrice,
    attributeLabel: '',
    additionalFields: [],
  };
}

export type CustomFieldDraft = { key: string; value: string };

function variantAttributesFromDraft(v: VariantDraft): { key: string; value: string }[] {
  const attrs: { key: string; value: string }[] = [];
  const label = v.attributeLabel.trim();
  if (label) attrs.push({ key: 'Option', value: label });
  for (const f of v.additionalFields) {
    const key = f.key.trim();
    if (!key) continue;
    if (attrs.some((a) => a.key.toLowerCase() === key.toLowerCase())) continue;
    attrs.push({ key, value: f.value.trim() });
  }
  return attrs;
}

function AdditionalFieldsEditor({
  fields,
  onChange,
}: {
  fields: CustomFieldDraft[];
  onChange: (fields: CustomFieldDraft[]) => void;
}) {
  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <p className="mb-2 text-xs font-semibold text-slate-600">Additional fields</p>
      <p className="mb-2 text-[11px] text-slate-500">
        Optional key/value pairs (e.g. Color, Storage, Warranty note) stored on the variant.
      </p>
      <div className="space-y-2">
        {fields.map((row, idx) => (
          <div key={idx} className="flex gap-2">
            <TextInput
              placeholder="Field name"
              value={row.key}
              onChange={(e) => {
                const next = [...fields];
                next[idx] = { ...row, key: e.target.value };
                onChange(next);
              }}
              className="flex-1"
            />
            <TextInput
              placeholder="Value"
              value={row.value}
              onChange={(e) => {
                const next = [...fields];
                next[idx] = { ...row, value: e.target.value };
                onChange(next);
              }}
              className="flex-1"
            />
            <button
              type="button"
              className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-white"
              onClick={() => onChange(fields.filter((_, i) => i !== idx))}
              aria-label="Remove field"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-sm font-semibold text-blue-600 hover:underline"
          onClick={() => onChange([...fields, { key: '', value: '' }])}
        >
          + Add field
        </button>
      </div>
    </div>
  );
}

export type SerialDraft = {
  key: string;
  serialNumber: string;
  imei2: string;
  warehouseId: number | '';
  purchaseCost: string;
};

export type ProductFormState = {
  productType: 'simple' | 'variant' | 'service';
  name: string;
  sku: string;
  barcode: string;
  unitId: number | '';
  hsnCode: string;
  countryOfOrigin: string;
  shortDescription: string;
  description: string;
  internalCode: string;
  manufacturerPartNo: string;
  brandId: number | '';
  brandText: string;
  status: 'Active' | 'Inactive';
  visibility: string;
  trackInventory: boolean;
  allowNegativeStock: boolean;
  serializedTracking: boolean;
  batchTracking: boolean;
  tags: string[];
  categoryId: number | '';
  unitPrice: string;
  mrp: string;
  purchasePrice: string;
  wholesalePrice: string;
  minWholesaleQty: string;
  taxRatePercent: string;
  manufacturer: string;
  leadTimeDays: string;
  warrantyMonths: string;
  shelfLifeDays: string;
  isReturnable: boolean;
  isTaxApplicable: boolean;
  defaultWarehouseId: number | '';
  storageLocation: string;
  openingStock: string;
  reorderPoint: string;
  reorderQty: string;
  minStock: string;
  maxStock: string;
  lowStockAlert: boolean;
  variantDrafts: VariantDraft[];
  captureImeiSerial: boolean;
  serialDrafts: SerialDraft[];
};

function emptySerialDraft(purchaseCost = ''): SerialDraft {
  return {
    key: crypto.randomUUID(),
    serialNumber: '',
    imei2: '',
    warehouseId: '',
    purchaseCost,
  };
}

function serialCapturePatch(
  form: ProductFormState,
  enabled: boolean,
): Partial<ProductFormState> {
  if (!enabled) return { captureImeiSerial: false, serialDrafts: [] };
  const next: Partial<ProductFormState> = {
    captureImeiSerial: true,
    serializedTracking: true,
    trackInventory: true,
    productType: form.productType === 'service' ? 'simple' : form.productType,
  };
  if (form.serialDrafts.length === 0) {
    next.serialDrafts = [emptySerialDraft(form.purchasePrice)];
  }
  return next;
}

function SerialEntryFields({
  form,
  patch,
  warehouses,
  editId,
  isEdit,
}: {
  form: ProductFormState;
  patch: (p: Partial<ProductFormState>) => void;
  warehouses: WarehouseDto[];
  editId: number | null;
  isEdit: boolean;
}) {
  return (
    <div className="mt-4 space-y-3">
      {form.serialDrafts.map((row, idx) => (
        <div
          key={row.key}
          className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <Field label="IMEI / Serial" required className="lg:col-span-2">
            <div className="relative">
              <TextInput
                value={row.serialNumber}
                onChange={(e) => {
                  const next = [...form.serialDrafts];
                  next[idx] = { ...row, serialNumber: e.target.value };
                  patch({ serialDrafts: next });
                }}
                className="pr-9 font-mono text-sm"
                placeholder="357593980123456"
              />
              <Hash
                className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-400"
                aria-hidden
              />
            </div>
          </Field>
          <Field label="IMEI 2 (optional)">
            <TextInput
              value={row.imei2}
              onChange={(e) => {
                const next = [...form.serialDrafts];
                next[idx] = { ...row, imei2: e.target.value };
                patch({ serialDrafts: next });
              }}
              className="font-mono text-sm"
              placeholder="Second IMEI"
            />
          </Field>
          <Field label="Warehouse">
            <SelectInput
              value={row.warehouseId === '' ? '' : String(row.warehouseId)}
              onChange={(e) => {
                const next = [...form.serialDrafts];
                next[idx] = {
                  ...row,
                  warehouseId: e.target.value ? Number(e.target.value) : '',
                };
                patch({ serialDrafts: next });
              }}
            >
              <option value="">Default warehouse</option>
              {warehouses.map((w) => (
                <option key={w.warehouseId} value={w.warehouseId}>
                  {w.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <div className="flex items-end gap-2">
            <Field label="Purchase cost" className="flex-1">
              <NumberInput
                value={row.purchaseCost}
                onChange={(e) => {
                  const next = [...form.serialDrafts];
                  next[idx] = { ...row, purchaseCost: e.target.value };
                  patch({ serialDrafts: next });
                }}
                min={0}
                step="0.01"
                placeholder={form.purchasePrice || 'Unit cost'}
              />
            </Field>
            <button
              type="button"
              className="mb-0.5 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-white"
              onClick={() =>
                patch({
                  serialDrafts: form.serialDrafts.filter((_, i) => i !== idx),
                })
              }
              aria-label="Remove serial row"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          patch({
            serialDrafts: [...form.serialDrafts, emptySerialDraft(form.purchasePrice)],
          })
        }
        className="rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
      >
        + Add another IMEI / serial
      </button>
      {isEdit && editId && (
        <p className="text-xs text-slate-500">
          View all serials on the{' '}
          <Link to={`/products/${editId}`} className="font-semibold text-blue-600 hover:underline">
            product view
          </Link>{' '}
          page (Serials / IMEI tab) or{' '}
          <Link to="/inventory/serials" className="font-semibold text-blue-600 hover:underline">
            Inventory → Serials
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function defaultForm(): ProductFormState {
  return {
    productType: 'simple',
    name: '',
    sku: '',
    barcode: '',
    unitId: '',
    hsnCode: '',
    countryOfOrigin: 'India',
    shortDescription: '',
    description: '',
    internalCode: '',
    manufacturerPartNo: '',
    brandId: '',
    brandText: '',
    status: 'Active',
    visibility: 'Visible in Sales Channels',
    trackInventory: true,
    allowNegativeStock: false,
    serializedTracking: false,
    batchTracking: false,
    tags: [],
    categoryId: '',
    unitPrice: '',
    mrp: '',
    purchasePrice: '',
    wholesalePrice: '',
    minWholesaleQty: '',
    taxRatePercent: '',
    manufacturer: '',
    leadTimeDays: '',
    warrantyMonths: '12',
    shelfLifeDays: '',
    isReturnable: true,
    isTaxApplicable: true,
    defaultWarehouseId: '',
    storageLocation: '',
    openingStock: '0',
    reorderPoint: '',
    reorderQty: '',
    minStock: '',
    maxStock: '',
    lowStockAlert: true,
    variantDrafts: [],
    captureImeiSerial: false,
    serialDrafts: [],
  };
}

function parseTags(raw?: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw.split(',').map((t) => t.trim()).filter(Boolean);
}

function trackingFromApi(mode?: string | null): Pick<
  ProductFormState,
  'serializedTracking' | 'batchTracking'
> {
  const m = mode ?? InventoryTrackingModes.Quantity;
  return {
    serializedTracking: m === InventoryTrackingModes.Serial || m === InventoryTrackingModes.BatchAndSerial,
    batchTracking: m === InventoryTrackingModes.Batch || m === InventoryTrackingModes.BatchAndSerial,
  };
}

function productToForm(p: ProductDto): ProductFormState {
  const f = defaultForm();
  f.name = p.name;
  f.sku = p.sku ?? '';
  f.brandId = p.brandId ?? '';
  f.brandText = p.brandId ? '' : (p.brand ?? '');
  f.manufacturer =
    p.manufacturer ?? (p.brandId ? '' : (p.brand ?? ''));
  f.categoryId = p.categoryId ?? '';
  f.unitId = p.unitId ?? '';
  f.unitPrice = String(p.unitPrice);
  f.mrp = p.mrp != null ? String(p.mrp) : '';
  f.purchasePrice = p.purchasePrice != null ? String(p.purchasePrice) : '';
  f.wholesalePrice = p.wholesalePrice != null ? String(p.wholesalePrice) : '';
  f.minWholesaleQty = p.minWholesaleQty != null ? String(p.minWholesaleQty) : '';
  f.taxRatePercent = p.taxRatePercent != null ? String(p.taxRatePercent) : '';
  f.isTaxApplicable = p.taxRatePercent != null && p.taxRatePercent > 0;
  f.hsnCode = p.hsnCode ?? '';
  f.barcode = p.barcode ?? '';
  f.countryOfOrigin = p.countryOfOrigin ?? 'India';
  f.internalCode = p.internalCode ?? '';
  f.manufacturerPartNo = p.manufacturerPartNo ?? '';
  f.visibility = p.visibility ?? f.visibility;
  f.tags = parseTags(p.tags);
  f.allowNegativeStock = p.allowNegativeStock ?? false;
  f.leadTimeDays = p.leadTimeDays != null ? String(p.leadTimeDays) : '';
  f.warrantyMonths = p.warrantyMonths != null ? String(p.warrantyMonths) : '12';
  f.shelfLifeDays = p.shelfLifeDays != null ? String(p.shelfLifeDays) : '';
  f.isReturnable = p.isReturnable ?? true;
  f.reorderQty = p.reorderQty != null ? String(p.reorderQty) : '';
  f.maxStock = p.maxStock != null ? String(p.maxStock) : '';
  f.lowStockAlert = p.lowStockAlert ?? true;
  Object.assign(f, trackingFromApi(p.inventoryTrackingMode));
  f.captureImeiSerial =
    p.inventoryTrackingMode === InventoryTrackingModes.Serial ||
    p.inventoryTrackingMode === InventoryTrackingModes.BatchAndSerial;
  const desc = p.description ?? '';
  if (desc.includes('\n\n')) {
    const [short, ...rest] = desc.split('\n\n');
    f.shortDescription = short ?? '';
    f.description = rest.join('\n\n');
  } else {
    f.description = desc;
  }
  f.storageLocation = p.storageLocation ?? '';
  f.openingStock = String(p.stockQty ?? 0);
  f.reorderPoint = p.lowStockThreshold != null ? String(p.lowStockThreshold) : '';
  f.minStock = p.lowStockThreshold != null ? String(p.lowStockThreshold) : '';
  f.productType = p.isService ? 'service' : p.hasVariants ? 'variant' : 'simple';
  f.trackInventory = !p.isService;
  f.status = p.isActive ? 'Active' : 'Inactive';
  return f;
}

function parseOptNum(raw: string): number | null | undefined {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

function trackingMode(f: ProductFormState): InventoryTrackingMode | null {
  if (!f.trackInventory || f.productType === 'service') return InventoryTrackingModes.None;
  if (f.serializedTracking && f.batchTracking) return InventoryTrackingModes.BatchAndSerial;
  if (f.serializedTracking) return InventoryTrackingModes.Serial;
  if (f.batchTracking) return InventoryTrackingModes.Batch;
  return InventoryTrackingModes.Quantity;
}

function buildApiBody(f: ProductFormState): Record<string, unknown> | string {
  const name = f.name.trim();
  if (!name) return 'Product name is required.';
  const unitPriceRaw = f.unitPrice.trim();
  const unitPrice = unitPriceRaw === '' ? 0 : Number(unitPriceRaw);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return 'Sale price must be empty or a non-negative number.';
  const stock = f.productType === 'service' || !f.trackInventory ? 0 : Number(f.openingStock) || 0;
  if (stock < 0) return 'Opening stock must be non-negative.';

  const mrp = parseOptNum(f.mrp);
  if (mrp === undefined) return 'MRP must be empty or a valid number.';
  const purchasePrice = parseOptNum(f.purchasePrice);
  if (purchasePrice === undefined) return 'Purchase price must be empty or a valid number.';
  const wholesalePrice = parseOptNum(f.wholesalePrice);
  if (wholesalePrice === undefined) return 'Wholesale price must be empty or a valid number.';
  const minWholesaleQty = parseOptNum(f.minWholesaleQty);
  if (minWholesaleQty === undefined) return 'Min wholesale qty must be empty or a valid number.';
  const taxPct = f.isTaxApplicable ? parseOptNum(f.taxRatePercent) : null;
  if (taxPct === undefined) return 'Tax % must be empty or a valid number.';
  if (taxPct != null && taxPct > 100) return 'Tax % cannot exceed 100.';

  const low =
    parseOptNum(f.reorderPoint) ??
    parseOptNum(f.minStock) ??
    null;
  if (low === undefined) return 'Reorder / min stock must be valid numbers.';

  const descParts = [f.shortDescription.trim(), f.description.trim()].filter(Boolean);
  const description = descParts.length ? descParts.join('\n\n') : null;

  const leadTime = parseOptInt(f.leadTimeDays);
  if (leadTime === undefined) return 'Lead time must be empty or a valid whole number.';
  const warranty = parseOptInt(f.warrantyMonths);
  if (warranty === undefined) return 'Warranty months must be empty or a valid whole number.';
  const shelfLife = parseOptInt(f.shelfLifeDays);
  if (shelfLife === undefined) return 'Shelf life must be empty or a valid whole number.';
  const reorderQty = parseOptNum(f.reorderQty);
  if (reorderQty === undefined) return 'Reorder quantity must be empty or a valid number.';
  const maxStock = parseOptNum(f.maxStock);
  if (maxStock === undefined) return 'Max stock must be empty or a valid number.';

  return {
    sku: f.sku.trim() || null,
    name,
    brand: f.brandId !== '' ? null : f.brandText.trim() || null,
    manufacturer: f.manufacturer.trim() || null,
    unitPrice,
    categoryId: f.categoryId === '' ? null : f.categoryId,
    brandId: f.brandId === '' ? null : f.brandId,
    unitId: f.unitId === '' ? null : f.unitId,
    stockQty: stock,
    lowStockThreshold: low,
    hsnCode: f.hsnCode.trim() || null,
    description,
    mrp,
    purchasePrice,
    wholesalePrice,
    minWholesaleQty,
    taxRatePercent: f.isTaxApplicable ? taxPct : null,
    storageLocation: f.storageLocation.trim() || null,
    isService: f.productType === 'service' || !f.trackInventory,
    tags: f.tags.length ? f.tags.join(', ') : null,
    barcode: f.barcode.trim() || null,
    countryOfOrigin: f.countryOfOrigin.trim() || null,
    internalCode: f.internalCode.trim() || null,
    manufacturerPartNo: f.manufacturerPartNo.trim() || null,
    visibility: f.visibility.trim() || null,
    inventoryTrackingMode: trackingMode(f),
    productNature:
      f.productType === 'service' ? 'Service' : f.productType === 'variant' ? 'Physical' : 'Physical',
    allowNegativeStock: f.allowNegativeStock,
    leadTimeDays: leadTime,
    warrantyMonths: warranty,
    shelfLifeDays: shelfLife,
    isReturnable: f.isReturnable,
    reorderQty,
    maxStock,
    lowStockAlert: f.lowStockAlert,
  };
}

function parseOptInt(raw: string): number | null | undefined {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return undefined;
  return n;
}

const TABS = [
  { id: 'basic' as const, label: 'Basic Information', icon: Package },
  { id: 'variants' as const, label: 'Variants', icon: GitBranch },
  { id: 'inventory' as const, label: 'Inventory Rules', icon: Warehouse },
  { id: 'images' as const, label: 'Images & Documents', icon: ImagePlus },
];

type LocationNotice = { notice?: string; openTab?: ProductTabId };

export function CreateProductPage() {
  const { productId: productIdParam } = useParams();
  const editId = productIdParam ? Number(productIdParam) : null;
  const isEdit = editId != null && Number.isFinite(editId);
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const authed = useAppSelector(selectIsAuthenticated);
  const orgId = useAppSelector(selectWorkplaceSnapshot)?.organizationId ?? 0;
  const enabled = authed;

  const [tab, setTab] = useState<ProductTabId>('basic');
  const [form, setForm] = useState<ProductFormState>(defaultForm);
  const [variantsProductId, setVariantsProductId] = useState<number | ''>('');
  const skuUserEditedRef = useRef(false);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [photoWarning, setPhotoWarning] = useState<string | null>(
    () => (location.state as LocationNotice | null)?.notice ?? null,
  );
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const imageRef = useRef<HTMLInputElement>(null);
  const formHydratedRef = useRef(false);

  const patch = (partial: Partial<ProductFormState>) => setForm((f) => ({ ...f, ...partial }));

  const categoriesQ = useQuery({
    queryKey: ['product-categories', orgId],
    queryFn: () => apiJsonAuth<ProductCategoryDto[]>('/v1/product-categories'),
    enabled,
  });
  const brandsQ = useQuery({
    queryKey: ['product-brands', orgId],
    queryFn: () => apiJsonAuth<ProductBrandDto[]>('/v1/product-brands'),
    enabled,
  });
  const unitsQ = useQuery({
    queryKey: ['product-units', orgId],
    queryFn: () => apiJsonAuth<ProductUnitDto[]>('/v1/product-units'),
    enabled,
  });
  const warehousesQ = useQuery({
    queryKey: ['product-form-warehouses', orgId],
    queryFn: () => inventoryApi.warehouses.list(true),
    enabled,
  });

  const productQ = useQuery({
    queryKey: ['product-edit', editId],
    queryFn: () => productApi.get(editId!),
    enabled: enabled && isEdit,
  });

  const productsPickQ = useQuery({
    queryKey: ['products-pick-variants', orgId],
    queryFn: async () => {
      const { data } = await authApi.get<ProductDto[]>('/v1/products?activeOnly=false&max=500');
      return data;
    },
    enabled,
  });

  /** Ensures the open product always appears in the Variants dropdown (fixes stale list after create). */
  const variantProductOptions = useMemo(() => {
    const byId = new Map<number, ProductDto>();
    for (const p of productsPickQ.data ?? []) byId.set(p.productId, p);
    if (productQ.data) byId.set(productQ.data.productId, productQ.data);
    if (isEdit && editId && !byId.has(editId)) {
      if (productQ.data) byId.set(editId, productQ.data);
      else if (form.name.trim()) {
        byId.set(editId, {
          productId: editId,
          name: form.name.trim(),
          sku: form.sku.trim() || null,
          unitPrice: Number(form.unitPrice) || 0,
          isActive: form.status === 'Active',
          createdUtc: new Date().toISOString(),
        } as ProductDto);
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [productsPickQ.data, productQ.data, isEdit, editId, form.name, form.sku]);

  useEffect(() => {
    if (isEdit && editId) setVariantsProductId(editId);
  }, [isEdit, editId]);

  useEffect(() => {
    const st = location.state as { openTab?: ProductTabId } | null;
    if (st?.openTab) setTab(st.openTab);
  }, [location.state]);

  const variantsQ = useQuery({
    queryKey: ['product-variants', variantsProductId],
    queryFn: () => productApi.listVariants(variantsProductId as number),
    enabled: enabled && variantsProductId !== '',
  });

  const imagesQ = useQuery({
    queryKey: ['product-images', editId],
    queryFn: () => productApi.listImages(editId!),
    enabled: enabled && isEdit,
  });

  const savedVariants = variantsQ.data ?? [];

  useEffect(() => {
    if (!productQ.data || formHydratedRef.current) return;
    setForm(productToForm(productQ.data));
    skuUserEditedRef.current = Boolean(productQ.data.sku?.trim());
    formHydratedRef.current = true;
  }, [productQ.data]);

  useEffect(() => {
    if (!isEdit || !variantsQ.data?.length) return;
    const def = variantsQ.data.find((v) => v.isDefault) ?? variantsQ.data[0];
    if (!def?.barcode) return;
    setForm((f) => (f.barcode.trim() ? f : { ...f, barcode: def.barcode ?? '' }));
  }, [isEdit, variantsQ.data]);

  useEffect(() => {
    formHydratedRef.current = false;
  }, [editId]);

  const setupHints = useMemo(() => {
    const missing: { label: string; tab: ProductTabId }[] = [];
    if (!form.categoryId) missing.push({ label: 'Category', tab: 'basic' });
    if (!form.brandId && !form.brandText.trim()) missing.push({ label: 'Brand', tab: 'basic' });
    if (!form.hsnCode.trim()) missing.push({ label: 'HSN / tax code', tab: 'basic' });
    if (!form.isTaxApplicable || !form.taxRatePercent.trim())
      missing.push({ label: 'Tax %', tab: 'basic' });
    if (!form.unitPrice.trim() || Number(form.unitPrice) === 0)
      missing.push({ label: 'Sale price', tab: 'basic' });
    if (form.trackInventory && savedVariants.length === 0 && form.variantDrafts.length === 0)
      missing.push({ label: 'Inventory variant', tab: 'variants' });
    if (form.captureImeiSerial && !form.serialDrafts.some((s) => s.serialNumber.trim()))
      missing.push({ label: 'IMEI / serial', tab: 'inventory' });
    if (isEdit && (imagesQ.data?.length ?? 0) === 0 && imageFiles.length === 0)
      missing.push({ label: 'Product photo', tab: 'images' });
    return missing;
  }, [form, savedVariants.length, isEdit, imagesQ.data?.length, imageFiles.length]);

  const brandOptions = useMemo(
    () => (brandsQ.data ?? []).filter((b) => b.isActive),
    [brandsQ.data],
  );
  const unitOptions = useMemo(
    () => (unitsQ.data ?? []).filter((u) => u.isActive),
    [unitsQ.data],
  );
  const flatCategories = useMemo(() => {
    const rows = (categoriesQ.data ?? []).filter((c) => c.isActive);
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  }, [categoriesQ.data]);

  const deleteImageMut = useMutation({
    mutationFn: ({ imageId }: { imageId: number }) => productApi.deleteImage(editId!, imageId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['product-images', editId] });
      void qc.invalidateQueries({ queryKey: ['products-browse'] });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Could not delete image.'),
  });

  const primaryImageMut = useMutation({
    mutationFn: ({ imageId }: { imageId: number }) => productApi.setPrimaryImage(editId!, imageId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['product-images', editId] });
      void qc.invalidateQueries({ queryKey: ['products-browse'] });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Could not set primary image.'),
  });

  const ensureVariantMut = useMutation({
    mutationFn: () => productApi.ensureDefaultVariant(variantsProductId as number),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['product-variants', variantsProductId] });
      setPhotoWarning('Default inventory variant created. You can add more variants below.');
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Could not create default variant.'),
  });

  async function syncDefaultVariantBarcode(productId: number, f: ProductFormState) {
    const barcode = f.barcode.trim();
    if (!barcode) return;
    const variants = await productApi.listVariants(productId);
    const def = variants.find((v) => v.isDefault) ?? variants[0];
    if (!def) return;
    if ((def.barcode ?? '').trim() === barcode) return;
    await inventoryApi.variants.update(def.productVariantId, {
      sku: def.sku,
      barcode,
      displayName: def.displayName,
      mrp: def.mrp,
      salePrice: def.salePrice,
      purchasePrice: def.purchasePrice,
      inventoryTrackingMode: def.inventoryTrackingMode,
      status: def.status,
      isActive: def.isActive,
      attributes: def.attributes ?? [],
    });
  }

  async function createVariantsForProduct(variantTargetId: number, savedProductId: number) {
    const mode = trackingMode(form);
    const newRows = form.variantDrafts.filter((v) => v.sku.trim() || v.displayName.trim());

    if (newRows.length > 0) {
      for (const v of newRows) {
        await inventoryApi.variants.create({
          productId: variantTargetId,
          sku: v.sku.trim() || form.sku.trim() || null,
          barcode: v.barcode.trim() || form.barcode.trim() || null,
          displayName: v.displayName.trim() || form.name.trim(),
          salePrice: Number(v.salePrice) || Number(form.unitPrice) || 0,
          purchasePrice: parseOptNum(v.purchasePrice) ?? parseOptNum(form.purchasePrice),
          mrp: parseOptNum(form.mrp),
          inventoryTrackingMode: mode,
          attributes: variantAttributesFromDraft(v),
        });
      }
    }

    if (form.productType === 'service' || !form.trackInventory) return;

    const ensureOn = async (pid: number) => {
      const existing = await productApi.listVariants(pid);
      if (existing.length === 0) await productApi.ensureDefaultVariant(pid);
    };

    await ensureOn(savedProductId);
    if (variantTargetId !== savedProductId) await ensureOn(variantTargetId);
  }

  async function registerSerialsForProduct(productId: number) {
    if (!form.captureImeiSerial) return;

    const rows = form.serialDrafts.filter((s) => s.serialNumber.trim());
    if (rows.length === 0) return;

    const variants = await productApi.listVariants(productId);
    const variantId =
      variants.find((v) => v.isDefault)?.productVariantId ?? variants[0]?.productVariantId;
    if (variantId == null) {
      throw new Error('Save a product variant before registering IMEI / serial numbers.');
    }

    const defaultWh = form.defaultWarehouseId === '' ? null : form.defaultWarehouseId;
    const defaultCost = parseOptNum(form.purchasePrice);

    for (const row of rows) {
      const serial = row.serialNumber.trim();
      await inventoryApi.serials.create({
        productVariantId: variantId,
        serialNumber: serial,
        imei1: serial,
        imei2: row.imei2.trim() || null,
        warehouseId: row.warehouseId !== '' ? row.warehouseId : defaultWh,
        purchaseCostPerUnit: parseOptNum(row.purchaseCost) ?? defaultCost,
      });
    }
  }

  const saveMut = useMutation({
    mutationFn: async (opts: { asDraft: boolean; stayOnPage?: boolean }) => {
      const body = buildApiBody(form);
      if (typeof body === 'string') throw new Error(body);

      if (form.captureImeiSerial) {
        if (!form.serializedTracking && !form.batchTracking) {
          throw new Error(
            'Turn on Serialized Tracking (Basic tab) before registering IMEI / serial numbers.',
          );
        }
        const hasSerial = form.serialDrafts.some((s) => s.serialNumber.trim());
        if (!hasSerial) {
          throw new Error('Enter at least one IMEI / serial number, or disable IMEI / Serial entry.');
        }
      }

      let productId = editId ?? undefined;
      if (isEdit && productId) {
        await productApi.update(productId, {
          ...body,
          isActive: form.status === 'Active' && !opts.asDraft,
        });
      } else {
        productId = await productApi.create(body);
      }

      const variantTarget =
        variantsProductId !== '' ? variantsProductId : productId;
      await createVariantsForProduct(variantTarget, productId);
      await syncDefaultVariantBarcode(productId, form);

      const serialFail: string[] = [];
      try {
        await registerSerialsForProduct(productId);
      } catch (e) {
        serialFail.push(e instanceof Error ? e.message : 'IMEI / serial registration failed.');
      }

      const failParts: string[] = [...serialFail];
      const hasPrimary = (imagesQ.data ?? []).some((i) => i.isPrimary);
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i]!;
        try {
          await productApi.uploadImage(productId, file, {
            primary: !hasPrimary && i === 0,
          });
        } catch (e) {
          failParts.push(
            `${file.name}: ${axios.isAxiosError(e) ? String(e.response?.data ?? e.message) : 'failed'}`,
          );
        }
      }
      return {
        productId,
        photoWarning: failParts.length ? failParts.join('; ') : null,
        stayOnPage: opts.stayOnPage ?? isEdit,
        created: !isEdit,
      };
    },
    onSuccess: async (r) => {
      formHydratedRef.current = false;
      setPhotoWarning(
        r.photoWarning ??
          (r.created
            ? 'Product saved. Use the tabs below to add category, tax, stock, variants, and photos.'
            : 'Product updated.'),
      );
      setImageFiles([]);
      if (imageRef.current) imageRef.current.value = '';
      patch({ variantDrafts: [], serialDrafts: [], captureImeiSerial: false });
      localStorage.removeItem(DRAFT_KEY);
      await qc.invalidateQueries({ queryKey: ['products-browse'] });
      await qc.invalidateQueries({ queryKey: ['products-pick-variants'] });
      await qc.invalidateQueries({ queryKey: ['products-pick'] });
      await qc.invalidateQueries({ queryKey: ['product-edit', r.productId] });
      await qc.invalidateQueries({ queryKey: ['product-variants', r.productId] });
      if (variantsProductId !== '' && variantsProductId !== r.productId) {
        await qc.invalidateQueries({ queryKey: ['product-variants', variantsProductId] });
      }
      await qc.invalidateQueries({ queryKey: ['product-images', r.productId] });
      await qc.invalidateQueries({ queryKey: ['product-serials', r.productId] });
      if (r.created) {
        setVariantsProductId(r.productId);
        setTab('variants');
        navigate(`/products/${r.productId}/edit`, {
          replace: true,
          state: {
            openTab: 'variants',
            notice:
              'Product created. A default inventory variant was added — add more variants below.',
          },
        });
        return;
      }
      if (variantsProductId !== '') {
        await qc.invalidateQueries({ queryKey: ['product-variants', variantsProductId] });
      }
      if (!r.stayOnPage) navigate('/products', { replace: true });
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : 'Save failed.');
    },
  });

  function saveDraftLocal() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      setError(null);
      setPhotoWarning('Draft saved on this device only.');
    } catch {
      setError('Could not save draft locally.');
    }
  }

  function loadDraftLocal() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ProductFormState> & {
        customFields?: CustomFieldDraft[];
      };
      const base = { ...defaultForm(), ...parsed };
      delete (base as { customFields?: CustomFieldDraft[] }).customFields;
      base.variantDrafts = (base.variantDrafts ?? []).map((v) => ({
        ...emptyVariantDraft(base),
        ...v,
        additionalFields: v.additionalFields ?? [],
      }));
      setForm(base);
      setPhotoWarning('Draft restored from this device.');
    } catch {
      setError('Could not load draft.');
    }
  }

  function onSubmit(e: FormEvent, asDraft = false) {
    e.preventDefault();
    setError(null);
    if (!asDraft) setPhotoWarning(null);
    saveMut.mutate({ asDraft, stayOnPage: true });
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t || form.tags.includes(t)) return;
    patch({ tags: [...form.tags, t] });
    setTagInput('');
  }

  const uploadPending = useRef(false);

  async function onImagesPick(files: FileList | null) {
    if (!files?.length || uploadPending.current) return;
    const picked: File[] = [];
    for (const f of Array.from(files)) {
      if (!OK_IMAGE_TYPES.includes(f.type)) {
        setError('Images must be JPEG, PNG, WebP, or GIF.');
        return;
      }
      if (f.size > MAX_IMAGE_BYTES) {
        setError('Each image must be 5 MB or smaller.');
        return;
      }
      picked.push(f);
    }
    if (isEdit && editId) {
      uploadPending.current = true;
      setError(null);
      const fail: string[] = [];
      const hasPrimary = (imagesQ.data ?? []).some((i) => i.isPrimary);
      try {
        for (let i = 0; i < picked.length; i++) {
          try {
            await productApi.uploadImage(editId, picked[i]!, {
              primary: !hasPrimary && i === 0,
            });
          } catch (e) {
            fail.push(
              `${picked[i]!.name}: ${axios.isAxiosError(e) ? String(e.response?.data ?? e.message) : 'failed'}`,
            );
          }
        }
        await qc.invalidateQueries({ queryKey: ['product-images', editId] });
        await qc.invalidateQueries({ queryKey: ['products-browse'] });
        if (fail.length) setPhotoWarning(fail.join('; '));
        else setPhotoWarning('Images uploaded.');
      } finally {
        uploadPending.current = false;
      }
      return;
    }
    setImageFiles((prev) => [...prev, ...picked].slice(0, 12));
  }

  const skuPrefix = useMemo(() => {
    const s = form.sku.trim();
    const idx = s.lastIndexOf('-');
    return idx > 0 ? `${s.slice(0, idx + 1)}` : s ? `${s}-` : '—';
  }, [form.sku]);

  return (
    <StockProPage>
      <nav className="mb-2 text-sm text-slate-500" aria-label="Breadcrumb">
        <Link to="/products" className="hover:text-blue-600">
          Products
        </Link>
        <span className="mx-2 text-slate-300">›</span>
        <span className="font-medium text-slate-800">
          {isEdit ? 'Edit Product' : 'Create Product'}
        </span>
      </nav>

      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-bold text-slate-900">
          {isEdit ? 'Edit Product' : 'Create Product'}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/products"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Cancel
          </Link>
          {!isEdit && (
            <button
              type="button"
              onClick={saveDraftLocal}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Save as Draft
            </button>
          )}
          <button
            type="button"
            onClick={(e) => onSubmit(e as unknown as FormEvent)}
            disabled={saveMut.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-500 disabled:opacity-60"
          >
            {saveMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            Save Product
            <ChevronDown className="h-4 w-4 opacity-80" aria-hidden />
          </button>
        </div>
      </header>

      {(error || photoWarning) && (
        <div
          role="alert"
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            error
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-blue-200 bg-blue-50 text-blue-900'
          }`}
        >
          {error ?? photoWarning}
        </div>
      )}

      {isEdit && productQ.data && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm font-semibold text-slate-800">
            Editing: {productQ.data.name}
            <span className="ml-2 font-normal text-slate-500">#{productQ.data.productId}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Products can be created with only a name (e.g. Parle-G biscuit). Return here anytime to
            add category, tax, pricing, stock, variants, and photos.
          </p>
          {setupHints.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs font-medium text-slate-600">Still to set up:</span>
              {setupHints.map((h) => (
                <button
                  key={h.label}
                  type="button"
                  onClick={() => setTab(h.tab)}
                  className="rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
                >
                  {h.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={(e) => onSubmit(e)}>
        <ProductTabBar active={tab} onChange={setTab} tabs={TABS} />

        {tab === 'basic' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <FormCard title="Product Details" className="lg:col-span-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Product Type">
                  <SelectInput
                    value={form.productType}
                    onChange={(e) =>
                      patch({
                        productType: e.target.value as ProductFormState['productType'],
                        trackInventory: e.target.value !== 'service',
                      })
                    }
                  >
                    <option value="simple">Simple</option>
                    <option value="variant">Variant product</option>
                    <option value="service">Service (non-stock)</option>
                  </SelectInput>
                </Field>
                <Field label="Product Name" required className="sm:col-span-2">
                  <TextInput
                    value={form.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      if (!skuUserEditedRef.current) {
                        patch({ name, sku: name.trim() ? generateSkuFromName(name) : '' });
                      } else {
                        patch({ name });
                      }
                    }}
                    placeholder="Organic Basmati Rice 5kg"
                  />
                </Field>
                <Field
                  label="SKU"
                  hint="Auto-generated from name — you can edit anytime."
                >
                  <TextInput
                    value={form.sku}
                    onChange={(e) => {
                      skuUserEditedRef.current = true;
                      patch({ sku: e.target.value });
                    }}
                    placeholder="Auto-generated on name entry"
                  />
                </Field>
                <Field label="Unit of Measure">
                  <SelectInput
                    value={form.unitId === '' ? '' : String(form.unitId)}
                    onChange={(e) =>
                      patch({ unitId: e.target.value ? Number(e.target.value) : '' })
                    }
                  >
                    <option value="">Select unit…</option>
                    {unitOptions.map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.displayName} ({u.code})
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Barcode (EAN / UPC)">
                  <div className="relative">
                    <TextInput
                      value={form.barcode}
                      onChange={(e) => patch({ barcode: e.target.value })}
                      className="pr-10"
                      placeholder="8906123456789"
                    />
                    <Barcode
                      className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-400"
                      aria-hidden
                    />
                  </div>
                </Field>
                <Field label="HSN / SAC Code">
                  <TextInput
                    value={form.hsnCode}
                    onChange={(e) => patch({ hsnCode: e.target.value })}
                    placeholder="10063010"
                  />
                </Field>
                <Field label="Country of Origin">
                  <SelectInput
                    value={form.countryOfOrigin}
                    onChange={(e) => patch({ countryOfOrigin: e.target.value })}
                  >
                    <option>India</option>
                    <option>United States</option>
                    <option>Other</option>
                  </SelectInput>
                </Field>
                <Field label="Short Description" className="sm:col-span-2">
                  <div className="flex justify-end">
                    <CharCounter current={form.shortDescription.length} max={255} />
                  </div>
                  <TextInput
                    value={form.shortDescription}
                    onChange={(e) => patch({ shortDescription: e.target.value })}
                    maxLength={255}
                  />
                </Field>
                <Field label="Full Description" className="sm:col-span-2">
                  <div className="mb-1 flex justify-end">
                    <CharCounter current={form.description.length} max={5000} />
                  </div>
                  <TextArea
                    value={form.description}
                    onChange={(e) => patch({ description: e.target.value })}
                    rows={5}
                    maxLength={5000}
                  />
                </Field>
              </div>
            </FormCard>

            <div className="space-y-4">
              <FormCard title="Identifiers">
                <div className="space-y-3">
                  <Field label="Internal Code">
                    <TextInput
                      value={form.internalCode}
                      onChange={(e) => patch({ internalCode: e.target.value })}
                      placeholder="PRD-000123"
                    />
                  </Field>
                  <Field label="Manufacturer Part No.">
                    <TextInput
                      value={form.manufacturerPartNo}
                      onChange={(e) => patch({ manufacturerPartNo: e.target.value })}
                    />
                  </Field>
                  <Field label="SKU Prefix (auto)">
                    <TextInput value={skuPrefix} readOnly className="bg-slate-50" />
                  </Field>
                </div>
              </FormCard>

              <FormCard title="Product Status & Visibility">
                <div className="space-y-3">
                  <Field label="Status">
                    <SelectInput
                      value={form.status}
                      onChange={(e) =>
                        patch({ status: e.target.value as 'Active' | 'Inactive' })
                      }
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </SelectInput>
                  </Field>
                  <Field label="Visibility">
                    <SelectInput
                      value={form.visibility}
                      onChange={(e) => patch({ visibility: e.target.value })}
                    >
                      <option>Visible in Sales Channels</option>
                      <option>Hidden from catalog</option>
                    </SelectInput>
                  </Field>
                  <Toggle
                    label="Track Inventory"
                    checked={form.trackInventory}
                    onChange={(v) => patch({ trackInventory: v })}
                  />
                  <Toggle
                    label="Allow Negative Stock"
                    checked={form.allowNegativeStock}
                    onChange={(v) => patch({ allowNegativeStock: v })}
                  />
                  <Toggle
                    label="Serialized Tracking"
                    description="Required to track each unit by IMEI or serial number."
                    checked={form.serializedTracking}
                    onChange={(v) => {
                      patch({
                        serializedTracking: v,
                        ...(!v ? { captureImeiSerial: false, serialDrafts: [] } : {}),
                      });
                    }}
                  />
                  <Toggle
                    label="Batch / Expiry Tracking"
                    checked={form.batchTracking}
                    onChange={(v) => patch({ batchTracking: v })}
                  />
                  <div className="sm:col-span-2 border-t border-slate-100 pt-3">
                    <Toggle
                      label="Enter IMEI / Serial numbers"
                      description="Check to show IMEI fields below. Each unit is tracked individually; values are saved with the product."
                      checked={form.captureImeiSerial}
                      onChange={(v) => patch(serialCapturePatch(form, v))}
                    />
                    {form.captureImeiSerial && (
                      <SerialEntryFields
                        form={form}
                        patch={patch}
                        warehouses={warehousesQ.data ?? []}
                        editId={editId}
                        isEdit={isEdit}
                      />
                    )}
                  </div>
                </div>
              </FormCard>

              <FormCard title="Tags">
                <div className="flex flex-wrap gap-2">
                  {form.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                    >
                      <Tag className="h-3 w-3" aria-hidden />
                      {t}
                      <button
                        type="button"
                        className="text-slate-400 hover:text-rose-600"
                        onClick={() => patch({ tags: form.tags.filter((x) => x !== t) })}
                        aria-label={`Remove ${t}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <TextInput
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add tags…"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="shrink-0 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Add
                  </button>
                </div>
              </FormCard>
            </div>

            <FormCard title="Category & Brand" className="lg:col-span-3">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Category">
                  <SelectInput
                    value={form.categoryId === '' ? '' : String(form.categoryId)}
                    onChange={(e) =>
                      patch({ categoryId: e.target.value ? Number(e.target.value) : '' })
                    }
                  >
                    <option value="">Uncategorized</option>
                    {flatCategories.map((c) => (
                      <option key={c.categoryId} value={c.categoryId}>
                        {c.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Brand">
                  <SelectInput
                    value={form.brandId === '' ? '' : String(form.brandId)}
                    onChange={(e) => {
                      const id = e.target.value ? Number(e.target.value) : '';
                      const b = brandOptions.find((x) => x.brandId === id);
                      patch({ brandId: id, brandText: b?.name ?? form.brandText });
                    }}
                  >
                    <option value="">Select brand…</option>
                    {brandOptions.map((b) => (
                      <option key={b.brandId} value={b.brandId}>
                        {b.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Brand name (override)">
                  <TextInput
                    value={form.brandText}
                    onChange={(e) => patch({ brandText: e.target.value })}
                    placeholder="Green Earth"
                  />
                </Field>
              </div>
            </FormCard>

            <FormCard title="Pricing & Tax" className="lg:col-span-3">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Sale Price (Unit Price)">
                  <NumberInput
                    value={form.unitPrice}
                    onChange={(e) => patch({ unitPrice: e.target.value })}
                    min={0}
                    step="0.01"
                  />
                </Field>
                <Field label="MRP">
                  <NumberInput
                    value={form.mrp}
                    onChange={(e) => patch({ mrp: e.target.value })}
                    min={0}
                    step="0.01"
                  />
                </Field>
                <Field label="Purchase Price">
                  <NumberInput
                    value={form.purchasePrice}
                    onChange={(e) => patch({ purchasePrice: e.target.value })}
                    min={0}
                    step="0.01"
                  />
                </Field>
                <Field label="Wholesale Price">
                  <NumberInput
                    value={form.wholesalePrice}
                    onChange={(e) => patch({ wholesalePrice: e.target.value })}
                    min={0}
                    step="0.01"
                  />
                </Field>
                <Field label="Min Wholesale Qty">
                  <NumberInput
                    value={form.minWholesaleQty}
                    onChange={(e) => patch({ minWholesaleQty: e.target.value })}
                    min={0}
                  />
                </Field>
                <Field label="Tax applicable">
                  <SelectInput
                    value={form.isTaxApplicable ? 'yes' : 'no'}
                    onChange={(e) => patch({ isTaxApplicable: e.target.value === 'yes' })}
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </SelectInput>
                </Field>
                <Field label="Default GST / Tax %" hint="Used on invoices unless overridden.">
                  <NumberInput
                    value={form.taxRatePercent}
                    onChange={(e) => patch({ taxRatePercent: e.target.value })}
                    min={0}
                    max={100}
                    step="0.01"
                    disabled={!form.isTaxApplicable}
                  />
                </Field>
              </div>
            </FormCard>

            <FormCard title="Additional Information" className="lg:col-span-3">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Manufacturer / Supplier">
                  <TextInput
                    value={form.manufacturer}
                    onChange={(e) => patch({ manufacturer: e.target.value })}
                  />
                </Field>
                <Field label="Lead Time (Days)">
                  <NumberInput
                    value={form.leadTimeDays}
                    onChange={(e) => patch({ leadTimeDays: e.target.value })}
                    min={0}
                  />
                </Field>
                <Field label="Warranty Period (Months)">
                  <NumberInput
                    value={form.warrantyMonths}
                    onChange={(e) => patch({ warrantyMonths: e.target.value })}
                    min={0}
                  />
                </Field>
                <Field label="Shelf Life (Days)">
                  <NumberInput
                    value={form.shelfLifeDays}
                    onChange={(e) => patch({ shelfLifeDays: e.target.value })}
                    min={0}
                  />
                </Field>
                <Field label="Is Returnable">
                  <SelectInput
                    value={form.isReturnable ? 'yes' : 'no'}
                    onChange={(e) => patch({ isReturnable: e.target.value === 'yes' })}
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </SelectInput>
                </Field>
              </div>
            </FormCard>
          </div>
        )}

        {tab === 'variants' && (
          <FormCard title="Product Variants">
            <InfoBanner>
              Variants are managed on this tab. Select which product the new variants belong to, then add
              rows below. They are saved when you click Save Product (save the product first if it is new).
            </InfoBanner>

            {!isEdit && variantsProductId === '' ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Save the product on <strong>Basic Information</strong> first (click Save Product). You
                will then return here with this product selected and a default variant ready.
              </div>
            ) : (
              <Field
                label="Product"
                hint={
                  isEdit
                    ? 'This product is selected for viewing and adding variants.'
                    : 'Choose which product receives the new variant rows below.'
                }
              >
                <SelectInput
                  value={variantsProductId === '' ? '' : String(variantsProductId)}
                  onChange={(e) => {
                    const id = e.target.value === '' ? '' : Number(e.target.value);
                    setVariantsProductId(id);
                  }}
                >
                  {!isEdit && <option value="">Select product…</option>}
                  {variantProductOptions.map((p) => (
                    <option key={p.productId} value={p.productId}>
                      {p.sku ? `${p.sku} · ` : ''}
                      {p.name}
                      {isEdit && p.productId === editId ? ' (current)' : ''}
                    </option>
                  ))}
                </SelectInput>
                {productsPickQ.isLoading && (
                  <p className="mt-1 text-xs text-slate-500">Loading product list…</p>
                )}
                {isEdit && productQ.data && (
                  <p className="mt-2 text-xs text-slate-600">
                    Editing <strong>{productQ.data.name}</strong>
                    {productQ.data.sku ? ` · ${productQ.data.sku}` : ''}
                  </p>
                )}
              </Field>
            )}

            {variantsProductId !== '' && (
              <div className="mb-6 mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Saved variants ({savedVariants.length})
                  </h4>
                  <Link
                    to={`/inventory/variants?productId=${variantsProductId}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Open in Variants
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </Link>
                </div>
                {variantsQ.isLoading && (
                  <p className="text-sm text-slate-500">Loading variants…</p>
                )}
                {savedVariants.length === 0 && !variantsQ.isLoading && (
                  <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/80 px-4 py-3">
                    <p className="text-sm text-amber-900">No inventory variant yet for this product.</p>
                    <button
                      type="button"
                      disabled={ensureVariantMut.isPending}
                      onClick={() => ensureVariantMut.mutate()}
                      className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
                    >
                      {ensureVariantMut.isPending ? 'Creating…' : 'Create default variant'}
                    </button>
                  </div>
                )}
                {savedVariants.length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">SKU</th>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Barcode</th>
                          <th className="px-3 py-2 text-right">Sale price</th>
                          <th className="px-3 py-2">Tracking</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {savedVariants.map((v) => (
                          <SavedVariantRow key={v.productVariantId} v={v} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              Add new variants (saved on Submit)
            </h4>
            <div className="space-y-4">
              {form.variantDrafts.map((v, idx) => (
                <div
                  key={v.key}
                  className="rounded-xl border border-slate-200 bg-slate-50/80 p-4"
                >
                  <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Variant name / option">
                      <TextInput
                        placeholder="e.g. Deep Purple, 256GB"
                        value={v.displayName}
                        onChange={(e) => {
                          const displayName = e.target.value;
                          const next = [...form.variantDrafts];
                          const row = { ...v, displayName };
                          if (!row.sku.trim() && displayName.trim()) {
                            row.sku = generateSkuFromName(
                              `${form.sku || form.name}-${displayName}`,
                            );
                          }
                          next[idx] = row;
                          patch({ variantDrafts: next });
                        }}
                      />
                    </Field>
                    <Field label="Variant SKU" hint="Auto-suggested from name — editable.">
                      <TextInput
                        value={v.sku}
                        onChange={(e) => {
                          const next = [...form.variantDrafts];
                          next[idx] = { ...v, sku: e.target.value };
                          patch({ variantDrafts: next });
                        }}
                      />
                    </Field>
                    <Field label="Attribute label (optional)">
                      <TextInput
                        placeholder="Color, Size, Storage…"
                        value={v.attributeLabel}
                        onChange={(e) => {
                          const next = [...form.variantDrafts];
                          next[idx] = { ...v, attributeLabel: e.target.value };
                          patch({ variantDrafts: next });
                        }}
                      />
                    </Field>
                    <Field label="Barcode">
                      <TextInput
                        value={v.barcode}
                        onChange={(e) => {
                          const next = [...form.variantDrafts];
                          next[idx] = { ...v, barcode: e.target.value };
                          patch({ variantDrafts: next });
                        }}
                      />
                    </Field>
                    <Field label="Sale price">
                      <NumberInput
                        value={v.salePrice}
                        onChange={(e) => {
                          const next = [...form.variantDrafts];
                          next[idx] = { ...v, salePrice: e.target.value };
                          patch({ variantDrafts: next });
                        }}
                        min={0}
                        step="0.01"
                      />
                    </Field>
                    <Field label="Purchase price">
                      <NumberInput
                        value={v.purchasePrice}
                        onChange={(e) => {
                          const next = [...form.variantDrafts];
                          next[idx] = { ...v, purchasePrice: e.target.value };
                          patch({ variantDrafts: next });
                        }}
                        min={0}
                        step="0.01"
                      />
                    </Field>
                  </div>
                  <AdditionalFieldsEditor
                    fields={v.additionalFields}
                    onChange={(additionalFields) => {
                      const next = [...form.variantDrafts];
                      next[idx] = { ...v, additionalFields };
                      patch({ variantDrafts: next });
                    }}
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      onClick={() =>
                        patch({
                          variantDrafts: form.variantDrafts.filter((_, i) => i !== idx),
                        })
                      }
                    >
                      <X className="h-3.5 w-3.5" /> Remove variant
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  patch({
                    variantDrafts: [...form.variantDrafts, emptyVariantDraft(form)],
                  })
                }
                className="rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
              >
                + Add variant
              </button>
            </div>
          </FormCard>
        )}

        {tab === 'inventory' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FormCard title="IMEI / Serial numbers" className="lg:col-span-2">
              <InfoBanner>
                For phones and serialized goods, register each unit&apos;s IMEI or serial when receiving
                stock. Turn on <strong>Serialized Tracking</strong> on the Basic tab first.
              </InfoBanner>
              <Toggle
                label="Enter IMEI / Serial numbers"
                description="Same as on the Basic tab. Check to add IMEI / serial rows; saved when you click Save Product."
                checked={form.captureImeiSerial}
                onChange={(v) => patch(serialCapturePatch(form, v))}
              />
              {form.captureImeiSerial && (
                <SerialEntryFields
                  form={form}
                  patch={patch}
                  warehouses={warehousesQ.data ?? []}
                  editId={editId}
                  isEdit={isEdit}
                />
              )}
            </FormCard>

            <FormCard title="Default Warehouse & Stock">
              <InfoBanner>
                These settings are used as defaults when this product is added to inventory. Opening
                stock updates the product master quantity; use GRN or adjustments for warehouse-level
                ledger stock.
              </InfoBanner>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Default Warehouse">
                  <SelectInput
                    value={
                      form.defaultWarehouseId === '' ? '' : String(form.defaultWarehouseId)
                    }
                    onChange={(e) =>
                      patch({
                        defaultWarehouseId: e.target.value ? Number(e.target.value) : '',
                      })
                    }
                  >
                    <option value="">—</option>
                    {(warehousesQ.data ?? []).map((w: WarehouseDto) => (
                      <option key={w.warehouseId} value={w.warehouseId}>
                        {w.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Default Bin Location">
                  <TextInput
                    value={form.storageLocation}
                    onChange={(e) => patch({ storageLocation: e.target.value })}
                    placeholder="A-01-02"
                  />
                </Field>
                <Field label="Opening Stock">
                  <NumberInput
                    value={form.openingStock}
                    onChange={(e) => patch({ openingStock: e.target.value })}
                    min={0}
                    disabled={!form.trackInventory}
                  />
                </Field>
              </div>
            </FormCard>
            <FormCard title="Reorder & Stock Alerts">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Reorder Point">
                  <NumberInput
                    value={form.reorderPoint}
                    onChange={(e) => patch({ reorderPoint: e.target.value })}
                    min={0}
                  />
                </Field>
                <Field label="Reorder Quantity">
                  <NumberInput
                    value={form.reorderQty}
                    onChange={(e) => patch({ reorderQty: e.target.value })}
                    min={0}
                  />
                </Field>
                <Field label="Minimum Stock Level">
                  <NumberInput
                    value={form.minStock}
                    onChange={(e) => patch({ minStock: e.target.value })}
                    min={0}
                  />
                </Field>
                <Field label="Maximum Stock Level">
                  <NumberInput
                    value={form.maxStock}
                    onChange={(e) => patch({ maxStock: e.target.value })}
                    min={0}
                  />
                </Field>
                <Field label="Low Stock Alert" className="sm:col-span-2">
                  <SelectInput
                    value={form.lowStockAlert ? 'enable' : 'disable'}
                    onChange={(e) => patch({ lowStockAlert: e.target.value === 'enable' })}
                  >
                    <option value="enable">Enable</option>
                    <option value="disable">Disable</option>
                  </SelectInput>
                </Field>
              </div>
            </FormCard>
          </div>
        )}

        {tab === 'images' && (
          <FormCard title="Images & Documents" className="max-w-4xl">
            <input
              ref={imageRef}
              type="file"
              accept={OK_IMAGE_TYPES.join(',')}
              multiple
              className="hidden"
              onChange={(e) => void onImagesPick(e.target.files)}
            />

            {isEdit && (
              <div className="mb-6">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Uploaded images
                </h4>
                {imagesQ.isLoading && (
                  <p className="text-sm text-slate-500">Loading images…</p>
                )}
                {!imagesQ.isLoading && (imagesQ.data?.length ?? 0) === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    No images yet. Upload below.
                  </p>
                )}
                {(imagesQ.data?.length ?? 0) > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {(imagesQ.data ?? []).map((img) => (
                      <div
                        key={img.productImageId}
                        className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                      >
                        <img
                          src={img.url}
                          alt=""
                          className="aspect-square w-full object-cover"
                          loading="lazy"
                        />
                        {img.isPrimary && (
                          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            <Star className="h-3 w-3 fill-current" aria-hidden />
                            Primary
                          </span>
                        )}
                        <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6 opacity-0 transition group-hover:opacity-100">
                          {!img.isPrimary && (
                            <button
                              type="button"
                              className="flex-1 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-800 hover:bg-white"
                              disabled={primaryImageMut.isPending}
                              onClick={() => primaryImageMut.mutate({ imageId: img.productImageId })}
                            >
                              Set primary
                            </button>
                          )}
                          <button
                            type="button"
                            className="rounded-md bg-rose-600/90 px-2 py-1 text-[10px] font-semibold text-white hover:bg-rose-600"
                            disabled={deleteImageMut.isPending}
                            onClick={() => {
                              if (window.confirm('Delete this image?')) {
                                deleteImageMut.mutate({ imageId: img.productImageId });
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              {isEdit ? 'Upload more' : 'Upload images'}
            </h4>
            <button
              type="button"
              onClick={() => imageRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-10 text-sm font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50/50"
            >
              <ImagePlus className="h-8 w-8 text-blue-500" aria-hidden />
              {isEdit
                ? 'Add images (uploads immediately)'
                : 'Upload product images (JPEG, PNG, WebP, GIF — max 5 MB each)'}
            </button>
            {!isEdit && imageFiles.length > 0 && (
              <ul className="mt-4 space-y-2">
                <p className="text-xs font-medium text-slate-500">Pending upload (on Save Product):</p>
                {imageFiles.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
                  >
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-rose-600"
                      onClick={() => setImageFiles((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </FormCard>
        )}

        {!isEdit && (
          <p className="mt-6 text-center text-xs text-slate-500">
            <button type="button" className="text-blue-600 hover:underline" onClick={loadDraftLocal}>
              Restore local draft
            </button>
            {' · '}
            Only product name is required — SKU is auto-generated (editable). Use other tabs after save.
          </p>
        )}
      </form>
    </StockProPage>
  );
}

function SavedVariantRow({ v }: { v: ProductVariantDto }) {
  return (
    <tr className="hover:bg-slate-50/80">
      <td className="px-3 py-2 font-mono text-xs text-slate-700">{v.sku ?? '—'}</td>
      <td className="px-3 py-2 text-slate-800">{v.displayName ?? v.productName}</td>
      <td className="px-3 py-2 font-mono text-xs text-slate-600">{v.barcode ?? '—'}</td>
      <td className="px-3 py-2 text-right font-mono text-slate-800">
        {v.salePrice != null ? fmtInr(v.salePrice) : '—'}
      </td>
      <td className="px-3 py-2 text-xs text-slate-600">{v.inventoryTrackingMode ?? 'Quantity'}</td>
    </tr>
  );
}
