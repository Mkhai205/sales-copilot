import { Injectable } from '@nestjs/common';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../../infrastructure/database';

@Injectable()
export class WebChatService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves a Web Chat channel by its website/widget token (providerAccountId or inboxId).
   */
  async resolveChannelByToken(token: string) {
    const client = this.prisma.getClient();
    return client.channel.findFirst({
      where: {
        channelType: ChannelType.WEB_CHAT,
        OR: [{ providerAccountId: token }, { inboxId: token }],
      },
      include: {
        inbox: true,
      },
    });
  }

  /**
   * Lists historical conversations for an authenticated visitor.
   */
  async getVisitorConversations(workspaceId: string, inboxId: string, contactId: string) {
    const client = this.prisma.getClient();
    return client.conversation.findMany({
      where: {
        workspaceId,
        inboxId,
        contactId,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          where: { isPrivate: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  /**
   * Finds a visitor conversation by ID scoped strictly to workspaceId.
   */
  async getVisitorConversation(workspaceId: string, conversationId: string) {
    const client = this.prisma.getClient();
    return client.conversation.findFirst({
      where: {
        id: conversationId,
        workspaceId,
      },
    });
  }
}
