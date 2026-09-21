import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { renderEmployeeCredentialsEmail } from '@sales-copilot/email-templates';

export interface SendEmployeeCredentialsParams {
  to: string;
  name: string;
  temporaryPassword: string;
  workspaceName: string;
  role: string;
  loginUrl?: string;
}

@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private readonly resend: Resend | null = null;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.fromEmail =
      this.configService.get<string>('RESEND_FROM_EMAIL') ||
      'Sales Copilot <noreply@salescopilot.io>';

    if (apiKey && apiKey.trim().length > 0) {
      this.resend = new Resend(apiKey.trim());
      this.logger.log('Resend email service initialized successfully');
    } else {
      this.logger.warn(
        'RESEND_API_KEY is not configured. Outgoing emails will be logged only (simulated mode).',
      );
    }
  }

  async sendEmployeeCredentials(params: SendEmployeeCredentialsParams): Promise<boolean> {
    const {
      to,
      name,
      temporaryPassword,
      workspaceName,
      role,
      loginUrl = 'http://localhost:3000/login',
    } = params;

    let htmlContent: string;
    try {
      htmlContent = await renderEmployeeCredentialsEmail({
        to,
        name,
        temporaryPassword,
        workspaceName,
        role,
        loginUrl,
      });
    } catch (renderError: any) {
      this.logger.error(
        `Failed to render employee credentials email template for ${to}: ${renderError?.message || renderError}`,
        renderError?.stack,
      );
      return false;
    }

    if (!this.resend) {
      this.logger.log(
        `[SIMULATED EMAIL] To: ${to} | Workspace: ${workspaceName} | Temp Password: ${temporaryPassword}`,
      );
      return true;
    }

    try {
      const response = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: `[Sales Copilot] Thông tin tài khoản nhân viên - ${workspaceName}`,
        html: htmlContent,
      });

      if (response.error) {
        this.logger.error(
          `Failed to send employee credentials email via Resend to ${to}: ${response.error.message}`,
        );
        return false;
      }

      this.logger.log(
        `Credentials email successfully dispatched to ${to} (id: ${response.data?.id})`,
      );
      return true;
    } catch (err: any) {
      this.logger.error(
        `Unexpected error sending email via Resend to ${to}: ${err?.message || err}`,
        err?.stack,
      );
      return false;
    }
  }
}
