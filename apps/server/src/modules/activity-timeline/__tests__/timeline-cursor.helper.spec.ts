import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { TimelineEventType, type TimelineEventDto } from '@sales-copilot/shared-contracts';
import {
  compareTimelineEvents,
  decodeCursor,
  encodeCursor,
  isEventOlderThanCursor,
} from '../timeline-cursor.helper';

describe('TimelineCursorHelper', () => {
  describe('encodeCursor & decodeCursor', () => {
    it('should encode and decode a valid timestamp and id round-trip', () => {
      const now = new Date('2026-09-06T10:00:00.000Z');
      const id = 'msg_12345';

      const encoded = encodeCursor(now, id);
      assert.ok(typeof encoded === 'string');
      assert.ok(encoded.length > 0);

      const decoded = decodeCursor(encoded);
      assert.ok(decoded);
      assert.strictEqual(decoded.id, id);
      assert.strictEqual(decoded.timestamp.toISOString(), now.toISOString());
    });

    it('should return null for malformed or non-base64 cursor', () => {
      assert.strictEqual(decodeCursor(null), null);
      assert.strictEqual(decodeCursor(''), null);
      assert.strictEqual(decodeCursor('not-valid-base64-json'), null);
      assert.strictEqual(decodeCursor(Buffer.from('{"invalid":1}').toString('base64url')), null);
    });
  });

  describe('compareTimelineEvents', () => {
    it('should sort events in reverse chronological order (newest first)', () => {
      const older: TimelineEventDto = {
        id: '1',
        type: TimelineEventType.MESSAGE,
        timestamp: '2026-09-01T10:00:00.000Z',
        actor: { id: 'u1', name: 'User', type: 'USER' },
        summary: 'Older',
        payload: {},
      };
      const newer: TimelineEventDto = {
        id: '2',
        type: TimelineEventType.NOTE,
        timestamp: '2026-09-01T10:30:00.000Z',
        actor: { id: 'u1', name: 'User', type: 'USER' },
        summary: 'Newer',
        payload: {},
      };

      const sorted = [older, newer].sort(compareTimelineEvents);
      assert.strictEqual(sorted[0].id, '2');
      assert.strictEqual(sorted[1].id, '1');
    });

    it('should tie-break by ID descending when timestamps are identical', () => {
      const eventA: TimelineEventDto = {
        id: 'aaa',
        type: TimelineEventType.MESSAGE,
        timestamp: '2026-09-01T10:00:00.000Z',
        actor: { id: 'u1', name: 'User', type: 'USER' },
        summary: 'A',
        payload: {},
      };
      const eventB: TimelineEventDto = {
        id: 'bbb',
        type: TimelineEventType.SALES_EVIDENCE,
        timestamp: '2026-09-01T10:00:00.000Z',
        actor: { id: 'sys', name: 'AI', type: 'SYSTEM' },
        summary: 'B',
        payload: {},
      };

      const sorted = [eventA, eventB].sort(compareTimelineEvents);
      // 'bbb'.localeCompare('aaa') > 0 so bbb comes first
      assert.strictEqual(sorted[0].id, 'bbb');
      assert.strictEqual(sorted[1].id, 'aaa');
    });
  });

  describe('isEventOlderThanCursor', () => {
    const cursor = {
      timestamp: new Date('2026-09-01T10:15:00.000Z'),
      id: 'item_mid',
    };

    it('should return true for events older than the cursor', () => {
      const olderEvent: TimelineEventDto = {
        id: 'item_old',
        type: TimelineEventType.MESSAGE,
        timestamp: '2026-09-01T10:00:00.000Z',
        actor: { id: 'c1', name: 'Cust', type: 'CONTACT' },
        summary: 'Old',
        payload: {},
      };
      assert.strictEqual(isEventOlderThanCursor(olderEvent, cursor), true);
    });

    it('should return false for events newer than the cursor', () => {
      const newerEvent: TimelineEventDto = {
        id: 'item_new',
        type: TimelineEventType.MESSAGE,
        timestamp: '2026-09-01T10:30:00.000Z',
        actor: { id: 'c1', name: 'Cust', type: 'CONTACT' },
        summary: 'New',
        payload: {},
      };
      assert.strictEqual(isEventOlderThanCursor(newerEvent, cursor), false);
    });
  });
});
