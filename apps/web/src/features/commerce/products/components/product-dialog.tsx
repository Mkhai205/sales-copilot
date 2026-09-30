'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { normalizeSku, type ProductResponseDto } from '@sales-copilot/shared-contracts';
import { useProductMutations } from '../hooks/use-product-mutations';
import { AlertCircle, CheckCircle } from 'lucide-react';
import {
  buildProductDefaultValues,
  productFormSchema,
  type AttributeGroup,
  type ProductFormValues,
  type VariantFormRow,
} from './product-dialog-schema';
import { ProductGeneralTab } from './product-general-tab';
import { ProductVariantsTab } from './product-variants-tab';

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  product?: ProductResponseDto | null;
  onSuccess?: () => void;
}

export function ProductDialog({
  open,
  onOpenChange,
  workspaceId,
  product,
  onSuccess,
}: ProductDialogProps) {
  const isEdit = Boolean(product);
  const { createProduct, updateProduct, isCreating, isUpdating } = useProductMutations(workspaceId);

  const [activeTab, setActiveTab] = React.useState<'general' | 'variants'>('general');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Variant generator fields
  const [attributes, setAttributes] = React.useState<AttributeGroup[]>([
    { id: '1', name: 'Kích cỡ', values: ['S', 'M', 'L'] },
    { id: '2', name: 'Màu sắc', values: ['Đen', 'Trắng'] },
  ]);
  const [newTagInput, setNewTagInput] = React.useState<Record<string, string>>({});

  const defaultValues = React.useMemo<ProductFormValues>(
    () => buildProductDefaultValues(product),
    [product],
  );

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    values: defaultValues,
    resetOptions: {
      keepDirtyValues: true,
    },
    mode: 'onChange',
  });

  const {
    fields: variantFields,
    append: appendVariant,
    remove: removeVariant,
    replace: replaceVariants,
  } = useFieldArray({
    control,
    name: 'variants',
  });

  const hasVariants = watch('hasVariants');
  const currentName = watch('name');
  const currentSku = watch('sku');
  const currentBasePrice = watch('basePrice');
  const currentCostPrice = watch('costPrice');

  // Auto-generate suggested master SKU from name if empty
  const handleNameChange = (val: string) => {
    setValue('name', val, { shouldValidate: true, shouldDirty: true });
    if (!isEdit && !currentSku) {
      setValue('sku', normalizeSku(val).slice(0, 15), { shouldValidate: true, shouldDirty: true });
    }
  };

  // Add attribute group
  const addAttributeGroup = () => {
    if (attributes.length >= 3) return;
    setAttributes(prev => [...prev, { id: String(Date.now()), name: '', values: [] }]);
  };

  // Remove attribute group
  const removeAttributeGroup = (id: string) => {
    setAttributes(prev => prev.filter(a => a.id !== id));
  };

  // Add tag to attribute group
  const addTagToAttribute = (groupId: string) => {
    const val = (newTagInput[groupId] || '').trim();
    if (!val) return;
    setAttributes(prev =>
      prev.map(g =>
        g.id === groupId && !g.values.includes(val) ? { ...g, values: [...g.values, val] } : g,
      ),
    );
    setNewTagInput(prev => ({ ...prev, [groupId]: '' }));
  };

  // Remove tag
  const removeTagFromAttribute = (groupId: string, tag: string) => {
    setAttributes(prev =>
      prev.map(g => (g.id === groupId ? { ...g, values: g.values.filter(v => v !== tag) } : g)),
    );
  };

  // Generate Cartesian Product of variants (Cap at 50)
  const generateVariantMatrix = () => {
    const validGroups = attributes.filter(g => g.name.trim() && g.values.length > 0);
    if (validGroups.length === 0) return;

    let combinations: Array<Record<string, string>> = [{}];
    for (const group of validGroups) {
      const nextCombos: Array<Record<string, string>> = [];
      for (const existing of combinations) {
        for (const val of group.values) {
          nextCombos.push({
            ...existing,
            [group.name.trim()]: val,
          });
        }
      }
      combinations = nextCombos;
    }

    if (combinations.length > 50) {
      setErrorMsg('Ma trận vượt quá 50 biến thể. Vui lòng giảm bớt thuộc tính.');
      return;
    }

    const baseMasterSku = normalizeSku(currentSku || currentName || 'SP');
    const newVariants: VariantFormRow[] = combinations.map(combo => {
      const comboValues = Object.values(combo);
      const varName = comboValues.join(' / ');
      const skuSuffix = comboValues.map(v => normalizeSku(v)).join('-');
      const generatedSku = `${baseMasterSku}-${skuSuffix}`;

      return {
        name: varName,
        sku: generatedSku,
        price: Number(currentBasePrice) || 0,
        costPrice: Number(currentCostPrice) || 0,
        stockQuantity: 0,
        attributes: combo,
      };
    });

    replaceVariants(newVariants);
    setErrorMsg(null);
  };

  // Add manual variant row
  const addManualVariant = () => {
    const index = variantFields.length + 1;
    const baseMasterSku = normalizeSku(currentSku || currentName || 'SP');
    appendVariant({
      name: `Biến thể ${index}`,
      sku: `${baseMasterSku}-VAR-${index}`,
      price: Number(currentBasePrice) || 0,
      costPrice: Number(currentCostPrice) || 0,
      stockQuantity: 0,
      attributes: {},
    });
  };

  const onSubmit = async (values: ProductFormValues) => {
    setErrorMsg(null);

    const normalizedMasterSku = normalizeSku(values.sku);
    if (!normalizedMasterSku) {
      setErrorMsg('Mã SKU là bắt buộc');
      return;
    }

    if (values.hasVariants && values.variants.length === 0) {
      setErrorMsg('Vui lòng tạo ít nhất một biến thể hoặc chọn sản phẩm đơn giản');
      return;
    }

    // Check variant SKU uniqueness
    if (values.hasVariants) {
      const skus = values.variants.map(v => normalizeSku(v.sku));
      if (new Set(skus).size !== skus.length) {
        setErrorMsg('Mã SKU các biến thể không được trùng nhau');
        return;
      }
    }

    try {
      if (isEdit && product) {
        await updateProduct({
          id: product.id,
          dto: {
            name: values.name.trim(),
            sku: normalizedMasterSku,
            category: values.category?.trim() || null,
            basePrice: Number(values.basePrice),
            costPrice: Number(values.costPrice),
            barcode: values.barcode?.trim() || null,
            imageUrl: values.imageUrl?.trim() || null,
            description: values.description?.trim() || null,
            variants: values.hasVariants
              ? values.variants.map(v => ({
                  id: v.id,
                  name: v.name,
                  sku: normalizeSku(v.sku),
                  barcode: v.barcode || null,
                  price: Number(v.price),
                  costPrice: Number(v.costPrice),
                  stockQuantity: Number(v.stockQuantity) || 0,
                  attributes: v.attributes,
                }))
              : product.variants && product.variants.length === 1
                ? [
                    {
                      id: product.variants[0].id,
                      name: product.variants[0].name,
                      sku: normalizedMasterSku,
                      barcode: values.barcode?.trim() || null,
                      price: Number(values.basePrice),
                      costPrice: Number(values.costPrice),
                      attributes: (product.variants[0].attributes as Record<string, string>) || {},
                    },
                  ]
                : undefined,
          },
        });
      } else {
        await createProduct({
          name: values.name.trim(),
          sku: normalizedMasterSku,
          category: values.category?.trim() || null,
          basePrice: Number(values.basePrice),
          costPrice: Number(values.costPrice),
          barcode: values.barcode?.trim() || null,
          imageUrl: values.imageUrl?.trim() || null,
          description: values.description?.trim() || null,
          variants: values.hasVariants
            ? values.variants.map(v => ({
                name: v.name,
                sku: normalizeSku(v.sku),
                barcode: v.barcode || null,
                price: Number(v.price),
                costPrice: Number(v.costPrice),
                stockQuantity: Number(v.stockQuantity) || 0,
                attributes: v.attributes,
              }))
            : [
                {
                  name: 'Tiêu chuẩn',
                  sku: normalizedMasterSku,
                  barcode: values.barcode?.trim() || null,
                  price: Number(values.basePrice),
                  costPrice: Number(values.costPrice),
                  stockQuantity: Number(values.simpleStock) || 0,
                  attributes: {},
                  imageUrl: values.imageUrl?.trim() || null,
                },
              ],
        });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu sản phẩm');
    }
  };

  const isSaving = isCreating || isUpdating;

  return (
    <Dialog
      open={open}
      onOpenChange={o => {
        if (!o) {
          reset();
          setErrorMsg(null);
          setActiveTab('general');
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-5 pb-3 border-b">
          <DialogTitle className="text-base font-semibold">
            {isEdit ? 'Chỉnh Sửa Sản Phẩm' : 'Tạo Sản Phẩm Mới'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Quản lý thông tin niêm yết, giá bán lẻ, giá vốn và cấu hình ma trận biến thể SKU.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col">
          <Tabs
            value={activeTab}
            onValueChange={v => setActiveTab(v as any)}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="px-5 pt-3 border-b bg-muted/20 flex items-center justify-between">
              <TabsList className="h-8">
                <TabsTrigger value="general" className="text-xs">
                  Thông tin chung
                </TabsTrigger>
                <TabsTrigger
                  value="variants"
                  className="text-xs"
                  disabled={!hasVariants && !isEdit}
                >
                  Ma trận biến thể ({variantFields.length})
                </TabsTrigger>
              </TabsList>

              {/* Has Variants Switch */}
              <div className="flex items-center gap-2">
                <Label htmlFor="has-variants" className="text-xs cursor-pointer">
                  Nhiều biến thể (Size/Màu)
                </Label>
                <Switch
                  id="has-variants"
                  checked={hasVariants}
                  onCheckedChange={checked => {
                    setValue('hasVariants', checked, { shouldValidate: true, shouldDirty: true });
                    if (checked && variantFields.length === 0) {
                      generateVariantMatrix();
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {/* TAB 1: GENERAL INFO */}
              <ProductGeneralTab
                register={register}
                setValue={setValue}
                errors={errors}
                currentName={currentName}
                onNameChange={handleNameChange}
                hasVariants={hasVariants}
                isEdit={isEdit}
              />

              {/* TAB 2: VARIANT MATRIX GENERATOR */}
              <ProductVariantsTab
                attributes={attributes}
                setAttributes={setAttributes}
                newTagInput={newTagInput}
                setNewTagInput={setNewTagInput}
                onAddAttributeGroup={addAttributeGroup}
                onRemoveAttributeGroup={removeAttributeGroup}
                onAddTagToAttribute={addTagToAttribute}
                onRemoveTagFromAttribute={removeTagFromAttribute}
                onGenerateVariantMatrix={generateVariantMatrix}
                variantFields={variantFields}
                onAddManualVariant={addManualVariant}
                onRemoveVariant={removeVariant}
                register={register}
                setValue={setValue}
              />
            </div>

            {errorMsg && (
              <div className="px-5 py-2 bg-destructive/10 text-destructive text-xs flex items-center gap-1.5 border-t">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <DialogFooter className="p-4 border-t bg-muted/20 flex items-center justify-between sm:justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Hủy
              </Button>
              <Button type="submit" size="sm" disabled={isSaving} className="text-xs gap-1.5">
                {isSaving ? <Spinner className="size-3.5" /> : <CheckCircle className="size-3.5" />}
                {isEdit ? 'Cập nhật' : 'Tạo sản phẩm'}
              </Button>
            </DialogFooter>
          </Tabs>
        </form>
      </DialogContent>
    </Dialog>
  );
}
