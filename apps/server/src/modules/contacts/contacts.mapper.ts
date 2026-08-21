import type { ChannelIdentityDto, ContactDto } from '@sales-copilot/shared-contracts';

/**
 * Maps a raw Prisma ChannelIdentity record (with optional channel relation) to ChannelIdentityDto.
 */
export function mapIdentityToDto(identity: any): ChannelIdentityDto {
  return {
    id: identity.id,
    contactId: identity.contactId,
    workspaceId: identity.workspaceId,
    channelId: identity.channelId,
    channelType: identity.channel?.channelType,
    externalContactId: identity.externalContactId,
    username: identity.username ?? null,
    metadata:
      typeof identity.metadata === 'object' && identity.metadata !== null
        ? (identity.metadata as Record<string, unknown>)
        : {},
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
  };
}

/**
 * Maps a raw Prisma Contact record (with optional identities relation) to ContactDto.
 */
export function mapContactToDto(contact: any): ContactDto {
  return {
    id: contact.id,
    workspaceId: contact.workspaceId,
    name: contact.name,
    email: contact.email ?? null,
    phoneNumber: contact.phoneNumber ?? null,
    avatarUrl: contact.avatarUrl ?? null,
    identifier: contact.identifier ?? null,
    customAttributes:
      typeof contact.customAttributes === 'object' && contact.customAttributes !== null
        ? (contact.customAttributes as Record<string, unknown>)
        : {},
    additionalAttributes:
      typeof contact.additionalAttributes === 'object' && contact.additionalAttributes !== null
        ? (contact.additionalAttributes as Record<string, unknown>)
        : {},
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
    identities: Array.isArray(contact.identities)
      ? contact.identities.map(mapIdentityToDto)
      : undefined,
  };
}
