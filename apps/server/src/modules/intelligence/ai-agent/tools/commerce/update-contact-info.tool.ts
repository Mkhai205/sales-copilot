import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { normalizeVietnamesePhone, isValidVietnamesePhone } from '@sales-copilot/shared-contracts';
import type { ContactsService } from '../../../../omnichannel/contacts/contacts.service';
import type { PrismaService } from '../../../../../infrastructure/database/prisma.service';

export interface UpdateContactInfoToolOptions {
  workspaceId: string;
  conversationId?: string;
  contactsService: ContactsService;
  prisma: PrismaService;
}

export const updateContactInfoInputSchema = z.object({
  name: z.string().optional().describe('Họ và tên của khách hàng'),
  phoneNumber: z.string().optional().describe('Số điện thoại liên lạc của khách hàng'),
  address: z
    .string()
    .optional()
    .describe(
      'Địa chỉ nhận hàng đầy đủ (số nhà, ngõ/ngách, đường, phường/xã, quận/huyện, tỉnh/thành)',
    ),
});

export type UpdateContactInfoInput = z.infer<typeof updateContactInfoInputSchema>;

export function createUpdateContactInfoTool({
  workspaceId,
  conversationId,
  contactsService,
  prisma,
}: UpdateContactInfoToolOptions): Tool {
  return tool({
    description:
      'Cập nhật thông tin khách hàng (họ tên, số điện thoại, địa chỉ nhận hàng) vào hệ thống khi khách cung cấp trong cuộc trò chuyện.',
    inputSchema: updateContactInfoInputSchema,
    execute: async ({ name, phoneNumber, address }: UpdateContactInfoInput) => {
      try {
        const client = prisma.getClient();

        // 1. Identify contact associated with this conversation
        let contactId: string | undefined;
        let conv: any = null;

        if (conversationId) {
          conv = await client.conversation.findFirst({
            where: { id: conversationId, workspaceId },
            select: { id: true, contactId: true },
          });
          contactId = conv?.contactId || undefined;
        }

        // 2. Normalize phone to E.164 standard (+84...)
        let e164Phone: string | undefined;
        if (phoneNumber) {
          const normalized = normalizeVietnamesePhone(phoneNumber);
          if (isValidVietnamesePhone(normalized)) {
            e164Phone = normalized.startsWith('0') ? `+84${normalized.slice(1)}` : normalized;
          }
        }

        // 3. If contact does not exist yet, find by phone or create new contact
        if (!contactId && e164Phone) {
          const existingContact = await client.contact.findFirst({
            where: { workspaceId, phoneNumber: e164Phone },
          });
          if (existingContact) {
            contactId = existingContact.id;
          }
        }

        if (!contactId) {
          const newContact = await client.contact.create({
            data: {
              workspaceId,
              name: name?.trim() || 'Khách hàng',
              phoneNumber: e164Phone || null,
              source: 'AI_AGENT',
              customAttributes: address?.trim() ? { address: address.trim() } : {},
            },
          });
          contactId = newContact.id;

          if (conv && !conv.contactId) {
            await client.conversation.updateMany({
              where: { id: conv.id, workspaceId },
              data: { contactId },
            });
          }

          return {
            contactId,
            name: newContact.name,
            phoneNumber: newContact.phoneNumber,
            address: address?.trim() || null,
            updated: true,
          };
        }

        // Link contact to conversation if missing
        if (conv && !conv.contactId && contactId) {
          await client.conversation.updateMany({
            where: { id: conv.id, workspaceId },
            data: { contactId },
          });
        }

        // 4. Build update DTO (address goes into customAttributes.address)
        const updatePayload: any = {};
        if (name && name.trim()) {
          updatePayload.name = name.trim();
        }
        if (e164Phone) {
          updatePayload.phoneNumber = e164Phone;
        }
        if (address && address.trim()) {
          updatePayload.customAttributes = { address: address.trim() };
        }

        if (Object.keys(updatePayload).length === 0) {
          return {
            contactId,
            message: 'Không có thông tin mới nào cần cập nhật',
            updated: false,
          };
        }

        const updated = await contactsService.update(workspaceId, contactId, updatePayload);

        return {
          contactId: updated.id,
          name: updated.name,
          phoneNumber: updated.phoneNumber,
          address:
            (updated.customAttributes as Record<string, any>)?.address || address?.trim() || null,
          updated: true,
        };
      } catch (error: any) {
        return {
          error: 'UPDATE_CONTACT_INFO_FAILED',
          message: error?.message || 'Không thể cập nhật thông tin khách hàng lúc này',
          updated: false,
        };
      }
    },
  });
}
