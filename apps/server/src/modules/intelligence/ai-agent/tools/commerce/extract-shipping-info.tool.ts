import { tool, generateObject, type LanguageModel, type Tool } from 'ai';
import { z } from 'zod';
import {
  VIETNAMESE_PHONE_EXTRACT_REGEX,
  normalizeVietnamesePhone,
  isValidVietnamesePhone,
} from '@sales-copilot/shared-contracts';
import {
  ensureDivisionsLoaded,
  parseAddressHierarchyWithDivisions,
} from '../../utils/address-parser.util';

export interface ExtractShippingInfoToolOptions {
  model?: LanguageModel;
}

export const extractShippingInfoInputSchema = z.object({
  text: z
    .string()
    .describe(
      'Đoạn văn bản chứa thông tin giao hàng của khách (ví dụ: "15 ngõ 45 Vọng, Đồng Tâm, HBT, HN. SĐT 0988123456")',
    ),
});

export type ExtractShippingInfoInput = z.infer<typeof extractShippingInfoInputSchema>;

export function createExtractShippingInfoTool(options?: ExtractShippingInfoToolOptions): Tool {
  return tool({
    description:
      'Bóc tách tên người nhận, số điện thoại, và địa chỉ giao hàng (tỉnh/thành phố, quận/huyện, phường/xã, số nhà/tên đường) từ đoạn tin nhắn tự do của khách hàng.',
    inputSchema: extractShippingInfoInputSchema,
    execute: async ({ text }: ExtractShippingInfoInput) => {
      try {
        const rawText = text?.trim() || '';
        if (!rawText) {
          return {
            confidence: 0,
          };
        }

        // --- Tier 1 (Fast Path < 5ms) ---
        // 1. Phone Extraction
        let phoneNumber: string | undefined;
        const phoneMatches = rawText.match(VIETNAMESE_PHONE_EXTRACT_REGEX);
        if (phoneMatches && phoneMatches.length > 0) {
          const rawPhone = phoneMatches[0];
          const normalized = normalizeVietnamesePhone(rawPhone);
          if (isValidVietnamesePhone(normalized)) {
            phoneNumber = normalized;
          }
        }

        // 2. Recipient Name Extraction (Heuristics)
        let recipientName: string | undefined;
        const namePattern =
          /(?:người nhận|tên|khách|anh|chị|cô|bác)[:\s]+([A-ZÀ-Ỹa-zà-ỹ\s]+?)(?:[,.\n\r]|sđt|đt|ở|địa chỉ|\d{9,11}|$)/i;
        const nameMatch = rawText.match(namePattern);
        if (nameMatch && nameMatch[1]) {
          const candidate = nameMatch[1].trim();
          if (candidate.length >= 2 && candidate.length <= 40 && !/^\d+$/.test(candidate)) {
            recipientName = candidate;
          }
        }

        // 3. Remove Phone to prevent noise in address hierarchy matching
        let cleanAddressText = rawText;
        if (phoneNumber) {
          cleanAddressText = cleanAddressText.replace(new RegExp(phoneNumber, 'g'), '');
        }
        if (recipientName) {
          cleanAddressText = cleanAddressText.replace(new RegExp(recipientName, 'g'), '');
        }
        cleanAddressText = cleanAddressText
          .replace(/(?:sđt|sdt|đt|tel|phone|người nhận|tên)[:\s]*/gi, ' ')
          .replace(/[,.-]\s*$/, '')
          .trim();

        // 4. Address Hierarchy Matching (Provinces -> Districts -> Communes)
        const { provinces, districts, communes } = await ensureDivisionsLoaded();
        const parsed = parseAddressHierarchyWithDivisions(
          cleanAddressText,
          provinces,
          districts,
          communes,
        );

        let province = parsed.province;
        let district = parsed.district;
        let ward = parsed.ward;
        let streetAddress = parsed.streetAddress;

        // Calculate Tier 1 confidence score
        let confidence = 0;
        if (phoneNumber) confidence += 40;
        if (province) confidence += 25;
        if (district) confidence += 20;
        if (ward) confidence += 10;
        if (streetAddress) confidence += 5;

        // --- Tier 2 (Fallback if confidence < 70% and LLM model provided) ---
        if (confidence < 70 && options?.model) {
          try {
            const { object } = await generateObject({
              model: options.model,
              schema: z.object({
                recipientName: z.string().nullable().optional(),
                phoneNumber: z.string().nullable().optional(),
                province: z.string().nullable().optional(),
                district: z.string().nullable().optional(),
                ward: z.string().nullable().optional(),
                streetAddress: z.string().nullable().optional(),
              }),
              prompt: `Trích xuất thông tin giao hàng tại Việt Nam từ đoạn tin nhắn sau:\n"${rawText}"\nTrả về đúng các trường: recipientName, phoneNumber, province, district, ward, streetAddress. Nếu trường nào không có, để null.`,
            });

            if (object) {
              if (!recipientName && object.recipientName) recipientName = object.recipientName;
              if (!phoneNumber && object.phoneNumber) {
                const norm = normalizeVietnamesePhone(object.phoneNumber);
                if (isValidVietnamesePhone(norm)) phoneNumber = norm;
              }
              if (!province && object.province) province = object.province;
              if (!district && object.district) district = object.district;
              if (!ward && object.ward) ward = object.ward;
              if (!streetAddress && object.streetAddress) streetAddress = object.streetAddress;

              // Recalculate confidence
              confidence = 0;
              if (phoneNumber) confidence += 40;
              if (province) confidence += 25;
              if (district) confidence += 20;
              if (ward) confidence += 10;
              if (streetAddress) confidence += 5;
            }
          } catch {
            // Graceful fallback to Tier 1 results if LLM invocation fails
          }
        }

        return {
          recipientName,
          phoneNumber,
          province,
          district,
          ward,
          streetAddress,
          confidence: Math.min(100, confidence),
        };
      } catch (error: any) {
        return {
          error: 'EXTRACT_SHIPPING_INFO_FAILED',
          message: error?.message || 'Không thể bóc tách thông tin giao hàng',
          confidence: 0,
        };
      }
    },
  });
}
