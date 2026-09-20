import { Body, Controller, Logger, Param, Post, UseGuards, Optional } from '@nestjs/common';
import {
  GenerateVietQrDto,
  generateVietQrSchema,
  MessageType,
  SenderType,
  VietQrResponseDto,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { CurrentUser } from '../../identity/auth/decorators/current-user.decorator';
import { CurrentWorkspace, Roles } from '../../identity/workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../../identity/workspaces/guards';
import type { WorkspaceContext } from '../../identity/workspaces/types/workspace-context.type';
import { VietQrService } from './vietqr.service';
import { MessagesService } from '../../omnichannel/messages/messages.service';

@Controller('workspaces/:workspaceId/orders/:id/vietqr')
@UseGuards(WorkspaceGuard, RolesGuard)
export class VietQrController {
  private readonly logger = new Logger(VietQrController.name);

  constructor(
    private readonly vietQrService: VietQrService,
    @Optional() private readonly messagesService?: MessagesService,
  ) {}

  @Post()
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  async generateVietQr(
    @Param('workspaceId') workspaceIdParam: string,
    @Param('id') orderId: string,
    @Body() rawBody?: GenerateVietQrDto,
    @CurrentUser() user?: { id: string },
    @CurrentWorkspace() context?: WorkspaceContext,
  ): Promise<VietQrResponseDto> {
    const workspaceId = context?.workspaceId || workspaceIdParam;
    const validatedDto = rawBody ? generateVietQrSchema.parse(rawBody) : undefined;

    const vietQr = await this.vietQrService.generateForOrder(workspaceId, orderId, validatedDto);

    // If sendToChat is true (default) and order has conversationId, post interactive QR card into chat thread
    const shouldSendToChat = validatedDto?.sendToChat !== false;

    if (shouldSendToChat && this.messagesService && vietQr.conversationId) {
      try {
        const formattedAmount = new Intl.NumberFormat('vi-VN').format(vietQr.amount);
        const senderType = user?.id ? SenderType.USER : SenderType.SYSTEM;
        const senderId = user?.id ? user.id : undefined;

        await this.messagesService.create(workspaceId, vietQr.conversationId, {
          content: `💳 Mã thanh toán VietQR cho đơn hàng #${vietQr.displayId} (${formattedAmount}đ)`,
          senderType,
          senderId,
          messageType: MessageType.OUTGOING,
          metadata: {
            type: 'VIETQR_PAYMENT',
            qrData: vietQr,
          },
        });

        this.logger.log(
          `Posted VietQR payment card to conversation ${vietQr.conversationId} for order #${vietQr.displayId}`,
        );
      } catch (err: any) {
        this.logger.warn(`Failed to auto-send VietQR card to chat thread: ${err.message}`);
      }
    }

    return vietQr;
  }
}
