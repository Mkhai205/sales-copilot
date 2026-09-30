'use client';

import type { FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ProductFormValues } from './product-dialog-schema';

interface ProductGeneralTabProps {
  register: UseFormRegister<ProductFormValues>;
  setValue: UseFormSetValue<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  currentName: string;
  onNameChange: (val: string) => void;
  hasVariants: boolean;
  isEdit: boolean;
}

export function ProductGeneralTab({
  register,
  setValue,
  errors,
  currentName,
  onNameChange,
  hasVariants,
  isEdit,
}: ProductGeneralTabProps) {
  return (
    <TabsContent value="general" className="m-0 flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="prod-name" className="text-xs font-medium">
            Tên sản phẩm <span className="text-destructive">*</span>
          </Label>
          <Input
            id="prod-name"
            value={currentName}
            onChange={e => onNameChange(e.target.value)}
            placeholder="VD: Áo Polo Pique Cotton Slimfit"
            className="h-9 text-xs"
            required
          />
          {errors.name && (
            <span className="text-[11px] text-destructive">{errors.name.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prod-sku" className="text-xs font-medium">
            Mã SKU chính <span className="text-destructive">*</span>
          </Label>
          <Input
            id="prod-sku"
            {...register('sku', {
              onChange: e =>
                setValue('sku', e.target.value.toUpperCase(), { shouldValidate: true }),
            })}
            placeholder="VD: POLO-PIQUE-01"
            className="h-9 text-xs font-mono"
            required
          />
          {errors.sku && <span className="text-[11px] text-destructive">{errors.sku.message}</span>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prod-category" className="text-xs font-medium">
            Danh mục (Category tag)
          </Label>
          <Input
            id="prod-category"
            {...register('category')}
            placeholder="VD: Thời trang nam"
            className="h-9 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prod-base-price" className="text-xs font-medium">
            Giá bán lẻ (VNĐ) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="prod-base-price"
            type="number"
            min={0}
            {...register('basePrice')}
            className="h-9 text-xs"
            required
          />
          {errors.basePrice && (
            <span className="text-[11px] text-destructive">{errors.basePrice.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prod-cost-price" className="text-xs font-medium">
            Giá vốn ước tính (VNĐ)
          </Label>
          <Input
            id="prod-cost-price"
            type="number"
            min={0}
            {...register('costPrice')}
            className="h-9 text-xs"
          />
          {errors.costPrice && (
            <span className="text-[11px] text-destructive">{errors.costPrice.message}</span>
          )}
        </div>

        {!hasVariants && !isEdit && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prod-simple-stock" className="text-xs font-medium">
              Tồn kho ban đầu
            </Label>
            <Input
              id="prod-simple-stock"
              type="number"
              min={0}
              {...register('simpleStock')}
              className="h-9 text-xs"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prod-barcode" className="text-xs font-medium">
            Mã vạch (Barcode EAN-13)
          </Label>
          <Input
            id="prod-barcode"
            {...register('barcode')}
            placeholder="VD: 8935001827361"
            className="h-9 text-xs font-mono"
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="prod-image-url" className="text-xs font-medium">
            URL Ảnh đại diện
          </Label>
          <Input
            id="prod-image-url"
            type="url"
            {...register('imageUrl')}
            placeholder="https://... ảnh sản phẩm"
            className="h-9 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="prod-desc" className="text-xs font-medium">
            Mô tả sản phẩm
          </Label>
          <Textarea
            id="prod-desc"
            {...register('description')}
            placeholder="Thông tin chất liệu, form dáng, bảng size..."
            className="text-xs min-h-[70px]"
          />
        </div>
      </div>
    </TabsContent>
  );
}
