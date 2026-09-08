import { z } from 'zod';
import { CarrierNetwork, CarrierProvider } from './pos-enums';

export const VIETNAMESE_PHONE_REGEX = /^(0|\+84)[35789][0-9]{8}$/;

export const shippingAddressInputSchema = z.object({
  recipientName: z.string().trim().min(2, 'Tên người nhận tối thiểu 2 ký tự'),
  phoneNumber: z.string().trim().regex(VIETNAMESE_PHONE_REGEX, 'Số điện thoại không hợp lệ'),
  carrierNetwork: z.nativeEnum(CarrierNetwork).default(CarrierNetwork.OTHER),
  streetAddress: z.string().trim().min(3, 'Địa chỉ đường/số nhà bắt buộc'),
  ward: z.string().trim().min(1, 'Phường/Xã bắt buộc'),
  district: z.string().trim().min(1, 'Quận/Huyện bắt buộc'),
  province: z.string().trim().min(1, 'Tỉnh/Thành phố bắt buộc'),
  country: z.string().default('VN'),
  postalCode: z.string().trim().optional().nullable(),
  shippingCarrier: z.nativeEnum(CarrierProvider).default(CarrierProvider.CUSTOM),
  trackingCode: z.string().trim().optional().nullable(),
  shippingNotes: z.string().optional().nullable(),
  carrierMetadata: z.record(z.any()).optional().default({}),
});

export type ShippingAddressInputDto = z.input<typeof shippingAddressInputSchema>;

export interface ShippingAddressResponseDto {
  id: string;
  workspaceId: string;
  orderId: string;
  contactId: string | null;
  recipientName: string;
  phoneNumber: string;
  carrierNetwork: CarrierNetwork;
  streetAddress: string;
  ward: string;
  district: string;
  province: string;
  country: string;
  postalCode: string | null;
  shippingCarrier: CarrierProvider;
  trackingCode: string | null;
  shippingNotes: string | null;
  carrierMetadata: Record<string, any>;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export const carrierRateQuoteSchema = z.object({
  carrier: z.nativeEnum(CarrierProvider),
  senderDistrict: z.string().min(1),
  senderProvince: z.string().min(1),
  recipientDistrict: z.string().min(1),
  recipientProvince: z.string().min(1),
  weightInGrams: z.coerce.number().positive(),
  insuredValue: z.coerce.number().min(0).default(0),
});

export type CarrierRateQuoteDto = z.input<typeof carrierRateQuoteSchema>;

export const createShipmentSchema = z.object({
  carrier: z.nativeEnum(CarrierProvider),
  orderId: z.string().uuid(),
  requiredNote: z
    .enum(['CHOTHUHANG', 'CHOXEMHANGKHONGTHU', 'KHONGCHOXEMHANG'])
    .default('CHOXEMHANGKHONGTHU'),
  pickupAddressId: z.string().optional(),
});

export type CreateShipmentDto = z.input<typeof createShipmentSchema>;
