import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ChannelIdentityDto,
  ContactDto,
  ContactListQueryDto,
  contactListQuerySchema,
  ContactSearchQueryDto,
  contactSearchQuerySchema,
  CreateChannelIdentityDto,
  createChannelIdentitySchema,
  CreateContactDto,
  createContactSchema,
  MergeContactsDto,
  mergeContactsSchema,
  PaginationMeta,
  UpdateContactDto,
  updateContactSchema,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { ZodBody, ZodQuery } from '../../common/pipes';
import { CurrentUser, type JwtUserPayload } from '../auth';
import { CurrentWorkspace, Roles } from '../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../workspaces/guards';
import type { WorkspaceContext } from '../workspaces/types/workspace-context.type';
import { ContactsService } from './contacts.service';
import { ChannelIdentityService } from './channel-identity.service';
import { ContactMergeService } from './contact-merge.service';

@ApiTags('Contacts')
@Controller('contacts')
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: true,
  description: 'Target Workspace UUID for tenant resolution',
})
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly channelIdentityService: ChannelIdentityService,
    private readonly contactMergeService: ContactMergeService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({
    summary: 'List contacts in the workspace with pagination, filtering, and sorting',
  })
  @ApiResponse({ status: 200, description: 'Contacts list retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Missing or invalid parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listContacts(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodQuery(contactListQuerySchema) query: ContactListQueryDto,
  ): Promise<{ items: ContactDto[]; meta: PaginationMeta }> {
    return this.contactsService.findAll(context.workspaceId, query);
  }

  @Get('search')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Search contacts across name, email, phone, and identifier' })
  @ApiResponse({ status: 200, description: 'Matching contacts retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid search query' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async searchContacts(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodQuery(contactSearchQuerySchema) query: ContactSearchQueryDto,
  ): Promise<{ items: ContactDto[]; meta: PaginationMeta }> {
    return this.contactsService.search(context.workspaceId, query);
  }

  @Post('merge')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Atomically merge two contacts within the workspace' })
  @ApiResponse({ status: 200, description: 'Contacts merged successfully, returns base contact' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or cross-workspace merge prohibited',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Only ADMIN and OWNER can merge contacts' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async mergeContacts(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @ZodBody(mergeContactsSchema) dto: MergeContactsDto,
  ): Promise<ContactDto> {
    return this.contactMergeService.merge(
      context.workspaceId,
      dto.baseContactId,
      dto.mergeeContactId,
      { performedByUserId: user?.userId },
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Create a new contact in the workspace' })
  @ApiResponse({ status: 201, description: 'Contact created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Identifier or Email already exists in workspace' })
  async createContact(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodBody(createContactSchema) dto: CreateContactDto,
  ): Promise<ContactDto> {
    return this.contactsService.create(context.workspaceId, dto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get contact details and identities by ID' })
  @ApiResponse({ status: 200, description: 'Contact details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async getContact(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') contactId: string,
  ): Promise<ContactDto> {
    return this.contactsService.findById(context.workspaceId, contactId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Update contact details and custom attributes' })
  @ApiResponse({ status: 200, description: 'Contact updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiResponse({ status: 409, description: 'Identifier or Email collision in workspace' })
  async updateContact(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') contactId: string,
    @ZodBody(updateContactSchema) dto: UpdateContactDto,
  ): Promise<ContactDto> {
    return this.contactsService.update(context.workspaceId, contactId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Delete a contact from the workspace' })
  @ApiResponse({ status: 200, description: 'Contact deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async deleteContact(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') contactId: string,
  ): Promise<{ success: boolean }> {
    return this.contactsService.delete(context.workspaceId, contactId);
  }

  // ---------------------------------------------------------------------------
  // Nested Channel Identities Endpoints (Feature F-1.2.2)
  // ---------------------------------------------------------------------------

  @Get(':contactId/identities')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'List all channel identities linked to a specific contact' })
  @ApiResponse({ status: 200, description: 'Channel identities retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async listContactIdentities(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('contactId') contactId: string,
  ): Promise<ChannelIdentityDto[]> {
    return this.channelIdentityService.findByContactId(context.workspaceId, contactId);
  }

  @Post(':contactId/identities')
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Link a new channel identity to a contact' })
  @ApiResponse({ status: 201, description: 'Channel identity linked successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Contact or Channel not found' })
  @ApiResponse({ status: 409, description: 'Channel identity already linked to another contact' })
  async linkContactIdentity(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('contactId') contactId: string,
    @ZodBody(createChannelIdentitySchema) dto: CreateChannelIdentityDto,
  ): Promise<ChannelIdentityDto> {
    return this.channelIdentityService.createForContact(context.workspaceId, contactId, dto);
  }

  @Delete(':contactId/identities/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Unlink a channel identity from a contact' })
  @ApiResponse({ status: 200, description: 'Channel identity unlinked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Contact or Channel identity not found' })
  async unlinkContactIdentity(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('contactId') contactId: string,
    @Param('id') identityId: string,
  ): Promise<{ success: boolean }> {
    return this.channelIdentityService.delete(context.workspaceId, contactId, identityId);
  }
}
