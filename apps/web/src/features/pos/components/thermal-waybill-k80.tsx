'use client';

import React, { useMemo } from 'react';
import type { ShippingLabelDataDto } from '@sales-copilot/shared-contracts';
import { generateCode128Svg } from '../lib/code128-svg';

interface ThermalWaybillK80Props {
  label: ShippingLabelDataDto;
}

export function ThermalWaybillK80({ label }: ThermalWaybillK80Props) {
  const barcodeSvg = useMemo(() => {
    return generateCode128Svg(label.trackingCode, {
      height: 48,
      barWidth: 1.4,
      showText: true,
      fontSize: 11,
    });
  }, [label.trackingCode]);

  // Format phone display with spacing
  const formattedPhone = useMemo(() => {
    const raw = label.recipient?.phone || '';
    const p = raw.replace(/\D/g, '');
    if (p.length === 10) {
      return `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}`;
    }
    return raw || 'Chưa cập nhật';
  }, [label.recipient?.phone]);

  return (
    <div
      className="bg-white text-black font-sans leading-tight text-[11px] p-2 select-none border border-neutral-300"
      style={{ width: '72mm', minHeight: '100mm', margin: '0 auto', boxSizing: 'border-box' }}
    >
      {/* 1. Header & Carrier */}
      <div className="flex justify-between items-center border-b-2 border-black pb-1 mb-1">
        <div>
          <div className="font-extrabold text-[13px] tracking-tight">{label.sender.name}</div>
          <div className="text-[10px] text-neutral-600">Hotline: {label.sender.phone}</div>
        </div>
        <div className="text-right">
          <span className="inline-block border-2 border-black px-1.5 py-0.5 font-black text-[12px] uppercase">
            {label.carrier}
          </span>
        </div>
      </div>

      {/* 2. Barcode Vector Engine */}
      <div className="my-2 text-center">
        <div dangerouslySetInnerHTML={{ __html: barcodeSvg }} className="flex justify-center" />
        <div className="text-[10px] font-mono mt-0.5 font-bold text-neutral-800">
          Đơn hàng: #{label.displayId} ({label.orderNumber})
        </div>
      </div>

      {/* 3. Sender & Recipient Grid */}
      <div className="border border-black mb-1.5 divide-y divide-black">
        {/* Recipient Box */}
        <div className="p-1.5 bg-neutral-50">
          <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
            Người nhận:
          </div>
          <div className="text-[13px] font-extrabold uppercase mt-0.5">{label.recipient.name}</div>
          <div className="text-[12px] font-black tracking-wide my-0.5">SĐT: {formattedPhone}</div>
          <div className="text-[11px] font-medium leading-snug">
            {label.recipient.address}
            {label.recipient.ward ? `, ${label.recipient.ward}` : ''}
            {label.recipient.district ? `, ${label.recipient.district}` : ''}
            {label.recipient.province ? `, ${label.recipient.province}` : ''}
          </div>
        </div>

        {/* Sender Address */}
        <div className="p-1 text-[9px] text-neutral-600">
          <span className="font-bold">Gửi từ: </span>
          {label.sender.address}, {label.sender.district}, {label.sender.province}
        </div>
      </div>

      {/* 4. COD Box (Prominent 18pt Double Border) */}
      <div className="my-1.5">
        {label.isPaid ? (
          <div className="border-2 border-black p-1 text-center bg-neutral-100">
            <div className="text-[11px] font-bold">✓ ĐÃ THANH TOÁN TRƯỚC</div>
            <div className="text-[15px] font-black">TIỀN THU COD: 0 ₫</div>
          </div>
        ) : (
          <div className="border-4 border-double border-black p-1 text-center bg-neutral-100">
            <div className="text-[10px] font-black uppercase tracking-wider">
              Tổng tiền thu hộ người nhận (COD)
            </div>
            <div className="text-[18px] font-black tracking-tight mt-0.5">
              {label.codAmount.toLocaleString('vi-VN')} ₫
            </div>
            <div className="text-[9px] font-semibold italic text-neutral-600">
              (Bưu tá thu đúng số tiền trên)
            </div>
          </div>
        )}
      </div>

      {/* 5. Products Summary List */}
      <div className="border border-black mb-1.5">
        <div className="flex justify-between bg-neutral-200 px-1 py-0.5 font-bold text-[9px] border-b border-black">
          <span>Nội dung hàng ({label.items.length} món)</span>
          <span>SL</span>
        </div>
        <div className="divide-y divide-neutral-200">
          {label.items.map((it, idx) => (
            <div key={idx} className="flex justify-between items-start px-1 py-0.5 text-[10px]">
              <span className="truncate pr-1">
                {it.productName}
                {it.variantName ? ` (${it.variantName})` : ''}
              </span>
              <span className="font-bold shrink-0">x{it.quantity}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-black px-1 py-0.5 flex justify-between text-[9px] font-semibold bg-neutral-50">
          <span>Khối lượng ước tính:</span>
          <span>{label.totalWeightInGrams} g</span>
        </div>
      </div>

      {/* 6. Notes & Instructions */}
      <div className="border border-neutral-300 p-1 mb-2 text-[9px]">
        <div className="font-bold">Chỉ dẫn giao hàng:</div>
        <div>{label.shippingNotes || 'Cho xem hàng, không cho thử hàng.'}</div>
      </div>

      {/* 7. Signatures */}
      <div className="grid grid-cols-2 text-center text-[9px] pt-1 border-t border-dashed border-black">
        <div>
          <div className="font-bold">Chữ ký người gửi</div>
          <div className="h-9"></div>
        </div>
        <div>
          <div className="font-bold">Chữ ký người nhận</div>
          <div className="h-9"></div>
        </div>
      </div>
    </div>
  );
}
