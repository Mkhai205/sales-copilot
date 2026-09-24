'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  normalizeVietnamesePhone,
  VIETNAMESE_PHONE_REGEX,
  type ShippingAddressInputDto,
} from '@sales-copilot/shared-contracts';
import { toast } from 'sonner';
import { Sparkles, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { AddressCascader } from '@/features/commerce/shared/components/address-cascader';
import { parseAddressText } from '@/features/commerce/shared/lib/address-parser';

export const recipientInfoSchema = z.object({
  recipientName: z.string().optional().default(''),
  phoneNumber: z.string().optional().default(''),
  streetAddress: z.string().optional().default(''),
  ward: z.string().optional().default(''),
  district: z.string().optional().default(''),
  province: z.string().optional().default(''),
  shippingNotes: z.string().optional().default(''),
});

export type RecipientInfoFormInput = z.input<typeof recipientInfoSchema>;
export type RecipientInfoFormOutput = z.output<typeof recipientInfoSchema>;
export type RecipientInfoFormValues = RecipientInfoFormInput;

export interface RecipientInfoFormProps {
  value: Partial<ShippingAddressInputDto>;
  onChange: (updated: Partial<ShippingAddressInputDto>) => void;
  disabled?: boolean;
}

export function RecipientInfoForm({ value, onChange, disabled = false }: RecipientInfoFormProps) {
  const [rawAddressInput, setRawAddressInput] = React.useState('');

  const defaultValues = React.useMemo<RecipientInfoFormInput>(
    () => ({
      recipientName: value.recipientName || '',
      phoneNumber: value.phoneNumber || '',
      streetAddress: value.streetAddress || '',
      ward: value.ward || '',
      district: value.district || '',
      province: value.province || '',
      shippingNotes: value.shippingNotes || '',
    }),
    [
      value.recipientName,
      value.phoneNumber,
      value.streetAddress,
      value.ward,
      value.district,
      value.province,
      value.shippingNotes,
    ],
  );

  const { register, setValue, watch } = useForm<
    RecipientInfoFormInput,
    any,
    RecipientInfoFormOutput
  >({
    resolver: zodResolver(recipientInfoSchema),
    values: defaultValues,
    resetOptions: {
      keepDirtyValues: true,
    },
    mode: 'onChange',
  });

  const handleFieldChange = (field: keyof ShippingAddressInputDto, val: any) => {
    onChange({
      ...value,
      [field]: val,
    });
  };

  const handleParseAddress = async () => {
    if (!rawAddressInput.trim()) {
      toast.info('Vui lòng dán địa chỉ thô vào ô để phân tích');
      return;
    }

    // 1. Extract phone number if present in raw text
    const phoneMatch = rawAddressInput.match(VIETNAMESE_PHONE_REGEX);
    let extractedPhone = value.phoneNumber;
    let cleanAddressText = rawAddressInput;

    if (phoneMatch) {
      extractedPhone = normalizeVietnamesePhone(phoneMatch[0]);
      cleanAddressText = rawAddressInput.replace(phoneMatch[0], '');
      cleanAddressText = cleanAddressText.replace(/(?:sđt|sdt|tel|phone|đt|dt)[:\s-]*/gi, ' ');
    }

    const parsed = await parseAddressText(cleanAddressText);

    if (!parsed.province && !parsed.district && !parsed.ward && !phoneMatch) {
      toast.warning('Không tìm thấy thông tin Tỉnh/Huyện/Xã hoặc SĐT phù hợp trong chuỗi địa chỉ');
      return;
    }

    let street = parsed.streetAddress || value.streetAddress;
    if (street) {
      street = street
        .replace(/(?:sđt|sdt|tel|phone|đt|dt)[:\s-]*/gi, '')
        .replace(/^[,;\s-]+|[,;\s-]+$/g, '')
        .trim();
    }

    setValue('phoneNumber', extractedPhone || value.phoneNumber || '', {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue('province', parsed.province || value.province || '', {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue('district', parsed.district || value.district || '', {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue('ward', parsed.ward || value.ward || '', {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue('streetAddress', street || value.streetAddress || '', {
      shouldDirty: true,
      shouldValidate: true,
    });

    onChange({
      ...value,
      phoneNumber: extractedPhone || value.phoneNumber,
      province: parsed.province || value.province,
      district: parsed.district || value.district,
      ward: parsed.ward || value.ward,
      streetAddress: street || value.streetAddress,
    });

    toast.success('Đã phân tích địa chỉ thành công', {
      description: `${street || ''}, ${parsed.ward || ''}, ${parsed.district || ''}, ${parsed.province || ''}`,
    });
  };

  return (
    <FieldGroup className="flex flex-col gap-3">
      {/* Người nhận & Số điện thoại */}
      <div className="grid grid-cols-2 gap-2">
        <Field>
          <FieldLabel className="text-xs">{'Tên người nhận'}</FieldLabel>
          <Input
            placeholder={'Họ và tên...'}
            className="h-8 text-xs"
            {...register('recipientName', {
              onChange: e => handleFieldChange('recipientName', e.target.value),
            })}
            disabled={disabled}
          />
        </Field>

        <Field>
          <FieldLabel className="text-xs">{'Số điện thoại'}</FieldLabel>
          <Input
            placeholder={'0988xxxxxx...'}
            className="h-8 text-xs"
            {...register('phoneNumber', {
              onChange: e => handleFieldChange('phoneNumber', e.target.value),
            })}
            disabled={disabled}
          />
        </Field>
      </div>

      {/* 1-Click Fast Address Parser Tool */}
      <div className="flex flex-col gap-1.5 p-2 rounded-md bg-muted/40 border border-dashed border-border/80">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="size-3 text-primary" />
            {'Nhận diện địa chỉ nhanh từ tin nhắn chat'}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary font-normal cursor-pointer"
            onClick={handleParseAddress}
            disabled={disabled || !rawAddressInput.trim()}
          >
            <Sparkles className="size-3" />
            {'Phân tích địa chỉ'}
          </Button>
        </div>
        <Input
          placeholder={"Dán địa chỉ: ví dụ '15 ngõ 45 Cầu Giấy, Quan Hoa, Cầu Giấy, Hà Nội'..."}
          className="h-7 text-xs bg-background"
          value={rawAddressInput}
          onChange={e => setRawAddressInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleParseAddress();
            }
          }}
          disabled={disabled}
        />
      </div>

      {/* 3-Tier Administrative Cascader */}
      <AddressCascader
        province={watch('province') || undefined}
        district={watch('district') || undefined}
        ward={watch('ward') || undefined}
        onChange={({ province, district, ward }) => {
          setValue('province', province || '', { shouldDirty: true, shouldValidate: true });
          setValue('district', district || '', { shouldDirty: true, shouldValidate: true });
          setValue('ward', ward || '', { shouldDirty: true, shouldValidate: true });
          onChange({
            ...value,
            province,
            district,
            ward,
          });
        }}
        disabled={disabled}
      />

      {/* Địa chỉ chi tiết (Số nhà, ngõ, tên đường) */}
      <Field>
        <FieldLabel className="text-xs">{'Số nhà, ngõ, tên đường'}</FieldLabel>
        <Input
          placeholder={'Số 123 đường Giải Phóng...'}
          className="h-8 text-xs"
          {...register('streetAddress', {
            onChange: e => handleFieldChange('streetAddress', e.target.value),
          })}
          disabled={disabled}
        />
      </Field>

      {/* Ghi chú giao hàng */}
      <Field>
        <FieldLabel className="text-xs">{'Ghi chú giao hàng'}</FieldLabel>
        <Input
          placeholder={'Ví dụ: Giao giờ hành chính, gọi trước 15p...'}
          className="h-8 text-xs"
          {...register('shippingNotes', {
            onChange: e => handleFieldChange('shippingNotes', e.target.value),
          })}
          disabled={disabled}
        />
      </Field>
    </FieldGroup>
  );
}
