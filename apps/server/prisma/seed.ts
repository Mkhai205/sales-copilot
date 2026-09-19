import * as dotenv from 'dotenv';
import { getPrismaClient, closeDatabaseConnections } from '../src/infrastructure/database/client';

import { cleanWorkspaceData } from './seeds/clean.seed';
import { seedIdentity } from './seeds/01-identity.seed';
import { seedChannelsInboxes } from './seeds/02-channels-inboxes.seed';
import { seedOperations } from './seeds/03-operations.seed';
import { seedCatalogInventory } from './seeds/04-catalog-inventory.seed';
import { seedContacts } from './seeds/05-contacts.seed';
import { seedConversations } from './seeds/06-conversations.seed';
import { seedOrdersPayments } from './seeds/07-orders-payments.seed';
import { seedSystemSettings } from './seeds/08-system-settings.seed';

dotenv.config();

const prisma = getPrismaClient();

async function seed() {
  const startTime = Date.now();
  const isClean = process.env.SEED_CLEAN === 'true' || process.argv.includes('--clean');

  console.log('================================================================================');
  console.log('🌱 [Sales Copilot] Domain-Driven Database Seed Orchestrator (Phase 3B Baseline)');
  console.log(
    `   Mode: ${isClean ? '🧹 CLEAN & RE-SEED (Fresh Slate)' : '🔄 HYBRID IDEMPOTENT UPSERT'}`,
  );
  console.log('================================================================================\n');

  // Optional: Clean wipe if requested
  if (isClean) {
    await cleanWorkspaceData(prisma, 'default-workspace');
    console.log('');
  }

  // 1. Identity & Tenant Setup
  const { users, workspace, team } = await seedIdentity(prisma);
  const userList = [users.superAdmin, users.admin, users.agent];

  // 2. Channels & Inboxes
  const { inbox, channel } = await seedChannelsInboxes(prisma, workspace, userList);

  // 3. Operations: Labels & Canned Responses
  const labels = await seedOperations(prisma, workspace);

  // 4. Catalog & Inventory Ledger
  const { products, variants } = await seedCatalogInventory(prisma, workspace);

  // 5. Contacts CRM & Channel Identities
  const { contacts, channelIdentities } = await seedContacts(prisma, workspace, channel);

  // 6. Conversations, Messages & Attachments
  const { conversations } = await seedConversations(
    prisma,
    workspace,
    inbox,
    users,
    team,
    contacts,
    channelIdentities,
    labels,
  );

  // 7. Orders, Order Items, VietQR / SePay Payments & Inventory Reservations
  const { orders } = await seedOrdersPayments(
    prisma,
    workspace,
    users,
    contacts,
    products,
    variants,
    conversations,
  );

  // 8. Platform System Settings
  await seedSystemSettings(prisma);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n================================================================================');
  console.log('✨ [Sales Copilot] Database Seeding Summary & Quality Verification');
  // eslint-disable-next-line no-console
  console.table({
    'Workspace & Store': { Count: 1, Detail: workspace.name },
    'Users & Memberships': { Count: userList.length, Detail: 'SuperAdmin, Admin, Agent' },
    'Support Teams': { Count: 1, Detail: team.name },
    'Inboxes & Channels': { Count: 1, Detail: 'Website Live Chat (WEB_CHAT 1:1)' },
    'Labels & Tags': {
      Count: Object.keys(labels).length,
      Detail: 'VIP, Khách sỉ, Khiếu nại, Báo giá, Hỗ trợ...',
    },
    'Catalog Products': {
      Count: products.length,
      Detail: '5 Products (Software, Headphone, Polo, Mouse, Flask)',
    },
    'Product Variants': {
      Count: variants.length,
      Detail: '10 Variants (Low Stock & Out of Stock simulated)',
    },
    'CRM Contacts': {
      Count: contacts.length,
      Detail: '12 Vietnamese Customer Profiles (3-level address)',
    },
    Conversations: {
      Count: conversations.length,
      Detail: '7 Rich Threads (OPEN, RESOLVED, SNOOZED, PENDING)',
    },
    'Commerce Orders': {
      Count: orders.length,
      Detail: '8 Orders (DRAFT, CONFIRMED, PAID, SHIPPING, COMPLETED)',
    },
    'System Settings': { Count: 4, Detail: 'Gemini AI, Platform General, Limits, VietQR' },
  });
  console.log(`⏱️ Execution Time: ${durationSec}s`);
  console.log(
    '🎉 All domains seeded successfully and ready for development & live demonstration!\n',
  );
}

seed()
  .catch(e => {
    console.error('❌ Database seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await closeDatabaseConnections();
  });
