'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { commerceApi } from '../api/commerce-client';
import type {
  AdjustInventoryDto,
  CreateProductDto,
  UpdateProductDto,
} from '@sales-copilot/shared-contracts';

export function useProductMutations(workspaceId?: string) {
  const queryClient = useQueryClient();

  const invalidateCommerceQueries = () => {
    if (!workspaceId) return;
    queryClient.invalidateQueries({ queryKey: ['commerce-products', workspaceId] });
    queryClient.invalidateQueries({ queryKey: ['inventory-variants', workspaceId] });
    queryClient.invalidateQueries({ queryKey: ['inventory-summary', workspaceId] });
    queryClient.invalidateQueries({ queryKey: ['inventory-transactions', workspaceId] });
  };

  const createProductMutation = useMutation({
    mutationFn: async (dto: CreateProductDto) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await commerceApi.createProduct(workspaceId, dto);
      return res.data;
    },
    onSuccess: data => {
      invalidateCommerceQueries();
      toast.success(`Tạo sản phẩm "${data.name}" thành công`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Lỗi khi tạo sản phẩm');
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateProductDto }) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await commerceApi.updateProduct(workspaceId, id, dto);
      return res.data;
    },
    onSuccess: data => {
      invalidateCommerceQueries();
      toast.success(`Cập nhật sản phẩm "${data.name}" thành công`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Lỗi khi cập nhật sản phẩm');
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await commerceApi.deleteProduct(workspaceId, id);
      return res.data;
    },
    onSuccess: () => {
      invalidateCommerceQueries();
      toast.success('Đã lưu trữ sản phẩm thành công');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Lỗi khi xóa sản phẩm');
    },
  });

  const adjustInventoryMutation = useMutation({
    mutationFn: async ({
      productId,
      variantId,
      dto,
    }: {
      productId?: string;
      variantId: string;
      dto: AdjustInventoryDto;
    }) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      if (productId) {
        const res = await commerceApi.adjustVariantInventory(
          workspaceId,
          productId,
          variantId,
          dto,
        );
        return res.data;
      }
      const res = await commerceApi.adjustStockDirect(workspaceId, variantId, dto);
      return res.data;
    },
    onSuccess: () => {
      invalidateCommerceQueries();
      toast.success('Cập nhật tồn kho thành công');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Lỗi khi điều chỉnh tồn kho');
    },
  });

  return {
    createProduct: createProductMutation.mutateAsync,
    isCreating: createProductMutation.isPending,
    updateProduct: updateProductMutation.mutateAsync,
    isUpdating: updateProductMutation.isPending,
    deleteProduct: deleteProductMutation.mutateAsync,
    isDeleting: deleteProductMutation.isPending,
    adjustInventory: adjustInventoryMutation.mutateAsync,
    isAdjusting: adjustInventoryMutation.isPending,
  };
}
