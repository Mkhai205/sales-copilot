import { WidgetConfigResponse, WidgetContactResponse, WidgetMessage } from './types';

/**
 * REST API client for Sales Copilot Web Chat widget endpoints.
 */
export class WidgetApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (
      baseUrl || (typeof window !== 'undefined' ? window.location.origin : '')
    ).replace(/\/+$/, '');
  }

  /**
   * Fetches public widget customization settings.
   */
  async getConfig(websiteToken: string): Promise<WidgetConfigResponse> {
    const url = `${this.baseUrl}/api/v1/widget/config?website_token=${encodeURIComponent(websiteToken)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to load widget config: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return (data.data || data) as WidgetConfigResponse;
  }

  /**
   * Creates or resolves a visitor session, returning contact details and a Contact JWT.
   */
  async getOrCreateContact(params: {
    websiteToken: string;
    contactToken?: string;
    identifier?: string;
    name?: string;
    email?: string;
    phoneNumber?: string;
    avatarUrl?: string;
    customAttributes?: Record<string, unknown>;
  }): Promise<WidgetContactResponse> {
    const url = `${this.baseUrl}/api/v1/widget/contact`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      throw new Error(`Failed to initialize visitor contact: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return (data.data || data) as WidgetContactResponse;
  }

  /**
   * Fetches conversation history for the authenticated visitor.
   */
  async getConversations(contactJwt: string): Promise<{ items: any[]; meta: any }> {
    const url = `${this.baseUrl}/api/v1/widget/conversations`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${contactJwt}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch conversations: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return (data.data || data) as { items: any[]; meta: any };
  }

  /**
   * Retrieves messages for a specific conversation belonging to the visitor.
   */
  async getMessages(
    conversationId: string,
    contactJwt: string,
    query?: { page?: number; limit?: number; beforeId?: string; afterId?: string },
  ): Promise<{ items: WidgetMessage[]; meta: any }> {
    const searchParams = new URLSearchParams();
    if (query?.page) searchParams.set('page', String(query.page));
    if (query?.limit) searchParams.set('limit', String(query.limit));
    if (query?.beforeId) searchParams.set('beforeId', query.beforeId);
    if (query?.afterId) searchParams.set('afterId', query.afterId);

    const qs = searchParams.toString();
    const url = `${this.baseUrl}/api/v1/widget/conversations/${encodeURIComponent(conversationId)}/messages${
      qs ? `?${qs}` : ''
    }`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${contactJwt}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch messages: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return (data.data || data) as { items: WidgetMessage[]; meta: any };
  }
}
