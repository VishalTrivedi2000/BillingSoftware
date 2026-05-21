import { authApi } from '../../shared/api/axiosClient';
import type { ProductDto } from '../../entities/billing';
import type { ProductVariantDto } from '../../entities/inventory';
import { inventoryApi } from '../inventory/inventoryApi';

export type ProductImageDto = {
  productImageId: number;
  url: string;
  contentType: string;
  sortOrder: number;
  isPrimary: boolean;
  createdUtc: string;
};

export const productApi = {
  get: async (productId: number): Promise<ProductDto> => {
    const { data } = await authApi.get<ProductDto>(`/v1/products/${productId}`);
    return data;
  },

  create: async (body: Record<string, unknown>): Promise<number> => {
    const { data } = await authApi.post<{ productId: number }>('/v1/products', body);
    return data.productId;
  },

  update: async (productId: number, body: Record<string, unknown>): Promise<void> => {
    await authApi.patch(`/v1/products/${productId}`, body);
  },

  listImages: async (productId: number): Promise<ProductImageDto[]> => {
    const { data } = await authApi.get<ProductImageDto[]>(`/v1/products/${productId}/images`);
    return data;
  },

  uploadImage: async (
    productId: number,
    file: File,
    opts?: { primary?: boolean },
  ): Promise<ProductImageDto> => {
    const fd = new FormData();
    fd.append('file', file);
    const qs = opts?.primary ? '?primary=true' : '';
    const { data } = await authApi.post<{ imageId: number; url: string }>(
      `/v1/products/${productId}/images${qs}`,
      fd,
    );
    return {
      productImageId: data.imageId,
      url: data.url,
      contentType: file.type,
      sortOrder: 0,
      isPrimary: !!opts?.primary,
      createdUtc: new Date().toISOString(),
    };
  },

  deleteImage: async (productId: number, imageId: number): Promise<void> => {
    await authApi.delete(`/v1/products/${productId}/images/${imageId}`);
  },

  setPrimaryImage: async (productId: number, imageId: number): Promise<void> => {
    await authApi.patch(`/v1/products/${productId}/images/${imageId}/primary`);
  },

  listVariants: async (productId: number): Promise<ProductVariantDto[]> => {
    return inventoryApi.variants.listByProduct(productId, false);
  },

  ensureDefaultVariant: async (productId: number): Promise<number> => {
    const { productVariantId } = await inventoryApi.variants.ensureDefault(productId);
    return productVariantId;
  },
};
