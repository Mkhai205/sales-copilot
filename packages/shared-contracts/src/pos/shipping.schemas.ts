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

export const dispatchOrderSchema = z.object({
  carrier: z.nativeEnum(CarrierProvider).default(CarrierProvider.CUSTOM),
  note: z.string().optional().nullable(),
  pickShift: z.string().optional().nullable(),
  codAmount: z.coerce.number().min(0).optional(),
});

export type DispatchOrderDto = z.input<typeof dispatchOrderSchema>;
export type DispatchOrderOutputDto = z.output<typeof dispatchOrderSchema>;

export const carrierQuoteResultSchema = z.object({
  carrier: z.nativeEnum(CarrierProvider),
  serviceName: z.string(),
  fee: z.number().min(0),
  estimatedDeliveryDays: z.number().min(0).optional(),
  insuranceFee: z.number().min(0).default(0),
  estimatedDeliveryDate: z.string().optional(),
});

export type CarrierQuoteResultDto = z.infer<typeof carrierQuoteResultSchema>;

export const shippingLabelItemSchema = z.object({
  productName: z.string(),
  variantName: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  quantity: z.number(),
  price: z.number(),
});

export type ShippingLabelItemDto = z.infer<typeof shippingLabelItemSchema>;

export const shippingLabelDataSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  displayId: z.number(),
  trackingCode: z.string(),
  carrier: z.nativeEnum(CarrierProvider),
  barcodeSvg: z.string().optional(),
  sender: z.object({
    name: z.string(),
    phone: z.string(),
    address: z.string(),
    province: z.string().optional(),
    district: z.string().optional(),
    ward: z.string().optional(),
  }),
  recipient: z.object({
    name: z.string(),
    phone: z.string(),
    address: z.string(),
    province: z.string().optional().nullable(),
    district: z.string().optional().nullable(),
    ward: z.string().optional().nullable(),
  }),
  codAmount: z.number(),
  isPaid: z.boolean(),
  items: z.array(shippingLabelItemSchema),
  totalWeightInGrams: z.number().default(500),
  shippingNotes: z.string().optional().nullable(),
  createdAt: z.union([z.date(), z.string()]),
});

export type ShippingLabelDataDto = z.infer<typeof shippingLabelDataSchema>;

export const shipmentResultSchema = z.object({
  trackingCode: z.string(),
  carrier: z.nativeEnum(CarrierProvider),
  fee: z.number().default(0),
  estimatedDeliveryDate: z.string().optional(),
  rawResponse: z.record(z.any()).optional(),
  labelUrl: z.string().optional(),
});

export type ShipmentResultDto = z.infer<typeof shipmentResultSchema>;

export const trackingTimelineItemSchema = z.object({
  timestamp: z.string(),
  status: z.string(),
  description: z.string(),
  location: z.string().optional(),
});

export type TrackingTimelineItemDto = z.infer<typeof trackingTimelineItemSchema>;

export const trackingStatusSchema = z.object({
  trackingCode: z.string(),
  carrier: z.nativeEnum(CarrierProvider),
  status: z.string(),
  statusDescription: z.string().optional(),
  timeline: z.array(trackingTimelineItemSchema).default([]),
});

export type TrackingStatusDto = z.infer<typeof trackingStatusSchema>;
