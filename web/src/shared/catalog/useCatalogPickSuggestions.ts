import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ProductDto } from '../../entities/billing';
import { inventoryApi } from '../../features/inventory/inventoryApi';
import {
  buildCatalogPickSuggestions,
  buildCatalogPickSuggestionsForPurchase,
  normalizeProductSearch,
  type CatalogPickSuggestion,
} from './productCatalogPick';

const VARIANT_SEARCH_DEBOUNCE_MS = 220;

export function useCatalogPickSuggestions(
  searchText: string,
  products: ProductDto[],
  enabled: boolean,
  mode: 'sale' | 'purchase',
): { suggestions: CatalogPickSuggestion[]; variantsLoading: boolean; catalogLoading: boolean } {
  const q = normalizeProductSearch(searchText);
  const [debouncedQ, setDebouncedQ] = useState(q);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), VARIANT_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  const variantsQ = useQuery({
    queryKey: ['catalog-variant-pick', debouncedQ],
    queryFn: () =>
      inventoryApi.variants.browse({
        search: debouncedQ,
        activeOnly: true,
        take: 80,
      }),
    enabled: enabled && debouncedQ.length > 0,
    staleTime: 30_000,
  });

  const suggestions = useMemo(() => {
    const items = variantsQ.data?.items ?? [];
    if (mode === 'purchase') {
      return buildCatalogPickSuggestionsForPurchase(products, items, searchText);
    }
    return buildCatalogPickSuggestions(products, items, searchText);
  }, [mode, products, searchText, variantsQ.data?.items]);

  return {
    suggestions,
    variantsLoading: debouncedQ.length > 0 && variantsQ.isFetching,
    catalogLoading: false,
  };
}
