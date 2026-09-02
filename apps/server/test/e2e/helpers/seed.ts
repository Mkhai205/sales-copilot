import * as argon2 from 'argon2';
import {
  Channel,
  ChannelIdentity,
  Contact,
  Inbox,
  User,
  Workspace,
  PrismaService,
} from '../../../src/infrastructure/database';

import { ChannelCredentialService } from '../../../src/modules/inboxes/channel-credential.service';

export interface SeedTestContext {
  testRunId: string;
  adminUser: User;
  agentUser: User;
  adminPassword: string;
  agentPassword: string;
  workspace: Workspace;
  inbox: Inbox;
  channel: Channel;
  plainCredentials: Record<string, any>;
  contact: Contact;
  channelIdentity: ChannelIdentity;
}

export interface SeedOptions {
  channelType?: 'WEB_CHAT' | 'FACEBOOK_MESSENGER' | 'TELEGRAM' | 'ZALO' | 'EMAIL';
  channelCredentials?: Record<string, any>;
  autoAssign?: boolean;
}

/**
 * Seeds a full isolated tenant dataset for E2E testing:
 * - Admin User & Agent User (passwords hashed with argon2)
 * - Workspace
 * - Workspace Memberships (OWNER/ADMIN and AGENT)
 * - Inbox & InboxMember
 * - Channel with provider account ID
 * - Contact & ChannelIdentity
 */
export async function seedTestData(
  prisma: PrismaService,
  options?: SeedOptions,
): Promise<SeedTestContext> {
  const client = prisma.client;
  const testRunId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const defaultPassword = 'Password123!';
  const passwordHash = await argon2.hash(defaultPassword);

  // 1. Create Users
  const adminUser = await client.user.create({
    data: {
      email: `admin-${testRunId}@test.salescopilot.io`,
      name: `E2E Admin ${testRunId}`,
      passwordHash,
      role: 'USER',
      isActive: true,
    },
  });

  const agentUser = await client.user.create({
    data: {
      email: `agent-${testRunId}@test.salescopilot.io`,
      name: `E2E Agent ${testRunId}`,
      passwordHash,
      role: 'USER',
      isActive: true,
    },
  });

  // 2. Create Workspace
  const workspace = await client.workspace.create({
    data: {
      name: `E2E Test Workspace ${testRunId}`,
      slug: `e2e-ws-${testRunId}`,
      billingPlan: 'FREE',
      timezone: 'Asia/Ho_Chi_Minh',
      defaultLanguage: 'vi',
    },
  });

  // 3. Create Workspace Members
  await client.workspaceMember.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: adminUser.id,
        role: 'ADMIN',
      },
      {
        workspaceId: workspace.id,
        userId: agentUser.id,
        role: 'AGENT',
      },
    ],
  });

  // 4. Create Inbox
  const inbox = await client.inbox.create({
    data: {
      workspaceId: workspace.id,
      name: `E2E Inbox ${testRunId}`,
      isAutoAssignmentEnabled: options?.autoAssign ?? false,
    },
  });

  // 5. Add Agent to Inbox
  await client.inboxMember.create({
    data: {
      inboxId: inbox.id,
      userId: agentUser.id,
    },
  });

  // 6. Create Channel attached to Inbox
  const channelType = options?.channelType ?? 'WEB_CHAT';
  const providerAccountId = `e2e-provider-${testRunId}`;

  const credentialService = new ChannelCredentialService({
    get: (key: string) =>
      key === 'CHANNEL_ENCRYPTION_KEY'
        ? process.env.CHANNEL_ENCRYPTION_KEY ||
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
        : undefined,
  } as any);

  const plainCredentials = options?.channelCredentials ?? {
    widgetToken: `token-${testRunId}`,
    mockSecret: 'test-secret',
  };

  const encrypted = credentialService.encrypt(plainCredentials);

  const channel = await client.channel.create({
    data: {
      workspaceId: workspace.id,
      inboxId: inbox.id,
      channelType: channelType as any,
      providerAccountId,
      credentials: { encrypted },
      isConnected: true,
    },
  });

  // 7. Create Contact
  const contact = await client.contact.create({
    data: {
      workspaceId: workspace.id,
      name: `E2E Customer ${testRunId}`,
      email: `customer-${testRunId}@example.com`,
      phoneNumber: '+84901234567',
      identifier: `ext-${testRunId}`,
    },
  });

  // 8. Create ChannelIdentity
  const channelIdentity = await client.channelIdentity.create({
    data: {
      workspaceId: workspace.id,
      channelId: channel.id,
      contactId: contact.id,
      externalContactId: `ext-sender-${testRunId}`,
      username: `Customer ${testRunId}`,
    },
  });

  return {
    testRunId,
    adminUser,
    agentUser,
    adminPassword: defaultPassword,
    agentPassword: defaultPassword,
    workspace,
    inbox,
    channel,
    plainCredentials,
    contact,
    channelIdentity,
  };
}

/**
 * Cleanly deletes all records created during the E2E test run
 * in reverse dependency order to prevent foreign key constraints.
 */
export async function cleanupTestData(
  prisma: PrismaService,
  context: SeedTestContext,
): Promise<void> {
  const client = prisma.client;
  const workspaceId = context.workspace?.id;

  if (!workspaceId) return;

  try {
    // 1. Delete messages (if any were created in tests)
    await client.message.deleteMany({
      where: { conversation: { workspaceId } },
    });

    // Clean up operations & automation
    await client.automationRule.deleteMany({ where: { workspaceId } });
    await client.auditLog.deleteMany({ where: { workspaceId } });
    await client.label.deleteMany({ where: { workspaceId } });

    // 2. Delete conversations (if any were created)
    await client.conversation.deleteMany({
      where: { workspaceId },
    });

    // 3. Delete channel identities
    await client.channelIdentity.deleteMany({
      where: { workspaceId },
    });

    // 4. Delete contacts
    await client.contact.deleteMany({
      where: { workspaceId },
    });

    // 5. Delete channel events & channels and inboxes
    await client.channelEvent.deleteMany({
      where: { channel: { workspaceId } },
    });

    await client.channel.deleteMany({
      where: { workspaceId },
    });

    await client.inbox.deleteMany({
      where: { workspaceId },
    });

    // 6. Delete workspace (cascades members, teams, etc.)
    await client.workspace.deleteMany({
      where: { id: workspaceId },
    });

    // 7. Delete test users
    const userIds = [context.adminUser?.id, context.agentUser?.id].filter(Boolean);
    if (userIds.length > 0) {
      await client.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
  } catch (error) {
    // Non-fatal warning on cleanup
    console.warn(`[cleanupTestData] Warning during test cleanup: ${(error as Error)?.message}`);
  }
}
