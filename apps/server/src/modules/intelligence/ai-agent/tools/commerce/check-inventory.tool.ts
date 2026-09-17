import { tool, type Tool } from 'ai';
import { z } from 'zod';
import type { InventoryLedgerService } from '../../../../commerce/inventory/inventory-ledger.service';
import type { PrismaService } from '../../../../../infrastructure/database/prisma.service';

export interface CheckInventoryToolOptions {
  workspaceId: string;
  inventoryLedgerService: InventoryLedgerService;
  prisma: PrismaService;
}

export const checkInventoryInputSchema = z.object({
  variantId: z.string().describe('ID của biến thể sản phẩm (variantId) cần kiểm tra tồn kho'),
});

export type CheckInventoryInput = z.infer<typeof checkInventoryInputSchema>;

export function createCheckInventoryTool({
  workspaceId,
  inventoryLedgerService,
  prisma,
}: CheckInventoryToolOptions): Tool {
  return tool({
    description:
      'Kiểm tra số lượng tồn kho khả dụng cho 1 biến thể sản phẩm cụ thể. Trả về số lượng tồn kho thực tế, số lượng khả dụng (availableStock) và trạng thái còn hàng (isInStock).',
    inputSchema: checkInventoryInputSchema,
    execute: async ({ variantId }: CheckInventoryInput) => {
      try {
        const client = prisma.getClient();
        const variant = await client.productVariant.findFirst({
          where: { id: variantId, workspaceId },
          select: { id: true, name: true, sku: true, isActive: true },
        });

        if (!variant || !variant.isActive) {
          return {
            error: 'VARIANT_NOT_FOUND',
            message: `Biến thể sản phẩm với ID '${variantId}' không tồn tại hoặc đã ngừng kinh doanh`,
          };
        }

        const stock = await inventoryLedgerService.getStock(workspaceId, variantId);

        return {
          variantId: stock.variantId,
          name: variant.name,
          sku: stock.sku,
          stockQuantity: stock.stockQuantity,
          reservedQuantity: stock.reservedQuantity,
          availableStock: stock.availableStock,
          isInStock: stock.availableStock > 0,
        };
      } catch (error: any) {
        if (error?.status === 404 || error?.code === 'VARIANT_NOT_FOUND') {
          return {
            error: 'VARIANT_NOT_FOUND',
            message: `Biến thể sản phẩm với ID '${variantId}' không tồn tại trong kho`,
          };
        }
        return {
          error: 'CHECK_INVENTORY_FAILED',
          message: error?.message || 'Không thể kiểm tra tồn kho lúc này',
        };
      }
    },
  });
}
