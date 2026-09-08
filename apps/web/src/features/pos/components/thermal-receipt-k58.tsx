'use client';

import React, { useMemo } from 'react';
import type { ShippingLabelDataDto } from '@sales-copilot/shared-contracts';
import { generateCode128Svg } from '../lib/code128-svg';

interface ThermalReceiptK58Props {
  label: ShippingLabelDataDto;
}

export function ThermalReceiptK58({ label }: ThermalReceiptK58Props) {
  const barcodeSvg = useMemo(() => {
    return generateCode128Svg(label.trackingCode, {
      height: 36,
      barWidth: 1.1,
      showText: true,
      fontSize: 9,
    });
  }, [label.trackingCode]);

  const subtotal = useMemo(() => {
    return label.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  }, [label.items]);

  return (
    <div
      className="bg-white text-black font-mono leading-tight text-[10px] p-1.5 select-none border border-neutral-300"
      style={{ width: '48mm', minHeight: '80mm', margin: '0 auto', boxSizing: 'border-box' }}
    >
      {/* 1. Header */}
      <div className="text-center border-b border-dashed border-black pb-1 mb-1">
        <div className="font-extrabold text-[12px] uppercase">{label.sender.name}</div>
        <div className="text-[8px] text-neutral-600">Đ/c: {label.sender.address}</div>
        <div className="text-[9px] font-bold">Hotline: {label.sender.phone}</div>
        <div className="text-[11px] font-extrabold uppercase mt-1">HÓA ĐƠN BÁN HÀNG</div>
        <div className="text-[9px]">
          #{label.displayId} ({label.orderNumber})
        </div>
        <div className="text-[8px] text-neutral-500">
          {new Date(label.createdAt).toLocaleString('vi-VN')}
        </div>
      </div>

      {/* 2. Customer Info */}
      <div className="border-b border-dashed border-black pb-1 mb-1 text-[9px]">
        <div>
          <span className="font-bold">Khách: </span>
          {label.recipient.name}
        </div>
        <div>
          <span className="font-bold">SĐT: </span>
          {label.recipient.phone}
        </div>
        <div className="text-[8px] truncate">
          {label.recipient.address}, {label.recipient.province}
        </div>
      </div>

      {/* 3. Items List */}
      <div className="border-b border-dashed border-black pb-1 mb-1">
        <div className="flex justify-between font-bold border-b border-neutral-300 pb-0.5 text-[8px]">
          <span>Mặt hàng</span>
          <span>T.Tiền</span>
        </div>
        <div className="divide-y divide-neutral-100 mt-0.5">
          {label.items.map((it, idx) => (
            <div key={idx} className="py-0.5">
              <div className="truncate font-semibold text-[9px]">{it.productName}</div>
              <div className="flex justify-between text-[8px] text-neutral-600">
                <span>
                  {it.quantity} x {it.price.toLocaleString('vi-VN')}₫
                </span>
                <span className="font-bold text-black">
                  {(it.quantity * it.price).toLocaleString('vi-VN')}₫
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Financial Summary */}
      <div className="border-b border-dashed border-black pb-1 mb-1 text-[9px] space-y-0.5">
        <div className="flex justify-between">
          <span>Tạm tính:</span>
          <span>{subtotal.toLocaleString('vi-VN')} ₫</span>
        </div>
        <div className="flex justify-between font-black text-[11px] pt-0.5 border-t border-neutral-200">
          <span>TỔNG CỘNG:</span>
          <span>
            {label.codAmount > 0
              ? label.codAmount.toLocaleString('vi-VN')
              : subtotal.toLocaleString('vi-VN')}{' '}
            ₫
          </span>
        </div>
        <div className="flex justify-between text-[8px] italic">
          <span>Trạng thái:</span>
          <span className="font-bold">
            {label.isPaid ? 'ĐÃ THANH TOÁN' : 'THU TIỀN KHI GIAO (COD)'}
          </span>
        </div>
      </div>

      {/* 5. Barcode & Thank you */}
      <div className="text-center pt-1">
        <div
          dangerouslySetInnerHTML={{ __html: barcodeSvg }}
          className="flex justify-center my-1"
        />
        <div className="text-[8px] italic text-neutral-600">Cảm ơn quý khách & Hẹn gặp lại!</div>
      </div>
    </div>
  );
}
