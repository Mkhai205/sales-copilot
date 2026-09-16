'use client';

import * as React from 'react';
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

interface VariantFormRow {
  id?: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  costPrice: number;
  stockQuantity: number;
  attributes: Record<string, string>;
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
  const [hasVariants, setHasVariants] = React.useState<boolean>(false);

  // General fields
  const [name, setName] = React.useState('');
  const [sku, setSku] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [basePrice, setBasePrice] = React.useState<number>(100000);
  const [costPrice, setCostPrice] = React.useState<number>(50000);
  const [barcode, setBarcode] = React.useState('');
  const [imageUrl, setImageUrl] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [simpleStock, setSimpleStock] = React.useState<number>(0);

  // Variant generator fields
  const [attributes, setAttributes] = React.useState<AttributeGroup[]>([
    { id: '1', name: 'Kích cỡ', values: ['S', 'M', 'L'] },
  ]);
  const [newTagInput, setNewTagInput] = React.useState<Record<string, string>>({});
  const [variantsList, setVariantsList] = React.useState<VariantFormRow[]>([]);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      if (product) {
        setName(product.name || '');
        setSku(product.sku || '');
        setCategory(product.category || '');
        setBasePrice(Number(product.basePrice) || 0);
        setCostPrice(Number(product.costPrice) || 0);
        setBarcode(product.barcode || '');
        setImageUrl(product.imageUrl || '');
        setDescription(product.description || '');

        const existingVars = product.variants || [];
        if (
          existingVars.length > 1 ||
          (existingVars.length === 1 && existingVars[0].name !== 'Tiêu chuẩn')
        ) {
          setHasVariants(true);
          setVariantsList(
            existingVars.map(v => ({
              id: v.id,
              name: v.name,
              sku: v.sku,
              barcode: v.barcode || '',
              price: Number(v.price) || 0,
              costPrice: Number(v.costPrice) || 0,
              stockQuantity: v.stockQuantity || 0,
              attributes: (v.attributes as Record<string, string>) || {},
            })),
          );
        } else {
          setHasVariants(false);
          setSimpleStock(existingVars[0]?.stockQuantity || 0);
          setVariantsList([]);
        }
      } else {
        // Reset for new product
        setName('');
        setSku('');
        setCategory('');
        setBasePrice(100000);
        setCostPrice(50000);
        setBarcode('');
        setImageUrl('');
        setDescription('');
        setSimpleStock(0);
        setHasVariants(false);
        setAttributes([
          { id: '1', name: 'Kích cỡ', values: ['S', 'M', 'L'] },
          { id: '2', name: 'Màu sắc', values: ['Đen', 'Trắng'] },
        ]);
        setVariantsList([]);
      }
      setActiveTab('general');
      setErrorMsg(null);
    }
  }, [open, product]);

  // Auto-generate suggested master SKU from name if empty
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEdit && !sku) {
      setSku(normalizeSku(val).slice(0, 15));
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

    const baseMasterSku = normalizeSku(sku || name || 'SP');
    const newVariants: VariantFormRow[] = combinations.map(combo => {
      const comboValues = Object.values(combo);
      const varName = comboValues.join(' / ');
      const skuSuffix = comboValues.map(v => normalizeSku(v)).join('-');
      const generatedSku = `${baseMasterSku}-${skuSuffix}`;

      return {
        name: varName,
        sku: generatedSku,
        price: Number(basePrice) || 0,
        costPrice: Number(costPrice) || 0,
        stockQuantity: 0,
        attributes: combo,
      };
    });

    setVariantsList(newVariants);
    setErrorMsg(null);
  };

  // Delete single variant from list
  const deleteVariantRow = (index: number) => {
    setVariantsList(prev => prev.filter((_, i) => i !== index));
  };

  // Add manual variant row
  const addManualVariant = () => {
    const index = variantsList.length + 1;
    const baseMasterSku = normalizeSku(sku || name || 'SP');
    setVariantsList(prev => [
      ...prev,
      {
        name: `Biến thể ${index}`,
        sku: `${baseMasterSku}-VAR-${index}`,
        price: Number(basePrice) || 0,
        costPrice: Number(costPrice) || 0,
        stockQuantity: 0,
        attributes: {},
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Tên sản phẩm là bắt buộc');
      return;
    }

    const normalizedMasterSku = normalizeSku(sku);
    if (!normalizedMasterSku) {
      setErrorMsg('Mã SKU là bắt buộc');
      return;
    }

    if (hasVariants && variantsList.length === 0) {
      setErrorMsg('Vui lòng tạo ít nhất một biến thể hoặc chọn sản phẩm đơn giản');
      return;
    }

    // Check variant SKU uniqueness
    if (hasVariants) {
      const skus = variantsList.map(v => normalizeSku(v.sku));
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
            name: name.trim(),
            sku: normalizedMasterSku,
            category: category.trim() || null,
            basePrice: Number(basePrice),
            costPrice: Number(costPrice),
            barcode: barcode.trim() || null,
            imageUrl: imageUrl.trim() || null,
            description: description.trim() || null,
            variants: hasVariants
              ? variantsList.map(v => ({
                  id: v.id,
                  name: v.name,
                  sku: normalizeSku(v.sku),
                  barcode: v.barcode || null,
                  price: Number(v.price),
                  costPrice: Number(v.costPrice),
                  stockQuantity: Number(v.stockQuantity) || 0,
                  attributes: v.attributes,
                }))
              : undefined,
          },
        });
      } else {
        await createProduct({
          name: name.trim(),
          sku: normalizedMasterSku,
          category: category.trim() || null,
          basePrice: Number(basePrice),
          costPrice: Number(costPrice),
          barcode: barcode.trim() || null,
          imageUrl: imageUrl.trim() || null,
          description: description.trim() || null,
          variants: hasVariants
            ? variantsList.map(v => ({
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
                  barcode: barcode.trim() || null,
                  price: Number(basePrice),
                  costPrice: Number(costPrice),
                  stockQuantity: Number(simpleStock) || 0,
                  attributes: {},
                  imageUrl: imageUrl.trim() || null,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-5 pb-3 border-b">
          <DialogTitle className="text-base font-semibold">
            {isEdit ? 'Chỉnh Sửa Sản Phẩm' : 'Tạo Sản Phẩm Mới'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Quản lý thông tin niêm yết, giá bán lẻ, giá vốn và cấu hình ma trận biến thể SKU.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
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
                  Ma trận biến thể ({variantsList.length})
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
                    setHasVariants(checked);
                    if (checked && variantsList.length === 0) {
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
                      value={name}
                      onChange={e => handleNameChange(e.target.value)}
                      placeholder="VD: Áo Polo Pique Cotton Slimfit"
                      className="h-9 text-xs"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="prod-sku" className="text-xs font-medium">
                      Mã SKU chính <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="prod-sku"
                      value={sku}
                      onChange={e => setSku(e.target.value.toUpperCase())}
                      placeholder="VD: POLO-PIQUE-01"
                      className="h-9 text-xs font-mono"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="prod-category" className="text-xs font-medium">
                      Danh mục (Category tag)
                    </Label>
                    <Input
                      id="prod-category"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
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
                      value={basePrice}
                      onChange={e => setBasePrice(parseFloat(e.target.value) || 0)}
                      className="h-9 text-xs"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="prod-cost-price" className="text-xs font-medium">
                      Giá vốn ước tính (VNĐ)
                    </Label>
                    <Input
                      id="prod-cost-price"
                      type="number"
                      min={0}
                      value={costPrice}
                      onChange={e => setCostPrice(parseFloat(e.target.value) || 0)}
                      className="h-9 text-xs"
                    />
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
                        value={simpleStock}
                        onChange={e => setSimpleStock(parseInt(e.target.value, 10) || 0)}
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
                      value={barcode}
                      onChange={e => setBarcode(e.target.value)}
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
                      value={imageUrl}
                      onChange={e => setImageUrl(e.target.value)}
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
                      value={description}
                      onChange={e => setDescription(e.target.value)}
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
                      Danh sách biến thể SKU ({variantsList.length})
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
                        {variantsList.map((row, idx) => (
                          <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                            <td className="p-2 font-medium">
                              <Input
                                value={row.name}
                                onChange={e => {
                                  const val = e.target.value;
                                  setVariantsList(prev =>
                                    prev.map((v, i) => (i === idx ? { ...v, name: val } : v)),
                                  );
                                }}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={row.sku}
                                onChange={e => {
                                  const val = e.target.value.toUpperCase();
                                  setVariantsList(prev =>
                                    prev.map((v, i) => (i === idx ? { ...v, sku: val } : v)),
                                  );
                                }}
                                className="h-7 text-xs font-mono"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min={0}
                                value={row.price}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setVariantsList(prev =>
                                    prev.map((v, i) => (i === idx ? { ...v, price: val } : v)),
                                  );
                                }}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min={0}
                                value={row.costPrice}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setVariantsList(prev =>
                                    prev.map((v, i) => (i === idx ? { ...v, costPrice: val } : v)),
                                  );
                                }}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min={0}
                                value={row.stockQuantity}
                                disabled={isEdit}
                                onChange={e => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  setVariantsList(prev =>
                                    prev.map((v, i) =>
                                      i === idx ? { ...v, stockQuantity: val } : v,
                                    ),
                                  );
                                }}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <button
                                type="button"
                                onClick={() => deleteVariantRow(idx)}
                                className="text-muted-foreground hover:text-destructive transition-colors p-1"
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
          </Tabs>

          {errorMsg && (
            <div className="mx-5 mb-3 flex items-center gap-2 p-2.5 rounded-md bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <DialogFooter className="p-4 border-t bg-muted/10 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Hủy
            </Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Spinner className="mr-1.5 size-3.5" /> Đang lưu...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-1.5 size-3.5" />{' '}
                  {isEdit ? 'Cập nhật sản phẩm' : 'Lưu sản phẩm'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
