import type { TimelineEventDto } from '@sales-copilot/shared-contracts';

export interface DecodedCursor {
  timestamp: Date;
  id: string;
}

/**
 * Encodes a composite cursor (ISO 8601 timestamp + entity UUID) into a URL-safe Base64 string.
 */
export function encodeCursor(timestamp: Date | string, id: string): string {
  const isoTime =
    timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString();
  const payload = JSON.stringify({ t: isoTime, i: id });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

/**
 * Decodes a URL-safe Base64 cursor string back into { timestamp, id }.
 * Returns null if the cursor is malformed.
 */
export function decodeCursor(cursor?: string | null): DecodedCursor | null {
  if (!cursor || typeof cursor !== 'string') {
    return null;
  }

  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed.t !== 'string' || typeof parsed.i !== 'string') {
      return null;
    }

    const timestamp = new Date(parsed.t);
    if (isNaN(timestamp.getTime())) {
      return null;
    }

    return {
      timestamp,
      id: parsed.i,
    };
  } catch {
    return null;
  }
}

/**
 * Compares two TimelineEventDto items in reverse chronological order (newest first).
 * Tie-breaker: entity ID comparison ensures deterministic pagination.
 */
export function compareTimelineEvents(a: TimelineEventDto, b: TimelineEventDto): number {
  const timeA = new Date(a.timestamp).getTime();
  const timeB = new Date(b.timestamp).getTime();

  if (timeA !== timeB) {
    return timeB - timeA; // Descending (newer events first)
  }

  // Tie-breaker on UUID string comparison descending
  return b.id.localeCompare(a.id);
}

/**
 * Checks if a candidate event occurred strictly AFTER the cursor position
 * in a reverse-chronological stream (i.e. event is older than the cursor).
 */
export function isEventOlderThanCursor(event: TimelineEventDto, cursor: DecodedCursor): boolean {
  const eventTime = new Date(event.timestamp).getTime();
  const cursorTime = cursor.timestamp.getTime();

  if (eventTime < cursorTime) {
    return true;
  }

  if (eventTime === cursorTime) {
    // If same millisecond, the event's ID must be alphabetically smaller than cursor.id
    return event.id.localeCompare(cursor.id) < 0;
  }

  return false;
}
