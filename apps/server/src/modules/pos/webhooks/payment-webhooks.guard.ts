import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ChannelCredentialService } from '../../inboxes/channel-credential.service';
import { WorkspacePaymentSettings } from '@sales-copilot/shared-contracts';

function safeTimingCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

@Injectable()
export class PaymentWebhooksGuard implements CanActivate {
  private readonly logger = new Logger(PaymentWebhooksGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly channelCredentialService: ChannelCredentialService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { workspaceId } = request.params;

    if (!workspaceId) {
      throw new UnauthorizedException({
        code: 'WORKSPACE_ID_REQUIRED',
        message: 'Workspace ID parameter is required in webhook URL',
      });
    }

    // 1. Fetch workspace payment settings
    const workspace = await this.prisma.getClient().workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, settings: true },
    });

    if (!workspace) {
      throw new UnauthorizedException({
        code: 'WORKSPACE_NOT_FOUND',
        message: `Workspace '${workspaceId}' not found`,
      });
    }

    const wsSettings = (workspace.settings as any)?.paymentSettings as
      WorkspacePaymentSettings | undefined;
    let configuredSecret = wsSettings?.webhookSecret;

    if (!configuredSecret) {
      this.logger.warn(
        `Payment webhook received for workspace ${workspaceId} without configured secret`,
      );
      throw new UnauthorizedException({
        code: 'PAYMENT_WEBHOOK_UNCONFIGURED',
        message: 'Payment webhook secret is not configured for this workspace',
      });
    }

    // Attempt AES-256-GCM decryption if secret is formatted as iv:authTag:ciphertext
    if (configuredSecret.split(':').length === 3) {
      try {
        const decrypted = this.channelCredentialService.decrypt<{
          secret?: string;
          webhookSecret?: string;
        }>(configuredSecret);
        configuredSecret =
          decrypted.secret ||
          decrypted.webhookSecret ||
          (typeof decrypted === 'string' ? decrypted : configuredSecret);
      } catch {
        // If decryption fails, continue with raw string (e.g. In test/dev environment)
      }
    }

    // 2. Extract authorization headers
    const authHeader = request.headers['authorization'] || '';
    const secureTokenHeader = request.headers['secure-token'] || '';
    const apiKeyHeader = request.headers['x-api-key'] || '';
    const signatureHeader =
      request.headers['x-signature'] ||
      request.headers['x-sepay-signature'] ||
      request.headers['x-casso-signature'] ||
      '';

    // A. Verify API Key / Secure Token
    if (safeTimingCompare(secureTokenHeader, configuredSecret)) {
      return true;
    }

    if (safeTimingCompare(apiKeyHeader, configuredSecret)) {
      return true;
    }

    if (
      authHeader.startsWith('Apikey ') ||
      authHeader.startsWith('apikey ') ||
      authHeader.startsWith('Bearer ')
    ) {
      const token = authHeader.split(' ')[1] || '';
      if (safeTimingCompare(token, configuredSecret)) {
        return true;
      }
    }

    // B. Verify HMAC SHA256 Signature if present
    if (signatureHeader) {
      let rawBodyBuffer: Buffer;
      if (Buffer.isBuffer(request.rawBody)) {
        rawBodyBuffer = request.rawBody;
      } else if (typeof request.rawBody === 'string') {
        rawBodyBuffer = Buffer.from(request.rawBody, 'utf8');
      } else {
        rawBodyBuffer = Buffer.from(JSON.stringify(request.body || {}), 'utf8');
      }

      const calculatedHmac = crypto
        .createHmac('sha256', configuredSecret)
        .update(rawBodyBuffer)
        .digest('hex');

      let cleanSignature = signatureHeader.trim();
      if (cleanSignature.startsWith('sha256=')) {
        cleanSignature = cleanSignature.slice(7);
      }

      if (safeTimingCompare(cleanSignature.toLowerCase(), calculatedHmac.toLowerCase())) {
        return true;
      }
    }

    this.logger.warn(`Unauthorized payment webhook attempt for workspace: ${workspaceId}`);
    throw new UnauthorizedException({
      code: 'INVALID_PAYMENT_WEBHOOK_SIGNATURE',
      message: 'Invalid payment webhook authentication credentials or signature',
    });
  }
}
