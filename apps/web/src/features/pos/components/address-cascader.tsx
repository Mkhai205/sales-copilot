'use client';

import * as React from 'react';
import {
  ADMINISTRATIVE_UNITS,
  normalizeVietnameseText,
  type AdministrativeProvince,
  type AdministrativeDistrict,
  type AdministrativeWard,
} from '@sales-copilot/shared-contracts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, FieldLabel } from '@/components/ui/field';

interface AddressCascaderProps {
  province?: string;
  district?: string;
  ward?: string;
  onChange: (values: { province?: string; district?: string; ward?: string }) => void;
  disabled?: boolean;
}

function matchUnit(name1?: string, name2?: string): boolean {
  if (!name1 || !name2) return false;
  if (name1 === name2) return true;
  const n1 = normalizeVietnameseText(name1);
  const n2 = normalizeVietnameseText(name2);
  if (n1 === n2) return true;
  const s1 = n1.replace(/^(thanh pho|tinh|quan|huyen|thi xa|phuong|xa|thi tran)\s+/, '');
  const s2 = n2.replace(/^(thanh pho|tinh|quan|huyen|thi xa|phuong|xa|thi tran)\s+/, '');
  return s1.length >= 2 && s1 === s2;
}

export function AddressCascader({
  province,
  district,
  ward,
  onChange,
  disabled = false,
}: AddressCascaderProps) {
  // 1. Resolve active Province object
  const currentProvince = React.useMemo<AdministrativeProvince | undefined>(() => {
    if (!province) return undefined;
    return ADMINISTRATIVE_UNITS.find(
      p => p.name === province || p.code === province || matchUnit(p.name, province),
    );
  }, [province]);

  // 2. Resolve available districts
  const districts = React.useMemo<AdministrativeDistrict[]>(() => {
    return currentProvince?.districts || [];
  }, [currentProvince]);

  // 3. Resolve active District object
  const currentDistrict = React.useMemo<AdministrativeDistrict | undefined>(() => {
    if (!district || !currentProvince) return undefined;
    return districts.find(d => d.name === district || matchUnit(d.name, district));
  }, [district, districts, currentProvince]);

  // 4. Resolve available wards
  const wards = React.useMemo<AdministrativeWard[]>(() => {
    return currentDistrict?.wards || [];
  }, [currentDistrict]);

  const currentWard = React.useMemo<AdministrativeWard | undefined>(() => {
    if (!ward || !currentDistrict) return undefined;
    return wards.find(w => w.name === ward || matchUnit(w.name, ward));
  }, [ward, wards, currentDistrict]);

  const handleProvinceChange = (newProvinceName: string) => {
    onChange({
      province: newProvinceName || undefined,
      district: undefined,
      ward: undefined,
    });
  };

  const handleDistrictChange = (newDistrictName: string) => {
    onChange({
      province,
      district: newDistrictName || undefined,
      ward: undefined,
    });
  };

  const handleWardChange = (newWardName: string) => {
    onChange({
      province,
      district,
      ward: newWardName || undefined,
    });
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* Tỉnh / Thành phố */}
      <Field>
        <FieldLabel className="text-xs text-muted-foreground">Tỉnh / Thành</FieldLabel>
        <Select
          value={currentProvince?.name || province || ''}
          onValueChange={handleProvinceChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-full h-8 text-xs">
            <SelectValue placeholder="Chọn Tỉnh/Thành" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-60">
            {ADMINISTRATIVE_UNITS.map(p => (
              <SelectItem key={p.id} value={p.name} className="text-xs">
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Quận / Huyện */}
      <Field>
        <FieldLabel className="text-xs text-muted-foreground">Quận / Huyện</FieldLabel>
        <Select
          value={currentDistrict?.name || district || ''}
          onValueChange={handleDistrictChange}
          disabled={disabled || !currentProvince || districts.length === 0}
        >
          <SelectTrigger className="w-full h-8 text-xs">
            <SelectValue placeholder={currentProvince ? 'Chọn Quận/Huyện' : 'Chọn Tỉnh trước'} />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-60">
            {districts.map(d => (
              <SelectItem key={d.id} value={d.name} className="text-xs">
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Phường / Xã */}
      <Field>
        <FieldLabel className="text-xs text-muted-foreground">Phường / Xã</FieldLabel>
        <Select
          value={currentWard?.name || ward || ''}
          onValueChange={handleWardChange}
          disabled={disabled || !currentDistrict || wards.length === 0}
        >
          <SelectTrigger className="w-full h-8 text-xs">
            <SelectValue placeholder={currentDistrict ? 'Chọn Phường/Xã' : 'Chọn Huyện trước'} />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-60">
            {wards.map(w => (
              <SelectItem key={w.id} value={w.name} className="text-xs">
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
