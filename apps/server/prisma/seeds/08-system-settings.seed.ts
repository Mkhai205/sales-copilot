import type { PrismaClient } from '../../src/infrastructure/database';

export async function seedSystemSettings(prisma: PrismaClient): Promise<void> {
  console.log('⚙️ [08-System Settings] Seeding platform configuration records...');

  const settingsToSeed = [
    {
      key: 'platform.general',
      category: 'GENERAL',
      description: 'Cấu hình thông tin chung và liên hệ hỗ trợ toàn hệ thống',
      value: {
        siteName: 'Sales Copilot Omnichannel Platform',
        supportEmail: 'support@salescopilot.io',
        supportHotline: '1900 6868',
        defaultTimezone: 'Asia/Ho_Chi_Minh',
        maintenanceMode: false,
      },
    },
    {
      key: 'ai.default_model',
      category: 'AI',
      description: 'Cấu hình mô hình ngôn ngữ lớn AI Copilot mặc định',
      value: {
        provider: 'google',
        model: 'gemini-2.5-flash',
        temperature: 0.7,
        maxTokens: 4096,
      },
    },
    {
      key: 'billing.limits',
      category: 'BILLING',
      description: 'Hạn mức tài nguyên theo các gói cước dịch vụ',
      value: {
        free: { maxAgents: 3, maxProducts: 50, maxConversationsMonth: 1000 },
        standard: { maxAgents: 10, maxProducts: 500, maxConversationsMonth: 10000 },
        enterprise: { maxAgents: 9999, maxProducts: 99999, maxConversationsMonth: 999999 },
      },
    },
    {
      key: 'payment.vietqr',
      category: 'PAYMENT',
      description: 'Cấu hình dịch vụ sinh mã QR thanh toán Napas VietQR',
      value: {
        serviceUrl: 'https://img.vietqr.io',
        defaultTemplate: 'compact2',
        napasBin: '970422',
      },
    },
  ];

  for (const item of settingsToSeed) {
    await prisma.systemSetting.upsert({
      where: { key: item.key },
      update: {
        value: item.value,
        category: item.category,
        description: item.description,
      },
      create: {
        key: item.key,
        value: item.value,
        category: item.category,
        description: item.description,
        isEncrypted: false,
      },
    });
  }

  console.log(
    `   ✔ ${settingsToSeed.length} System settings seeded (Platform General, Gemini AI, Billing Limits, VietQR)`,
  );
}
