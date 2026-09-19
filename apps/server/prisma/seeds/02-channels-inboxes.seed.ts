import type {
  PrismaClient,
  Workspace,
  User,
  Inbox,
  Channel,
} from '../../src/infrastructure/database';

export interface ChannelsInboxesSeedResult {
  inbox: Inbox;
  channel: Channel;
}

export async function seedChannelsInboxes(
  prisma: PrismaClient,
  workspace: Workspace,
  users: User[],
): Promise<ChannelsInboxesSeedResult> {
  console.log('📥 [02-Channels & Inboxes] Seeding Web Chat inbox and channel...');

  // 1. Seed Inbox
  let inbox = await prisma.inbox.findFirst({
    where: {
      workspaceId: workspace.id,
      name: 'Website Live Chat',
    },
  });

  if (!inbox) {
    inbox = await prisma.inbox.create({
      data: {
        workspaceId: workspace.id,
        name: 'Website Live Chat',
        isAutoAssignmentEnabled: true,
        settings: {
          greetingMessage:
            'Xin chào! Em có thể hỗ trợ tư vấn sản phẩm hoặc đơn hàng gì cho mình hôm nay ạ?',
        },
      },
    });
  }

  // 2. Add Users to Inbox
  for (const user of users) {
    await prisma.inboxMember.upsert({
      where: {
        inboxId_userId: {
          inboxId: inbox.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        inboxId: inbox.id,
        userId: user.id,
      },
    });
  }

  // 3. Seed Channel (1:1 attached to Inbox)
  let webChatChannel = await prisma.channel.findFirst({
    where: { inboxId: inbox.id },
  });

  if (!webChatChannel) {
    webChatChannel = await prisma.channel.create({
      data: {
        workspaceId: workspace.id,
        inboxId: inbox.id,
        channelType: 'WEB_CHAT',
        providerAccountId: 'webchat_default',
        isConnected: true,
        settings: {
          widgetColor: '#2563eb',
          welcomeTitle: 'Hỗ trợ trực tuyến Sales Copilot',
        },
      },
    });
  }

  // 4. Seed ChannelEvent for event tracking & idempotency baseline
  await prisma.channelEvent.upsert({
    where: {
      channelId_externalEventId: {
        channelId: webChatChannel.id,
        externalEventId: 'evt_inbound_webchat_baseline',
      },
    },
    update: {},
    create: {
      channelId: webChatChannel.id,
      externalEventId: 'evt_inbound_webchat_baseline',
      eventType: 'message.incoming',
      payload: { text: 'Xin chào!', senderId: 'web_session_cust_001' },
      processedAt: new Date(),
    },
  });

  console.log(`   ✔ Inbox '${inbox.name}' (${inbox.id}) with 3 members`);
  console.log(
    `   ✔ Channel WEB_CHAT attached (providerAccountId: ${webChatChannel.providerAccountId})`,
  );

  return { inbox, channel: webChatChannel };
}
