'use client';

import * as React from 'react';
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
import { AddressCascader } from './address-cascader';
import { parseAddressText } from '../lib/vietnam-address';
import { useI18n } from '@/lib/i18n';

interface RecipientInfoFormProps {
  value: Partial<ShippingAddressInputDto>;
  onChange: (updated: Partial<ShippingAddressInputDto>) => void;
  disabled?: boolean;
}

export function RecipientInfoForm({ value, onChange, disabled = false }: RecipientInfoFormProps) {
  const { t } = useI18n();
  const [rawAddressInput, setRawAddressInput] = React.useState('');

  const handleFieldChange = (field: keyof ShippingAddressInputDto, val: any) => {
    onChange({
      ...value,
      [field]: val,
    });
  };

  const handleParseAddress = async () => {
    if (!rawAddressInput.trim()) {
      toast.info(t('commerce.recipient.toastEmpty'));
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
      toast.warning(t('commerce.recipient.toastNotFound'));
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

    toast.success(t('commerce.recipient.toastSuccess'), {
      description: `${street || ''}, ${parsed.ward || ''}, ${parsed.district || ''}, ${parsed.province || ''}`,
    });
  };

  return (
    <FieldGroup className="flex flex-col gap-3">
      {/* Người nhận & Số điện thoại */}
      <div className="grid grid-cols-2 gap-2">
        <Field>
          <FieldLabel className="text-xs">{t('commerce.recipient.name')}</FieldLabel>
          <Input
            placeholder={t('commerce.recipient.namePlaceholder')}
            className="h-8 text-xs"
            value={value.recipientName || ''}
            onChange={e => handleFieldChange('recipientName', e.target.value)}
            disabled={disabled}
          />
        </Field>

        <Field>
          <FieldLabel className="text-xs">{t('commerce.recipient.phone')}</FieldLabel>
          <Input
            placeholder={t('commerce.recipient.phonePlaceholder')}
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
            {t('commerce.recipient.fastParser')}
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
            {t('commerce.recipient.parseAddress')}
          </Button>
        </div>
        <Input
          placeholder={t('commerce.recipient.parsePlaceholder')}
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
        <FieldLabel className="text-xs">{t('commerce.recipient.streetAddress')}</FieldLabel>
        <Input
          placeholder={t('commerce.recipient.streetPlaceholder')}
          className="h-8 text-xs"
          value={value.streetAddress || ''}
          onChange={e => handleFieldChange('streetAddress', e.target.value)}
          disabled={disabled}
        />
      </Field>

      {/* Ghi chú giao hàng */}
      <Field>
        <FieldLabel className="text-xs">{t('commerce.recipient.shippingNotes')}</FieldLabel>
        <Input
          placeholder={t('commerce.recipient.shippingNotesPlaceholder')}
          className="h-8 text-xs"
          value={value.shippingNotes || ''}
          onChange={e => handleFieldChange('shippingNotes', e.target.value)}
          disabled={disabled}
        />
      </Field>
    </FieldGroup>
  );
}
