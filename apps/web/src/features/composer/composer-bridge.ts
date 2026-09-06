export interface InsertComposerPayload {
  conversationId: string;
  text: string;
  mode?: 'append' | 'replace';
}

export const COPILOT_INSERT_EVENT = 'copilot:insert-composer';

/**
 * Dispatches an event to inject text into the active ChatComposer
 * without clearing existing attachments.
 */
export function insertIntoComposer(payload: InsertComposerPayload): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<InsertComposerPayload>(COPILOT_INSERT_EVENT, {
        detail: payload,
      }),
    );
  }
}
