import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  WorkspaceRole,
  adjustInventorySchema,
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
  type AdjustInventoryDto,
  type CreateProductDto,
  type InventoryTransactionResponseDto,
  type ListProductsQueryOutput,
  type PaginationMeta,
  type ProductResponseDto,
  type UpdateProductDto,
} from '@sales-copilot/shared-contracts';
import { ZodBody, ZodQuery } from '../../../common/pipes';
import { CurrentUser, type JwtUserPayload } from '../../auth';
import { CurrentWorkspace, Roles } from '../../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../../workspaces/guards';
import type { WorkspaceContext } from '../../workspaces/types/workspace-context.type';
import { ProductsService } from './products.service';

@ApiTags('POS Products')
@Controller(['workspaces/:workspaceId/products', 'products'])
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: false,
  description: 'Target Workspace UUID for tenant resolution (or via path parameter)',
})
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'List products with searching, barcode matching, and inventory status' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  async listProducts(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodQuery(listProductsQuerySchema) query: ListProductsQueryOutput,
  ): Promise<{ items: ProductResponseDto[]; meta: PaginationMeta }> {
    return this.productsService.listProducts(context.workspaceId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get product details by ID' })
  @ApiResponse({ status: 200, description: 'Product retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getProduct(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
  ): Promise<ProductResponseDto> {
    return this.productsService.getProductById(context.workspaceId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Create a new product with nested variants' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'SKU already exists' })
  async createProduct(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @ZodBody(createProductSchema) dto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.createProduct(context.workspaceId, dto, user?.userId);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Update product information and variants' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async updateProduct(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
    @ZodBody(updateProductSchema) dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.updateProduct(context.workspaceId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Soft delete product and its variants' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async deleteProduct(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.productsService.deleteProduct(context.workspaceId, id);
  }

  @Post(':id/variants/:variantId/inventory')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Manual inventory adjustment for a product variant' })
  @ApiResponse({ status: 200, description: 'Inventory adjusted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot reduce below reserved stock' })
  @ApiResponse({ status: 404, description: 'Product or variant not found' })
  async adjustInventory(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @ZodBody(adjustInventorySchema) dto: AdjustInventoryDto,
  ): Promise<InventoryTransactionResponseDto> {
    return this.productsService.adjustInventory(
      context.workspaceId,
      id,
      variantId,
      dto,
      user?.userId,
    );
  }
}
