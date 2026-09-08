import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DomainEvent,
  detectCarrierNetwork,
  normalizeVietnamesePhone,
  parseAddressHierarchy,
  type PosDraftSuggestedEventPayload,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';

export interface ExtractedOrderData {
  confidenceScore: number;
  suggestedCustomer?: {
    recipientName?: string;
    phoneNumber?: string;
    carrierNetwork?: string;
    streetAddress?: string;
    ward?: string;
    district?: string;
    province?: string;
  };
  suggestedItems?: Array<{
    productId?: string;
    variantId?: string;
    productName: string;
    variantName?: string;
    sku?: string;
    quantity: number;
    unitPrice?: number;
  }>;
  rawExtractedData?: Record<string, any>;
}

export const VIETNAMESE_PHONE_REGEX =
  /(?:\+84|0)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}\b/g;

@Injectable()
export class OrderExtractorService {
  private readonly logger = new Logger(OrderExtractorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly llmGatewayService?: LlmGatewayService,
  ) {}

  /**
   * Main extraction pipeline combining Tier 1 deterministic parsing
   * and Tier 2 contextual intelligence.
   */
  async extractOrderFromMessage(
    workspaceId: string,
    conversationId: string,
    content: string,
    messageId?: string,
    contactId?: string,
  ): Promise<ExtractedOrderData> {
    if (!content || !content.trim()) {
      return { confidenceScore: 0 };
    }

    const text = content.trim();
    let score = 0;

    // ------------------------------------------------------------------------
    // Tier 1: Deterministic Extraction (<15ms)
    // ------------------------------------------------------------------------
    // 1a. Phone Number Extraction & Telco Detection
    const phoneMatches = text.match(VIETNAMESE_PHONE_REGEX);
    let rawPhone: string | undefined;
    let phoneNumber: string | undefined;
    let carrierNetwork: string | undefined;

    if (phoneMatches && phoneMatches.length > 0) {
      rawPhone = phoneMatches[0];
      phoneNumber = normalizeVietnamesePhone(rawPhone);
      carrierNetwork = detectCarrierNetwork(phoneNumber);
      score += 35; // +35% for valid phone
    }

    // 1b. GSO 3-Level Administrative Unit Hierarchy Parsing
    const parsedAddress = parseAddressHierarchy(text);
    const hasDetailedAddress = Boolean(
      parsedAddress.province && (parsedAddress.district || parsedAddress.ward),
    );

    if (hasDetailedAddress) {
      score += 45; // +45% for resolved 3-tier address
    } else if (parsedAddress.province || parsedAddress.district) {
      score += 25; // Partial address
    }

    // 1c. Name Extraction (Regex heuristic)
    let recipientName: string | undefined;
    const nameMatch = text.match(
      /(?:tên\s+người\s+nhận|người\s+nhận|họ\s*(?:và\s*)?tên|tên|a\/c|anh|chị)\s*(?:là|:)?\s*([A-ZÀ-Ỹa-zà-ỹ\s]{2,30})(?=[,\n.-]|$)/i,
    );
    if (nameMatch && nameMatch[1]) {
      recipientName = nameMatch[1].trim();
    }

    // If contactId is provided and recipientName not found in text, look up contact
    if (!recipientName && contactId) {
      const contact = await this.prisma.client.contact.findFirst({
        where: { id: contactId, workspaceId },
        select: { name: true, phoneNumber: true },
      });
      if (contact?.name) {
        recipientName = contact.name;
      }
      if (!phoneNumber && contact?.phoneNumber) {
        phoneNumber = normalizeVietnamesePhone(contact.phoneNumber);
        carrierNetwork = detectCarrierNetwork(phoneNumber);
        score += 20;
      }
    }

    // ------------------------------------------------------------------------
    // Tier 2: Product Matching (Fallback or Catalog Keyword Search)
    // ------------------------------------------------------------------------
    const suggestedItems: Array<{
      productId?: string;
      variantId?: string;
      productName: string;
      variantName?: string;
      sku?: string;
      quantity: number;
      unitPrice?: number;
    }> = [];

    // Query active products of workspace
    const products = await this.prisma.client.product.findMany({
      where: { workspaceId, isActive: true },
      include: { variants: { where: { isActive: true } } },
    });

    const lowerText = text.toLowerCase();

    for (const prod of products) {
      const prodNameLower = prod.name.toLowerCase();
      const skuLower = prod.sku.toLowerCase();

      let matched = false;
      let matchedVariant: any = null;

      if (
        lowerText.includes(prodNameLower) ||
        (skuLower.length >= 3 && lowerText.includes(skuLower))
      ) {
        matched = true;
        matchedVariant = prod.variants[0] || null;
      } else {
        for (const variant of prod.variants) {
          const varNameLower = variant.name.toLowerCase();
          const varSkuLower = variant.sku.toLowerCase();
          if (
            (varNameLower.length >= 3 && lowerText.includes(varNameLower)) ||
            (varSkuLower.length >= 3 && lowerText.includes(varSkuLower))
          ) {
            matched = true;
            matchedVariant = variant;
            break;
          }
        }
      }

      if (matched) {
        // Extract quantity from vicinity or default to 1
        const qtyMatch = text.match(
          new RegExp(
            `(?:(\\d+)\\s*(?:cái|áo|chiếc|đôi|bộ|hộp)?\\s*${prod.name})|(?:${prod.name}\\s*(?:sl:?|x)?\\s*(\\d+))`,
            'i',
          ),
        );
        const qty = qtyMatch ? parseInt(qtyMatch[1] || qtyMatch[2] || '1', 10) : 1;

        suggestedItems.push({
          productId: prod.id,
          variantId: matchedVariant?.id,
          productName: prod.name,
          variantName: matchedVariant?.name || undefined,
          sku: matchedVariant?.sku || prod.sku || undefined,
          quantity: Math.max(1, qty),
          unitPrice: matchedVariant ? Number(matchedVariant.price) : Number(prod.basePrice),
        });
      }
    }

    if (suggestedItems.length > 0) {
      score += 20; // +20% for catalog product match
    }

    const confidenceScore = Math.min(100, score);

    const result: ExtractedOrderData = {
      confidenceScore,
      suggestedCustomer: {
        recipientName: recipientName || 'Khách hàng',
        phoneNumber,
        carrierNetwork,
        streetAddress: parsedAddress.streetAddress || undefined,
        ward: parsedAddress.ward,
        district: parsedAddress.district,
        province: parsedAddress.province,
      },
      suggestedItems,
      rawExtractedData: {
        originalContent: text,
        phoneMatch: rawPhone,
        addressMatch: parsedAddress,
      },
    };

    // If confidence is >= 80%, emit real-time event for 1-click POS suggestion
    if (confidenceScore >= 80) {
      const payload: PosDraftSuggestedEventPayload = {
        workspaceId,
        conversationId,
        contactId: contactId || null,
        suggestedCustomer: result.suggestedCustomer,
        suggestedItems: result.suggestedItems,
        rawExtractedData: result.rawExtractedData,
        confidenceScore,
        messageId,
      };

      this.eventEmitter.emit(DomainEvent.POS_DRAFT_SUGGESTED, payload);
      this.logger.log(
        `High confidence (${confidenceScore}%) POS draft suggested for conv ${conversationId}`,
      );
    }

    return result;
  }
}
