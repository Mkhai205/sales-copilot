'use client';

import * as React from 'react';
import { Layers, Plus, Sparkles, Trash2, X } from 'lucide-react';
import type { UseFieldArrayReturn, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AttributeGroup, ProductFormValues } from './product-dialog-schema';

interface ProductVariantsTabProps {
  attributes: AttributeGroup[];
  setAttributes: React.Dispatch<React.SetStateAction<AttributeGroup[]>>;
  newTagInput: Record<string, string>;
  setNewTagInput: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onAddAttributeGroup: () => void;
  onRemoveAttributeGroup: (id: string) => void;
  onAddTagToAttribute: (groupId: string) => void;
  onRemoveTagFromAttribute: (groupId: string, tag: string) => void;
  onGenerateVariantMatrix: () => void;
  variantFields: UseFieldArrayReturn<ProductFormValues, 'variants', 'id'>['fields'];
  onAddManualVariant: () => void;
  onRemoveVariant: (index: number) => void;
  register: UseFormRegister<ProductFormValues>;
  setValue: UseFormSetValue<ProductFormValues>;
}

export function ProductVariantsTab({
  attributes,
  setAttributes,
  newTagInput,
  setNewTagInput,
  onAddAttributeGroup,
  onRemoveAttributeGroup,
  onAddTagToAttribute,
  onRemoveTagFromAttribute,
  onGenerateVariantMatrix,
  variantFields,
  onAddManualVariant,
  onRemoveVariant,
  register,
  setValue,
}: ProductVariantsTabProps) {
  return (
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
              onClick={onAddAttributeGroup}
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
                      prev.map(g => (g.id === group.id ? { ...g, name: e.target.value } : g)),
                    )
                  }
                  className="h-8 text-xs font-medium"
                />
              </div>

              <div className="sm:col-span-3 flex flex-wrap items-center gap-1.5">
                {group.values.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs gap-1 py-0.5 px-2">
                    {tag}
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto w-auto hover:text-destructive"
                      onClick={() => onRemoveTagFromAttribute(group.id, tag)}
                    >
                      <X className="size-3" />
                    </Button>
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
                        onAddTagToAttribute(group.id);
                      }
                    }}
                    className="h-7 w-32 text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onAddTagToAttribute(group.id)}
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
                    onClick={() => onRemoveAttributeGroup(group.id)}
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
            onClick={onGenerateVariantMatrix}
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
            onClick={onAddManualVariant}
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
                    <Input {...register(`variants.${idx}.name` as const)} className="h-7 text-xs" />
                  </td>
                  <td className="p-2">
                    <Input
                      {...register(`variants.${idx}.sku` as const, {
                        onChange: e =>
                          setValue(`variants.${idx}.sku` as const, e.target.value.toUpperCase(), {
                            shouldValidate: true,
                          }),
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
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto w-auto text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveVariant(idx)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </TabsContent>
  );
}
