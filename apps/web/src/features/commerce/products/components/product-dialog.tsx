'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { normalizeSku, type ProductResponseDto } from '@sales-copilot/shared-contracts';
import { useProductMutations } from '../hooks/use-product-mutations';
import { AlertCircle, CheckCircle, Layers, Plus, Sparkles, Trash2, X } from 'lucide-react';

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  product?: ProductResponseDto | null;
  onSuccess?: () => void;
}

interface AttributeGroup {
  id: string;
  name: string; // e.g. "Kích cỡ"
  values: string[]; // e.g. ["S", "M", "L"]
}

const variantRowSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Tên biến thể bắt buộc'),
  sku: z.string().trim().min(1, 'SKU biến thể bắt buộc'),
  barcode: z.string().trim().optional(),
  price: z.coerce.number().min(0, 'Giá biến thể không được âm'),
  costPrice: z.coerce.number().min(0, 'Giá vốn không được âm'),
  stockQuantity: z.coerce.number().int().min(0, 'Tồn kho không được âm'),
  attributes: z.record(z.any()),
});

export type VariantFormRow = z.infer<typeof variantRowSchema>;

const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Tên sản phẩm là bắt buộc'),
  sku: z.string().trim().min(1, 'Mã SKU là bắt buộc'),
  category: z.string().trim().optional(),
  basePrice: z.coerce.number().min(0, 'Giá bán không được âm'),
  costPrice: z.coerce.number().min(0, 'Giá vốn không được âm'),
  barcode: z.string().trim().optional(),
  imageUrl: z.string().trim().optional(),
  description: z.string().trim().optional(),
  simpleStock: z.coerce.number().int().min(0, 'Tồn kho không được âm'),
  hasVariants: z.boolean(),
  variants: z.array(variantRowSchema),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

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

  const defaultValues = React.useMemo<ProductFormValues>(() => {
    if (product) {
      const existingVars = product.variants || [];
      const hasMultiVariants =
        existingVars.length > 1 ||
        (existingVars.length === 1 && existingVars[0].name !== 'Tiêu chuẩn');

      return {
        name: product.name || '',
        sku: product.sku || '',
        category: product.category || '',
        basePrice: Number(product.basePrice) || 0,
        costPrice: Number(product.costPrice) || 0,
        barcode: product.barcode || '',
        imageUrl: product.imageUrl || '',
        description: product.description || '',
        hasVariants: hasMultiVariants,
        simpleStock: hasMultiVariants ? 0 : existingVars[0]?.stockQuantity || 0,
        variants: hasMultiVariants
          ? existingVars.map(v => ({
              id: v.id,
              name: v.name,
              sku: v.sku,
              barcode: v.barcode || '',
              price: Number(v.price) || 0,
              costPrice: Number(v.costPrice) || 0,
              stockQuantity: v.stockQuantity || 0,
              attributes: (v.attributes as Record<string, string>) || {},
            }))
          : [],
      };
    }

    return {
      name: '',
      sku: '',
      category: '',
      basePrice: 100000,
      costPrice: 50000,
      barcode: '',
      imageUrl: '',
      description: '',
      hasVariants: false,
      simpleStock: 0,
      variants: [],
    };
  }, [product]);

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
              <TabsContent value="general" className="m-0 flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="prod-name" className="text-xs font-medium">
                      Tên sản phẩm <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="prod-name"
                      value={currentName}
                      onChange={e => handleNameChange(e.target.value)}
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
                    {errors.sku && (
                      <span className="text-[11px] text-destructive">{errors.sku.message}</span>
                    )}
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
                      <span className="text-[11px] text-destructive">
                        {errors.basePrice.message}
                      </span>
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
                      <span className="text-[11px] text-destructive">
                        {errors.costPrice.message}
                      </span>
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

              {/* TAB 2: VARIANT MATRIX GENERATOR */}
              <TabsContent value="variants" className="m-0 flex flex-col gap-4">
                {/* Attribute Matrix Config */}
                <div className="p-3.5 rounded-lg border bg-muted/30 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Layers className="size-3.5 text-primary" />
                      Khai báo nhóm thuộc tính (Tối đa 3 nhóm)
                    </span>
                    {attributes.length < 3 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={addAttributeGroup}
                        className="h-7 text-xs px-2"
                      >
                        <Plus className="size-3 mr-1" /> Thêm nhóm
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    {attributes.map(group => (
                      <div
                        key={group.id}
                        className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-start p-2.5 rounded-md border bg-background"
                      >
                        <div className="sm:col-span-1">
                          <Input
                            placeholder="VD: Kích cỡ"
                            value={group.name}
                            onChange={e =>
                              setAttributes(prev =>
                                prev.map(g =>
                                  g.id === group.id ? { ...g, name: e.target.value } : g,
                                ),
                              )
                            }
                            className="h-8 text-xs font-medium"
                          />
                        </div>

                        <div className="sm:col-span-3 flex flex-wrap items-center gap-1.5">
                          {group.values.map(tag => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs gap-1 py-0.5 px-2"
                            >
                              {tag}
                              <button
                                type="button"
                                onClick={() => removeTagFromAttribute(group.id, tag)}
                                className="hover:text-destructive"
                              >
                                <X className="size-3" />
                              </button>
                            </Badge>
                          ))}

                          <div className="flex items-center gap-1">
                            <Input
                              placeholder="Thêm giá trị (S, M...)"
                              value={newTagInput[group.id] || ''}
                              onChange={e =>
                                setNewTagInput(prev => ({
                                  ...prev,
                                  [group.id]: e.target.value,
                                }))
                              }
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addTagToAttribute(group.id);
                                }
                              }}
                              className="h-7 w-32 text-xs"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addTagToAttribute(group.id)}
                              className="h-7 px-2 text-xs"
                            >
                              Thêm
                            </Button>
                          </div>

                          {attributes.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeAttributeGroup(group.id)}
                              className="h-7 w-7 p-0 ml-auto text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateVariantMatrix}
                      className="h-8 text-xs gap-1.5"
                    >
                      <Sparkles className="size-3 text-primary" />
                      Tạo ma trận biến thể tự động
                    </Button>
                  </div>
                </div>

                {/* Generated Variants Table */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">
                      Danh sách biến thể SKU ({variantFields.length})
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addManualVariant}
                      className="h-7 text-xs"
                    >
                      <Plus className="size-3 mr-1" /> Thêm biến thể lẻ
                    </Button>
                  </div>

                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-muted/50 text-muted-foreground border-b text-[11px]">
                        <tr>
                          <th className="p-2">Tên biến thể</th>
                          <th className="p-2">Mã SKU</th>
                          <th className="p-2 w-24">Giá bán</th>
                          <th className="p-2 w-24">Giá vốn</th>
                          <th className="p-2 w-20">Tồn kho</th>
                          <th className="p-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {variantFields.map((field, idx) => (
                          <tr key={field.id} className="border-b last:border-b-0 hover:bg-muted/20">
                            <td className="p-2 font-medium">
                              <Input
                                {...register(`variants.${idx}.name` as const)}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                {...register(`variants.${idx}.sku` as const, {
                                  onChange: e =>
                                    setValue(
                                      `variants.${idx}.sku` as const,
                                      e.target.value.toUpperCase(),
                                      { shouldValidate: true },
                                    ),
                                })}
                                className="h-7 text-xs font-mono"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min={0}
                                {...register(`variants.${idx}.price` as const)}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min={0}
                                {...register(`variants.${idx}.costPrice` as const)}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min={0}
                                {...register(`variants.${idx}.stockQuantity` as const)}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeVariant(idx)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>
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
