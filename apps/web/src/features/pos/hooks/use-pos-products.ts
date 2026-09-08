'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { normalizeVietnameseText } from '@sales-copilot/shared-contracts';
import { posApi } from '../api/pos-client';

export interface FlatProductVariant {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  price: number;
  costPrice: number;
  stockQuantity: number;
  reservedQuantity: number;
  availableStock: number;
  imageUrl?: string | null;
  searchTokens: string;
}

export function usePosProducts(workspaceId?: string) {
  const query = useQuery({
    queryKey: ['pos-products', workspaceId],
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await posApi.listProducts(workspaceId, {
        page: 1,
        limit: 100,
        sortBy: 'name',
        sortOrder: 'asc',
      });
      return res.data?.items || [];
    },
    enabled: Boolean(workspaceId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const variants = React.useMemo<FlatProductVariant[]>(() => {
    if (!query.data) return [];
    const list: FlatProductVariant[] = [];

    for (const prod of query.data) {
      for (const v of prod.variants || []) {
        const availableStock = Math.max(0, (v.stockQuantity || 0) - (v.reservedQuantity || 0));
        const searchTokens = normalizeVietnameseText(
          `${prod.name} ${v.name} ${v.sku} ${v.barcode || ''}`,
        );

        list.push({
          variantId: v.id,
          productId: prod.id,
          productName: prod.name,
          variantName: v.name,
          sku: v.sku,
          price: Number(v.price),
          costPrice: Number(v.costPrice || 0),
          stockQuantity: v.stockQuantity,
          reservedQuantity: v.reservedQuantity,
          availableStock,
          imageUrl: v.imageUrl || prod.images?.[0] || null,
          searchTokens,
        });
      }
    }

    return list;
  }, [query.data]);

  const searchVariants = React.useCallback(
    (searchQuery: string): FlatProductVariant[] => {
      if (!searchQuery.trim()) return variants;
      const normalizedQuery = normalizeVietnameseText(searchQuery);
      const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
      return variants.filter(v => tokens.every(token => v.searchTokens.includes(token)));
    },
    [variants],
  );

  return {
    ...query,
    products: query.data || [],
    variants,
    searchVariants,
  };
}
