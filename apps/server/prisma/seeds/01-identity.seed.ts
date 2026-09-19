import * as argon2 from 'argon2';
import type { PrismaClient, User, Workspace, Team } from '../../src/infrastructure/database';

export interface IdentitySeedResult {
  users: {
    superAdmin: User;
    admin: User;
    agent: User;
  };
  workspace: Workspace;
  team: Team;
}

export async function seedIdentity(prisma: PrismaClient): Promise<IdentitySeedResult> {
  console.log('👤 [01-Identity] Seeding users, workspace, and memberships...');

  const defaultAdminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'superadmin@salescopilot.io';
  const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'SalesCopilot@2026!';
  const passwordHash = await argon2.hash(defaultAdminPassword);

  // 1. Seed Users
  const superAdmin = await prisma.user.upsert({
    where: { email: defaultAdminEmail },
    update: {
      name: 'Super Administrator',
      role: 'SUPER_ADMIN',
      isActive: true,
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=superadmin',
    },
    create: {
      email: defaultAdminEmail,
      passwordHash,
      name: 'Super Administrator',
      role: 'SUPER_ADMIN',
      isActive: true,
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=superadmin',
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@salescopilot.io' },
    update: {
      name: 'Trần Quản Trị (Admin)',
      role: 'USER',
      isActive: true,
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
    },
    create: {
      email: 'admin@salescopilot.io',
      passwordHash,
      name: 'Trần Quản Trị (Admin)',
      role: 'USER',
      isActive: true,
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
    },
  });

  const agentUser = await prisma.user.upsert({
    where: { email: 'agent@salescopilot.io' },
    update: {
      name: 'Lê Tư Vấn (Sarah Agent)',
      role: 'USER',
      isActive: true,
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=sarahagent',
    },
    create: {
      email: 'agent@salescopilot.io',
      passwordHash,
      name: 'Lê Tư Vấn (Sarah Agent)',
      role: 'USER',
      isActive: true,
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=sarahagent',
    },
  });

  // 2. Seed Default Workspace (Tenant / Store)
  const defaultWorkspaceSlug = 'default-workspace';
  const defaultWorkspaceSettings = {
    currency: 'VND',
    features: {
      autoAssign: true,
      webhooks: true,
    },
    paymentSettings: {
      bankBin: '970422', // MBBank (Napas)
      bankCode: 'MB',
      bankName: 'MBBank',
      accountNumber: '0988123456',
      accountName: 'CONG TY SALES COPILOT',
      webhookSecret: 'sepay_test_secret_key_2026',
    },
  };

  const workspace = await prisma.workspace.upsert({
    where: { slug: defaultWorkspaceSlug },
    update: {
      name: 'Sales Copilot Flagship Store',
      billingPlan: 'ENTERPRISE',
      timezone: 'Asia/Ho_Chi_Minh',
      defaultLanguage: 'vi',
      settings: defaultWorkspaceSettings,
    },
    create: {
      name: 'Sales Copilot Flagship Store',
      slug: defaultWorkspaceSlug,
      billingPlan: 'ENTERPRISE',
      timezone: 'Asia/Ho_Chi_Minh',
      defaultLanguage: 'vi',
      settings: defaultWorkspaceSettings,
    },
  });

  // 3. Seed Workspace Memberships (OWNER, ADMIN, AGENT)
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: superAdmin.id,
      },
    },
    update: { role: 'OWNER' },
    create: {
      workspaceId: workspace.id,
      userId: superAdmin.id,
      role: 'OWNER',
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: adminUser.id,
      },
    },
    update: { role: 'ADMIN' },
    create: {
      workspaceId: workspace.id,
      userId: adminUser.id,
      role: 'ADMIN',
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: agentUser.id,
      },
    },
    update: { role: 'AGENT' },
    create: {
      workspaceId: workspace.id,
      userId: agentUser.id,
      role: 'AGENT',
    },
  });

  // 4. Seed Default Team & Team Members
  const team = await prisma.team.upsert({
    where: {
      workspaceId_name: {
        workspaceId: workspace.id,
        name: 'Đội Hỗ Trợ & Tư Vấn Bán Hàng',
      },
    },
    update: {
      description: 'Đội ngũ chuyên trách tiếp nhận hội thoại và chốt đơn bán lẻ đa kênh',
    },
    create: {
      workspaceId: workspace.id,
      name: 'Đội Hỗ Trợ & Tư Vấn Bán Hàng',
      description: 'Đội ngũ chuyên trách tiếp nhận hội thoại và chốt đơn bán lẻ đa kênh',
    },
  });

  for (const user of [superAdmin, adminUser, agentUser]) {
    await prisma.teamMember.upsert({
      where: {
        teamId_userId: {
          teamId: team.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        teamId: team.id,
        userId: user.id,
      },
    });
  }

  console.log(`   ✔ Workspace '${workspace.name}' (${workspace.id})`);
  console.log(`   ✔ 3 Users & Memberships: SuperAdmin, Admin, Agent`);
  console.log(`   ✔ Team '${team.name}' with 3 members`);

  return {
    users: { superAdmin, admin: adminUser, agent: agentUser },
    workspace,
    team,
  };
}
