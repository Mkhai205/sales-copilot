import * as prismaEnums from '../infrastructure/database/generated/enums';
import {
  BillingPlanType,
  ChannelType,
  ConversationPriority,
  ConversationStatus,
  DeliveryStatus,
  DiscountType,
  FileType,
  FulfillmentStatus,
  InventoryTransactionType,
  KnowledgeEmbeddingStatus,
  MessageType,
  MessageContentType,
  OrderStatus,
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionStatus,
  PlatformRole,
  SenderType,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';

/**
 * Guards against drift between the hand-maintained shared-contracts enums and
 * the enums generated from prisma/schema.prisma. Both are sources of truth for
 * the same vocabulary (server Prisma writes, web widget, SDK) — adding or
 * renaming a member in one place without the other must fail CI here.
 */
const PARITY_TABLE: Array<[string, Record<string, string>, Record<string, string>]> = [
  ['PlatformRole', prismaEnums.PlatformRole, PlatformRole],
  ['WorkspaceRole', prismaEnums.WorkspaceRole, WorkspaceRole],
  ['BillingPlanType', prismaEnums.BillingPlanType, BillingPlanType],
  ['ChannelType', prismaEnums.ChannelType, ChannelType],
  ['ConversationStatus', prismaEnums.ConversationStatus, ConversationStatus],
  ['ConversationPriority', prismaEnums.ConversationPriority, ConversationPriority],
  ['MessageType', prismaEnums.MessageType, MessageType],
  ['MessageContentType', prismaEnums.MessageContentType, MessageContentType],
  ['DeliveryStatus', prismaEnums.DeliveryStatus, DeliveryStatus],
  ['SenderType', prismaEnums.SenderType, SenderType],
  ['FileType', prismaEnums.FileType, FileType],
  ['OrderStatus', prismaEnums.OrderStatus, OrderStatus],
  ['PaymentStatus', prismaEnums.PaymentStatus, PaymentStatus],
  ['FulfillmentStatus', prismaEnums.FulfillmentStatus, FulfillmentStatus],
  ['DiscountType', prismaEnums.DiscountType, DiscountType],
  ['PaymentMethod', prismaEnums.PaymentMethod, PaymentMethod],
  ['PaymentGateway', prismaEnums.PaymentGateway, PaymentGateway],
  ['PaymentTransactionStatus', prismaEnums.PaymentTransactionStatus, PaymentTransactionStatus],
  ['InventoryTransactionType', prismaEnums.InventoryTransactionType, InventoryTransactionType],
  ['KnowledgeEmbeddingStatus', prismaEnums.KnowledgeEmbeddingStatus, KnowledgeEmbeddingStatus],
];

describe('shared-contracts ↔ Prisma enum parity', () => {
  it.each(PARITY_TABLE)(
    '%s has identical members in shared-contracts and Prisma',
    (_name, prismaEnum, sharedEnum) => {
      const prismaMembers = Object.keys(prismaEnum).sort();
      const sharedMembers = Object.keys(sharedEnum).sort();
      expect(prismaMembers).toEqual(sharedMembers);

      for (const member of prismaMembers) {
        expect(prismaEnum[member]).toBe(sharedEnum[member]);
      }
    },
  );
});
