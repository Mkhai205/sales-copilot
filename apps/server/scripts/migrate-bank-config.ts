import * as dotenv from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { getPrismaClient, closeDatabaseConnections } from '../src/infrastructure/database/client';
import { ChannelCredentialService } from '../src/modules/omnichannel/inboxes/channel-credential.service';

dotenv.config();

const prisma = getPrismaClient();

interface LegacyBankConfig {
  bankBin?: string;
  bankId?: string;
  accountNumber?: string;
  accountNo?: string;
  accountName?: string;
  webhookSecret?: string;
  sepayWebhookSecret?: string;
  bankCode?: string;
  bankName?: string;
}

export async function migrateBankConfig() {
  console.log('🔄 Starting migration from settings.bankConfig to settings.paymentSettings...');

  let credentialService: ChannelCredentialService | null = null;
  if (process.env.CHANNEL_ENCRYPTION_KEY && process.env.CHANNEL_ENCRYPTION_KEY.trim()) {
    try {
      const configService = new ConfigService();
      credentialService = new ChannelCredentialService(configService);
    } catch (err) {
      console.warn(
        '⚠️ Could not initialize ChannelCredentialService for migration encryption:',
        err,
      );
    }
  }

  const workspaces = await prisma.workspace.findMany({
    where: {
      settings: {
        not: null,
      },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      settings: true,
    },
  });

  console.log(`Found ${workspaces.length} workspace(s) with settings.`);
  let migratedCount = 0;
  let skippedCount = 0;

  for (const workspace of workspaces) {
    const settings = (workspace.settings as Record<string, any>) || {};
    const bankConfig = settings.bankConfig as LegacyBankConfig | undefined;
    const paymentSettings = settings.paymentSettings;

    if (!bankConfig) {
      skippedCount++;
      continue;
    }

    if (paymentSettings && Object.keys(paymentSettings).length > 0) {
      console.log(
        `- Skipping [${workspace.slug}] (${workspace.id}): paymentSettings already exists.`,
      );
      skippedCount++;
      continue;
    }

    let webhookSecret = bankConfig.webhookSecret || bankConfig.sepayWebhookSecret || '';
    if (webhookSecret && credentialService && webhookSecret.split(':').length !== 3) {
      try {
        webhookSecret = credentialService.encrypt({
          secret: webhookSecret,
          webhookSecret,
        });
      } catch (e) {
        console.warn(`Could not encrypt webhook secret for workspace ${workspace.id}:`, e);
      }
    }

    const newPaymentSettings = {
      bankBin: bankConfig.bankBin || bankConfig.bankId || '',
      bankCode: bankConfig.bankCode || bankConfig.bankId || '',
      bankName: bankConfig.bankName || '',
      accountNumber: bankConfig.accountNumber || bankConfig.accountNo || '',
      accountName: bankConfig.accountName || '',
      webhookSecret,
    };

    const updatedSettings = {
      ...settings,
      paymentSettings: newPaymentSettings,
    };

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { settings: updatedSettings },
    });

    migratedCount++;
    console.log(
      `✓ Migrated [${workspace.slug}] (${workspace.id}) -> paymentSettings: ${newPaymentSettings.bankCode} / ${newPaymentSettings.accountNumber}`,
    );
  }

  console.log(
    `\n🎉 Migration complete. Migrated: ${migratedCount}, Skipped: ${skippedCount}, Total: ${workspaces.length}`,
  );
  return { migratedCount, skippedCount, total: workspaces.length };
}

if (require.main === module) {
  migrateBankConfig()
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await closeDatabaseConnections();
    });
}
