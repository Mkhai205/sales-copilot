import { buildQueryString, fetchApi, workspaceHeaders } from './client';
import type {
  ChannelIdentityDto,
  ContactDto,
  ContactListQueryDto,
  ContactSearchQueryDto,
  CreateChannelIdentityDto,
  CreateContactDto,
  MergeContactsDto,
  UpdateContactDto,
} from '@sales-copilot/shared-contracts';

export const contactsApi = {
  list: (workspaceId: string, query?: ContactListQueryDto) =>
    fetchApi<ContactDto[]>(`/contacts${buildQueryString(query)}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  search: (workspaceId: string, query: ContactSearchQueryDto) =>
    fetchApi<ContactDto[]>(`/contacts/search${buildQueryString(query)}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  get: (workspaceId: string, id: string) =>
    fetchApi<ContactDto>(`/contacts/${id}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  create: (workspaceId: string, dto: CreateContactDto) =>
    fetchApi<ContactDto>('/contacts', {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  update: (workspaceId: string, id: string, dto: UpdateContactDto) =>
    fetchApi<ContactDto>(`/contacts/${id}`, {
      method: 'PATCH',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  delete: (workspaceId: string, id: string) =>
    fetchApi<{ success: boolean }>(`/contacts/${id}`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
    }),

  merge: (workspaceId: string, dto: MergeContactsDto) =>
    fetchApi<ContactDto>('/contacts/merge', {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  listIdentities: (workspaceId: string, contactId: string) =>
    fetchApi<ChannelIdentityDto[]>(`/contacts/${contactId}/identities`, {
      headers: workspaceHeaders(workspaceId),
    }),

  linkIdentity: (workspaceId: string, contactId: string, dto: CreateChannelIdentityDto) =>
    fetchApi<ChannelIdentityDto>(`/contacts/${contactId}/identities`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  unlinkIdentity: (workspaceId: string, contactId: string, identityId: string) =>
    fetchApi<{ success: boolean }>(`/contacts/${contactId}/identities/${identityId}`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
    }),
};
