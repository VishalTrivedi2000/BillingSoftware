import { authApi } from '../../shared/api/axiosClient';
import type {
  BatchBrowseResult,
  BatchDto,
  CreateBatchBody,
  CreateProductSerialBody,
  CreateProductVariantBody,
  CreateReservationBody,
  CreateReturnBody,
  CreateStockTransferBody,
  CreateWarehouseBody,
  ExpiryFefoReportRow,
  InventoryBalanceResult,
  InventoryDashboardDto,
  InventoryLedgerResult,
  InventoryTransactionDto,
  InventoryValuationReportRow,
  ItemProfitReportRow,
  LowStockReportRow,
  ProductSerialDto,
  ProductVariantDto,
  ReservationDto,
  ReservationSummaryDto,
  ReturnBrowseResult,
  ReturnDto,
  SerialBrowseResult,
  SerialTraceReportRow,
  StockAdjustmentResultDto,
  StockSummaryReport,
  StockTransferDto,
  StockTransferSummaryDto,
  SubmitStockAdjustmentBody,
  UpdateProductVariantBody,
  UpdateWarehouseBody,
  VariantBrowseResult,
  WarehouseDto,
} from '../../entities/inventory';

/* ============================================================================
   Warehouses — /api/v1/warehouses
   ============================================================================ */
export const inventoryApi = {
  warehouses: {
    list: async (activeOnly = false): Promise<WarehouseDto[]> => {
      const { data } = await authApi.get<WarehouseDto[]>(
        `/v1/warehouses?activeOnly=${activeOnly ? 'true' : 'false'}`,
      );
      return data;
    },
    get: async (warehouseId: number): Promise<WarehouseDto> => {
      const { data } = await authApi.get<WarehouseDto>(`/v1/warehouses/${warehouseId}`);
      return data;
    },
    create: async (body: CreateWarehouseBody): Promise<{ warehouseId: number }> => {
      const { data } = await authApi.post<{ warehouseId: number }>('/v1/warehouses', body);
      return data;
    },
    update: async (warehouseId: number, body: UpdateWarehouseBody): Promise<void> => {
      await authApi.put(`/v1/warehouses/${warehouseId}`, body);
    },
    remove: async (warehouseId: number): Promise<void> => {
      await authApi.delete(`/v1/warehouses/${warehouseId}`);
    },
  },

  /* ==========================================================================
     Product variants — /api/v1/variants and /api/v1/products/{id}/variants
     ========================================================================== */
  variants: {
    listByProduct: async (productId: number, activeOnly = false): Promise<ProductVariantDto[]> => {
      const { data } = await authApi.get<ProductVariantDto[]>(
        `/v1/products/${productId}/variants?activeOnly=${activeOnly ? 'true' : 'false'}`,
      );
      return data;
    },
    browse: async (params: {
      search?: string;
      productId?: number;
      categoryId?: number;
      activeOnly?: boolean;
      skip?: number;
      take?: number;
    }): Promise<VariantBrowseResult> => {
      const usp = new URLSearchParams();
      if (params.search) usp.set('search', params.search);
      if (params.productId != null) usp.set('productId', String(params.productId));
      if (params.categoryId != null) usp.set('categoryId', String(params.categoryId));
      if (params.activeOnly) usp.set('activeOnly', 'true');
      if (params.skip != null) usp.set('skip', String(params.skip));
      if (params.take != null) usp.set('take', String(params.take));
      const { data } = await authApi.get<VariantBrowseResult>(`/v1/variants?${usp.toString()}`);
      return data;
    },
    get: async (productVariantId: number): Promise<ProductVariantDto> => {
      const { data } = await authApi.get<ProductVariantDto>(`/v1/variants/${productVariantId}`);
      return data;
    },
    create: async (body: CreateProductVariantBody): Promise<{ productVariantId: number }> => {
      const { data } = await authApi.post<{ productVariantId: number }>('/v1/variants', body);
      return data;
    },
    update: async (productVariantId: number, body: UpdateProductVariantBody): Promise<void> => {
      await authApi.put(`/v1/variants/${productVariantId}`, body);
    },
    remove: async (productVariantId: number): Promise<void> => {
      await authApi.delete(`/v1/variants/${productVariantId}`);
    },
    ensureDefault: async (productId: number): Promise<{ productVariantId: number }> => {
      const { data } = await authApi.post<{ productVariantId: number }>(
        `/v1/products/${productId}/variants/default`,
      );
      return data;
    },
  },

  /* ==========================================================================
     Inventory ledger / balances / dashboard / adjustments — /api/v1/inventory
     ========================================================================== */
  inventory: {
    dashboard: async (): Promise<InventoryDashboardDto> => {
      const { data } = await authApi.get<InventoryDashboardDto>('/v1/inventory/dashboard');
      return data;
    },
    balances: async (params: {
      warehouseId?: number;
      productId?: number;
      categoryId?: number;
      search?: string;
      lowStockOnly?: boolean;
      skip?: number;
      take?: number;
    }): Promise<InventoryBalanceResult> => {
      const usp = new URLSearchParams();
      if (params.warehouseId != null) usp.set('warehouseId', String(params.warehouseId));
      if (params.productId != null) usp.set('productId', String(params.productId));
      if (params.categoryId != null) usp.set('categoryId', String(params.categoryId));
      if (params.search) usp.set('search', params.search);
      if (params.lowStockOnly) usp.set('lowStockOnly', 'true');
      if (params.skip != null) usp.set('skip', String(params.skip));
      if (params.take != null) usp.set('take', String(params.take));
      const { data } = await authApi.get<InventoryBalanceResult>(
        `/v1/inventory/balances?${usp.toString()}`,
      );
      return data;
    },
    ledger: async (params: {
      warehouseId?: number;
      productVariantId?: number;
      productId?: number;
      transactionType?: string;
      search?: string;
      fromUtc?: string;
      toUtc?: string;
      skip?: number;
      take?: number;
    }): Promise<InventoryLedgerResult> => {
      const usp = new URLSearchParams();
      if (params.warehouseId != null) usp.set('warehouseId', String(params.warehouseId));
      if (params.productVariantId != null)
        usp.set('productVariantId', String(params.productVariantId));
      if (params.productId != null) usp.set('productId', String(params.productId));
      if (params.transactionType) usp.set('transactionType', params.transactionType);
      if (params.search) usp.set('search', params.search);
      if (params.fromUtc) usp.set('fromUtc', params.fromUtc);
      if (params.toUtc) usp.set('toUtc', params.toUtc);
      if (params.skip != null) usp.set('skip', String(params.skip));
      if (params.take != null) usp.set('take', String(params.take));
      const { data } = await authApi.get<InventoryLedgerResult>(
        `/v1/inventory/ledger?${usp.toString()}`,
      );
      return data;
    },
    getTransaction: async (id: number): Promise<InventoryTransactionDto> => {
      const { data } = await authApi.get<InventoryTransactionDto>(`/v1/inventory/ledger/${id}`);
      return data;
    },
    submitAdjustment: async (
      body: SubmitStockAdjustmentBody,
    ): Promise<StockAdjustmentResultDto> => {
      const { data } = await authApi.post<StockAdjustmentResultDto>(
        '/v1/inventory/adjustments',
        body,
      );
      return data;
    },
    approveAdjustment: async (adjustmentApprovalId: number): Promise<void> => {
      await authApi.post(`/v1/inventory/adjustments/${adjustmentApprovalId}/approve`);
    },
  },

  /* ==========================================================================
     Stock transfers — /api/v1/stock-transfers
     ========================================================================== */
  transfers: {
    list: async (params: {
      status?: string;
      skip?: number;
      take?: number;
    }): Promise<StockTransferSummaryDto[]> => {
      const usp = new URLSearchParams();
      if (params.status) usp.set('status', params.status);
      if (params.skip != null) usp.set('skip', String(params.skip));
      if (params.take != null) usp.set('take', String(params.take));
      const { data } = await authApi.get<StockTransferSummaryDto[]>(
        `/v1/stock-transfers?${usp.toString()}`,
      );
      return data;
    },
    get: async (stockTransferId: number): Promise<StockTransferDto> => {
      const { data } = await authApi.get<StockTransferDto>(
        `/v1/stock-transfers/${stockTransferId}`,
      );
      return data;
    },
    create: async (body: CreateStockTransferBody): Promise<{ stockTransferId: number }> => {
      const { data } = await authApi.post<{ stockTransferId: number }>('/v1/stock-transfers', body);
      return data;
    },
  },

  /* ==========================================================================
     Inventory reservations — /api/v1/inventory/reservations
     ========================================================================== */
  reservations: {
    list: async (params: {
      status?: string;
      skip?: number;
      take?: number;
    }): Promise<ReservationSummaryDto[]> => {
      const usp = new URLSearchParams();
      if (params.status) usp.set('status', params.status);
      if (params.skip != null) usp.set('skip', String(params.skip));
      if (params.take != null) usp.set('take', String(params.take));
      const { data } = await authApi.get<ReservationSummaryDto[]>(
        `/v1/inventory/reservations?${usp.toString()}`,
      );
      return data;
    },
    get: async (reservationId: number): Promise<ReservationDto> => {
      const { data } = await authApi.get<ReservationDto>(
        `/v1/inventory/reservations/${reservationId}`,
      );
      return data;
    },
    create: async (body: CreateReservationBody): Promise<{ reservationId: number }> => {
      const { data } = await authApi.post<{ reservationId: number }>(
        '/v1/inventory/reservations',
        body,
      );
      return data;
    },
    release: async (reservationId: number): Promise<void> => {
      await authApi.post(`/v1/inventory/reservations/${reservationId}/release`);
    },
    expireDue: async (): Promise<{ expired: boolean }> => {
      const { data } = await authApi.post<{ expired: boolean }>(
        '/v1/inventory/reservations/expire-due',
      );
      return data;
    },
  },

  /* ==========================================================================
     Batches & serials — /api/v1/batches and /api/v1/serials
     ========================================================================== */
  batches: {
    browse: async (params: {
      productVariantId?: number;
      search?: string;
      qualityStatus?: string;
      expiryBeforeUtc?: string;
      skip?: number;
      take?: number;
    }): Promise<BatchBrowseResult> => {
      const usp = new URLSearchParams();
      if (params.productVariantId != null)
        usp.set('productVariantId', String(params.productVariantId));
      if (params.search) usp.set('search', params.search);
      if (params.qualityStatus) usp.set('qualityStatus', params.qualityStatus);
      if (params.expiryBeforeUtc) usp.set('expiryBeforeUtc', params.expiryBeforeUtc);
      if (params.skip != null) usp.set('skip', String(params.skip));
      if (params.take != null) usp.set('take', String(params.take));
      const { data } = await authApi.get<BatchBrowseResult>(`/v1/batches?${usp.toString()}`);
      return data;
    },
    get: async (batchId: number): Promise<BatchDto> => {
      const { data } = await authApi.get<BatchDto>(`/v1/batches/${batchId}`);
      return data;
    },
    create: async (body: CreateBatchBody): Promise<{ batchId: number }> => {
      const { data } = await authApi.post<{ batchId: number }>('/v1/batches', body);
      return data;
    },
  },

  serials: {
    browse: async (params: {
      productId?: number;
      productVariantId?: number;
      warehouseId?: number;
      status?: string;
      search?: string;
      skip?: number;
      take?: number;
    }): Promise<SerialBrowseResult> => {
      const usp = new URLSearchParams();
      if (params.productId != null) usp.set('productId', String(params.productId));
      if (params.productVariantId != null)
        usp.set('productVariantId', String(params.productVariantId));
      if (params.warehouseId != null) usp.set('warehouseId', String(params.warehouseId));
      if (params.status) usp.set('status', params.status);
      if (params.search) usp.set('search', params.search);
      if (params.skip != null) usp.set('skip', String(params.skip));
      if (params.take != null) usp.set('take', String(params.take));
      const { data } = await authApi.get<SerialBrowseResult>(`/v1/serials?${usp.toString()}`);
      return data;
    },
    get: async (productSerialId: number): Promise<ProductSerialDto> => {
      const { data } = await authApi.get<ProductSerialDto>(`/v1/serials/${productSerialId}`);
      return data;
    },
    create: async (body: CreateProductSerialBody): Promise<{ productSerialId: number }> => {
      const { data } = await authApi.post<{ productSerialId: number }>('/v1/serials', body);
      return data;
    },
  },

  /* ==========================================================================
     Returns / RMA — /api/v1/returns
     ========================================================================== */
  returns: {
    browse: async (params: {
      returnType?: string;
      status?: string;
      search?: string;
      fromUtc?: string;
      toUtc?: string;
      skip?: number;
      take?: number;
    }): Promise<ReturnBrowseResult> => {
      const usp = new URLSearchParams();
      if (params.returnType) usp.set('returnType', params.returnType);
      if (params.status) usp.set('status', params.status);
      if (params.search) usp.set('search', params.search);
      if (params.fromUtc) usp.set('fromUtc', params.fromUtc);
      if (params.toUtc) usp.set('toUtc', params.toUtc);
      if (params.skip != null) usp.set('skip', String(params.skip));
      if (params.take != null) usp.set('take', String(params.take));
      const { data } = await authApi.get<ReturnBrowseResult>(`/v1/returns?${usp.toString()}`);
      return data;
    },
    get: async (returnAuthorizationId: number): Promise<ReturnDto> => {
      const { data } = await authApi.get<ReturnDto>(`/v1/returns/${returnAuthorizationId}`);
      return data;
    },
    create: async (body: CreateReturnBody): Promise<{ returnAuthorizationId: number }> => {
      const { data } = await authApi.post<{ returnAuthorizationId: number }>('/v1/returns', body);
      return data;
    },
    approve: async (returnAuthorizationId: number): Promise<void> => {
      await authApi.post(`/v1/returns/${returnAuthorizationId}/approve`);
    },
    receive: async (returnAuthorizationId: number): Promise<void> => {
      await authApi.post(`/v1/returns/${returnAuthorizationId}/receive`);
    },
    inspectComplete: async (returnAuthorizationId: number): Promise<void> => {
      await authApi.post(`/v1/returns/${returnAuthorizationId}/inspect-complete`);
    },
  },

  /* ==========================================================================
     Reports — /api/v1/inventory/reports
     ========================================================================== */
  reports: {
    stockSummary: async (params: {
      warehouseId?: number;
      categoryId?: number;
      search?: string;
    }): Promise<StockSummaryReport> => {
      const usp = new URLSearchParams();
      if (params.warehouseId != null) usp.set('warehouseId', String(params.warehouseId));
      if (params.categoryId != null) usp.set('categoryId', String(params.categoryId));
      if (params.search) usp.set('search', params.search);
      const { data } = await authApi.get<StockSummaryReport>(
        `/v1/inventory/reports/stock-summary?${usp.toString()}`,
      );
      return data;
    },
    lowStock: async (warehouseId?: number): Promise<LowStockReportRow[]> => {
      const usp = new URLSearchParams();
      if (warehouseId != null) usp.set('warehouseId', String(warehouseId));
      const { data } = await authApi.get<LowStockReportRow[]>(
        `/v1/inventory/reports/low-stock?${usp.toString()}`,
      );
      return data;
    },
    expiryFefo: async (params: {
      warehouseId?: number;
      daysWindow?: number;
    }): Promise<ExpiryFefoReportRow[]> => {
      const usp = new URLSearchParams();
      if (params.warehouseId != null) usp.set('warehouseId', String(params.warehouseId));
      if (params.daysWindow != null) usp.set('daysWindow', String(params.daysWindow));
      const { data } = await authApi.get<ExpiryFefoReportRow[]>(
        `/v1/inventory/reports/expiry-fefo?${usp.toString()}`,
      );
      return data;
    },
    serialTrace: async (params: {
      search?: string;
      productVariantId?: number;
      status?: string;
    }): Promise<SerialTraceReportRow[]> => {
      const usp = new URLSearchParams();
      if (params.search) usp.set('search', params.search);
      if (params.productVariantId != null)
        usp.set('productVariantId', String(params.productVariantId));
      if (params.status) usp.set('status', params.status);
      const { data } = await authApi.get<SerialTraceReportRow[]>(
        `/v1/inventory/reports/serial-trace?${usp.toString()}`,
      );
      return data;
    },
    itemProfit: async (params: {
      fromUtc?: string;
      toUtc?: string;
    }): Promise<ItemProfitReportRow[]> => {
      const usp = new URLSearchParams();
      if (params.fromUtc) usp.set('fromUtc', params.fromUtc);
      if (params.toUtc) usp.set('toUtc', params.toUtc);
      const { data } = await authApi.get<ItemProfitReportRow[]>(
        `/v1/inventory/reports/item-profit?${usp.toString()}`,
      );
      return data;
    },
    valuation: async (params: {
      warehouseId?: number;
      categoryId?: number;
      costingMethod?: string;
    }): Promise<InventoryValuationReportRow[]> => {
      const usp = new URLSearchParams();
      if (params.warehouseId != null) usp.set('warehouseId', String(params.warehouseId));
      if (params.categoryId != null) usp.set('categoryId', String(params.categoryId));
      if (params.costingMethod) usp.set('costingMethod', params.costingMethod);
      const { data } = await authApi.get<InventoryValuationReportRow[]>(
        `/v1/inventory/reports/valuation?${usp.toString()}`,
      );
      return data;
    },
  },
};
