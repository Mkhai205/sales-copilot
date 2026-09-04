import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  Header,
  StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import {
  ChannelType,
  IdentifyContactDto,
  MessageListQueryDto,
  MessageResponseDto,
  PaginationMeta,
  widgetContactRequestSchema,
  type WidgetContactRequestDto,
  type WidgetContactResponseDto,
} from '@sales-copilot/shared-contracts';
import { ZodBody } from '../../common/pipes';
import { PrismaService } from '../../infrastructure/database';
import { ChannelCredentialService } from '../../modules/inboxes/channel-credential.service';
import { ContactResolutionService } from '../../modules/contacts/contact-resolution.service';
import { MessagesService } from '../../modules/messages/messages.service';
import { WebChatAdapter } from './web-chat.adapter';
import { ChannelContext } from '../channel-adapter.types';
import { WidgetTokenPayload, WidgetTokenService } from './widget-token.service';
import { Public } from '../../modules/auth';

/**
 * Controller exposing public REST API endpoints for embeddable Web Chat widgets.
 * Route prefix: `/api/v1/widget`
 */
@ApiTags('Web Chat Widget')
@Public()
@Controller('widget')
export class WebChatController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialService: ChannelCredentialService,
    private readonly contactResolutionService: ContactResolutionService,
    private readonly messagesService: MessagesService,
    private readonly webChatAdapter: WebChatAdapter,
    private readonly widgetTokenService: WidgetTokenService,
  ) {}

  /**
   * Serves the embeddable Web Chat Widget SDK bundle.
   */
  @Get('sdk.js')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Serve the embeddable Web Chat Widget JavaScript SDK' })
  getSdkScript(@Res() res: Response) {
    const candidatePaths = [
      path.resolve(process.cwd(), 'packages/widget-sdk/dist/sdk.js'),
      path.resolve(__dirname, '../../../../../packages/widget-sdk/dist/sdk.js'),
      path.resolve(__dirname, '../../../../packages/widget-sdk/dist/sdk.js'),
      path.resolve(__dirname, '../../../packages/widget-sdk/dist/sdk.js'),
      path.resolve(__dirname, 'assets/sdk.js'),
    ];

    for (const filePath of candidatePaths) {
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        return res.sendFile(filePath);
      }
    }

    throw new NotFoundException({
      code: 'WIDGET_SDK_NOT_FOUND',
      message: 'Widget SDK bundle not found. Please build packages/widget-sdk first.',
    });
  }

  /**
   * Retrieves public widget configuration (colors, greetings, pre-chat form options, reply times).
   */
  @Get('config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get widget configuration and customization options' })
  @ApiQuery({ name: 'website_token', required: false, description: 'Website token' })
  @ApiQuery({ name: 'widget_token', required: false, description: 'Widget token' })
  async getWidgetConfig(
    @Query('website_token') queryWebsiteToken?: string,
    @Query('widget_token') queryWidgetToken?: string,
    @Query('websiteToken') queryCamelWebsite?: string,
    @Query('widgetToken') queryCamelWidget?: string,
  ) {
    const token = queryWebsiteToken || queryWidgetToken || queryCamelWebsite || queryCamelWidget;

    if (!token) {
      throw new BadRequestException({
        code: 'WEBSITE_TOKEN_REQUIRED',
        message: 'Website token is required to load widget configuration',
      });
    }

    const channel = await this.resolveChannelByToken(token);
    if (!channel) {
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: `Web chat channel with token '${token}' not found`,
      });
    }

    const channelContext: ChannelContext = {
      channelId: channel.id,
      inboxId: channel.inboxId,
      workspaceId: channel.workspaceId,
      channelType: ChannelType.WEB_CHAT,
      credentials: this.decryptCredentials(channel.credentials),
      settings: (channel.settings as Record<string, unknown>) || {},
      providerAccountId: channel.providerAccountId,
    };

    const channelInfo = await this.webChatAdapter.getChannelInfo(channelContext);

    return {
      channelId: channel.id,
      inboxId: channel.inboxId,
      ...(channelInfo.metadata || {}),
    };
  }

  /**
   * Creates or gets a visitor contact session, issuing a Contact JWT token.
   */
  @Post('contact')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or resolve an anonymous visitor contact and issue JWT token' })
  async getOrCreateContact(
    @ZodBody(widgetContactRequestSchema) dto: WidgetContactRequestDto,
  ): Promise<WidgetContactResponseDto> {
    const token = dto.websiteToken || dto.widgetToken || dto.website_token || dto.widget_token;

    if (!token) {
      throw new BadRequestException({
        code: 'WEBSITE_TOKEN_REQUIRED',
        message: 'Website token is required to initialize visitor session',
      });
    }

    const channel = await this.resolveChannelByToken(token);
    if (!channel) {
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: `Web chat channel with token '${token}' not found`,
      });
    }

    const externalContactId =
      dto.contactToken ||
      dto.contact_token ||
      dto.identifier ||
      `anon_${crypto.randomUUID().slice(0, 12)}`;

    const contactInfo: IdentifyContactDto | undefined =
      dto.name || dto.email || dto.phoneNumber || dto.avatarUrl || dto.identifier
        ? {
            name: dto.name,
            email: dto.email,
            phoneNumber: dto.phoneNumber,
            avatarUrl: dto.avatarUrl,
            identifier: dto.identifier,
          }
        : undefined;

    const resolution = await this.contactResolutionService.resolveFromChannel({
      workspaceId: channel.workspaceId,
      channelId: channel.id,
      externalContactId,
      contactInfo,
    });

    const contact = resolution.contact;
    const identity = resolution.channelIdentity;

    const tokenPayload: WidgetTokenPayload = {
      contactId: contact.id,
      workspaceId: channel.workspaceId,
      channelId: channel.id,
      inboxId: channel.inboxId,
      externalContactId: identity.externalContactId,
      widgetToken: token,
      identifier: contact.identifier,
    };

    const contactJwt = this.widgetTokenService.generateToken(tokenPayload);

    return {
      token: contactJwt,
      contactToken: identity.externalContactId,
      contact: contact as unknown as Record<string, unknown>,
      isNewContact: resolution.isNewContact,
    };
  }

  /**
   * Lists historical conversations for the authenticated visitor.
   */
  @Get('conversations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "List the authenticated visitor's conversations" })
  async getVisitorConversations(@Req() req: Request) {
    const tokenPayload = this.authenticateVisitor(req);
    const client = this.prisma.getClient();

    const conversations = await client.conversation.findMany({
      where: {
        workspaceId: tokenPayload.workspaceId,
        inboxId: tokenPayload.inboxId,
        contactId: tokenPayload.contactId,
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

    return {
      items: conversations,
      meta: {
        total: conversations.length,
        page: 1,
        limit: 50,
        totalPages: 1,
      },
    };
  }

  /**
   * Retrieves message history for a specific visitor conversation.
   * Enforces visitor conversation authorization and excludes internal private notes.
   */
  @Get('conversations/:conversationId/messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get conversation messages for visitor' })
  async getConversationMessages(
    @Param('conversationId') conversationId: string,
    @Req() req: Request,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('beforeId') beforeId?: string,
    @Query('afterId') afterId?: string,
  ): Promise<{ items: MessageResponseDto[]; meta: PaginationMeta }> {
    const tokenPayload = this.authenticateVisitor(req);
    const client = this.prisma.getClient();

    // Verify conversation belongs to this visitor
    const conversation = await client.conversation.findFirst({
      where: {
        id: conversationId,
        workspaceId: tokenPayload.workspaceId,
      },
    });

    if (!conversation) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: `Conversation with id '${conversationId}' not found`,
      });
    }

    if (conversation.contactId !== tokenPayload.contactId) {
      throw new ForbiddenException({
        code: 'UNAUTHORIZED_CONVERSATION_ACCESS',
        message: 'You do not have permission to access messages from this conversation',
      });
    }

    const queryDto: MessageListQueryDto = {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      beforeId,
      afterId,
    };

    // isAgent = false ensures private notes are hidden from visitors
    return this.messagesService.list(tokenPayload.workspaceId, conversationId, queryDto, false);
  }

  // --- Private Helpers ---

  private authenticateVisitor(req: Request): WidgetTokenPayload {
    const token = this.widgetTokenService.extractToken(
      req.headers as Record<string, string | string[] | undefined>,
      req.query as Record<string, string | string[] | undefined>,
    );

    return this.widgetTokenService.verifyToken(token);
  }

  private async resolveChannelByToken(token: string) {
    const client = this.prisma.getClient();

    // 1. Direct indexed match by providerAccountId or inboxId
    const directMatch = await client.channel.findFirst({
      where: {
        channelType: ChannelType.WEB_CHAT,
        OR: [{ providerAccountId: token }, { inboxId: token }],
      },
      include: {
        inbox: true,
      },
    });

    if (directMatch) return directMatch;

    // 2. Fallback for legacy channels where token was only embedded in credentials
    const webChatChannels = await client.channel.findMany({
      where: {
        channelType: ChannelType.WEB_CHAT,
        providerAccountId: null,
      },
      include: {
        inbox: true,
      },
      take: 50,
    });

    for (const chan of webChatChannels) {
      const creds = this.decryptCredentials(chan.credentials);
      const chanToken =
        (creds.widgetToken as string) ||
        (creds.website_token as string) ||
        (creds.token as string) ||
        chan.providerAccountId;

      if (chanToken === token) {
        return chan;
      }
    }

    return null;
  }

  private decryptCredentials(rawCredentials: unknown): Record<string, unknown> {
    if (!rawCredentials) return {};
    if (typeof rawCredentials === 'object' && rawCredentials !== null) {
      const credsObj = rawCredentials as Record<string, any>;
      if (credsObj.encrypted && typeof credsObj.encrypted === 'string') {
        try {
          return this.credentialService.decrypt(credsObj.encrypted);
        } catch {
          return {};
        }
      }
      return credsObj;
    } else if (typeof rawCredentials === 'string' && rawCredentials.includes(':')) {
      try {
        return this.credentialService.decrypt(rawCredentials);
      } catch {
        return {};
      }
    }
    return {};
  }
}
