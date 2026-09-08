'use client';

import * as React from 'react';
import {
  parseAddressHierarchy,
  normalizeVietnamesePhone,
  type ShippingAddressInputDto,
} from '@sales-copilot/shared-contracts';
import { toast } from 'sonner';
import { Sparkles, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { CarrierBadge } from './carrier-badge';
import { AddressCascader } from './address-cascader';

interface RecipientInfoFormProps {
  value: Partial<ShippingAddressInputDto>;
  onChange: (updated: Partial<ShippingAddressInputDto>) => void;
  disabled?: boolean;
}

export function RecipientInfoForm({ value, onChange, disabled = false }: RecipientInfoFormProps) {
  const [rawAddressInput, setRawAddressInput] = React.useState('');

  const handleFieldChange = (field: keyof ShippingAddressInputDto, val: any) => {
    onChange({
      ...value,
      [field]: val,
    });
  };

  const handleParseAddress = () => {
    if (!rawAddressInput.trim()) {
      toast.info('Vui lòng dán địa chỉ thô vào ô để phân tích');
      return;
    }

    // 1. Extract phone number if present in raw text
    const phoneRegex = /(?:\+84|0)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}\b/;
    const phoneMatch = rawAddressInput.match(phoneRegex);
    let extractedPhone = value.phoneNumber;
    let cleanAddressText = rawAddressInput;

    if (phoneMatch) {
      extractedPhone = normalizeVietnamesePhone(phoneMatch[0]);
      cleanAddressText = rawAddressInput.replace(phoneMatch[0], '');
      cleanAddressText = cleanAddressText.replace(/(?:sđt|sdt|tel|phone|đt|dt)[:\s-]*/gi, ' ');
    }

    const parsed = parseAddressHierarchy(cleanAddressText);

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
          <FieldLabel className="text-xs">Tên người nhận</FieldLabel>
          <Input
            placeholder="Họ và tên..."
            className="h-8 text-xs"
            value={value.recipientName || ''}
            onChange={e => handleFieldChange('recipientName', e.target.value)}
            disabled={disabled}
          />
        </Field>

        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel className="text-xs">Số điện thoại</FieldLabel>
            <CarrierBadge phone={value.phoneNumber} />
          </div>
          <Input
            placeholder="0988xxxxxx..."
            className="h-8 text-xs"
            value={value.phoneNumber || ''}
            onChange={e => handleFieldChange('phoneNumber', e.target.value)}
            disabled={disabled}
          />
        </Field>
      </div>

      {/* 1-Click Fast Address Parser Tool */}
      <div className="flex flex-col gap-1.5 p-2 rounded-md bg-muted/40 border border-dashed border-border/80">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="size-3 text-primary" />
            Nhận diện địa chỉ nhanh từ tin nhắn chat
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary font-normal"
            onClick={handleParseAddress}
            disabled={disabled || !rawAddressInput.trim()}
          >
            <Sparkles className="size-3" />
            Phân tích địa chỉ
          </Button>
        </div>
        <Input
          placeholder="Dán địa chỉ: ví dụ '15 ngõ 45 Cầu Giấy, Quan Hoa, Cầu Giấy, Hà Nội'..."
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
        province={value.province}
        district={value.district}
        ward={value.ward}
        onChange={({ province, district, ward }) => {
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
        <FieldLabel className="text-xs">Số nhà, ngõ, tên đường</FieldLabel>
        <Input
          placeholder="Số 123 đường Giải Phóng..."
          className="h-8 text-xs"
          value={value.streetAddress || ''}
          onChange={e => handleFieldChange('streetAddress', e.target.value)}
          disabled={disabled}
        />
      </Field>

      {/* Ghi chú giao hàng */}
      <Field>
        <FieldLabel className="text-xs">Ghi chú giao hàng</FieldLabel>
        <Input
          placeholder="Ví dụ: Giao giờ hành chính, gọi trước 15p..."
          className="h-8 text-xs"
          value={value.shippingNotes || ''}
          onChange={e => handleFieldChange('shippingNotes', e.target.value)}
          disabled={disabled}
        />
      </Field>
    </FieldGroup>
  );
}
