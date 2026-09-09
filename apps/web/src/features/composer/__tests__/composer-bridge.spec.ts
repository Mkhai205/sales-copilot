import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  insertIntoComposer,
  COPILOT_INSERT_EVENT,
  type InsertComposerPayload,
} from '../composer-bridge';

describe('Composer Bridge & Copilot Custom Event Dispatcher', () => {
  it('should define correct event name', () => {
    assert.strictEqual(COPILOT_INSERT_EVENT, 'copilot:insert-composer');
  });

  it('should dispatch custom event when window is defined', () => {
    let capturedEvent: any = null;

    // Mock window and dispatchEvent
    const originalWindow = (global as any).window;
    const originalCustomEvent = (global as any).CustomEvent;

    (global as any).CustomEvent = class MockCustomEvent {
      constructor(
        public type: string,
        public options: any,
      ) {
        this.detail = options?.detail;
      }
      detail: any;
    };

    (global as any).window = {
      dispatchEvent: (event: any) => {
        capturedEvent = event;
      },
    };

    try {
      const payload: InsertComposerPayload = {
        conversationId: 'conv-test-123',
        text: 'Xin chào, đây là bản thảo đề xuất từ AI Copilot.',
        mode: 'append',
      };

      insertIntoComposer(payload);

      assert.ok(capturedEvent);
      assert.strictEqual(capturedEvent.type, COPILOT_INSERT_EVENT);
      assert.strictEqual(capturedEvent.detail.conversationId, 'conv-test-123');
      assert.strictEqual(
        capturedEvent.detail.text,
        'Xin chào, đây là bản thảo đề xuất từ AI Copilot.',
      );
      assert.strictEqual(capturedEvent.detail.mode, 'append');
    } finally {
      (global as any).window = originalWindow;
      (global as any).CustomEvent = originalCustomEvent;
    }
  });

  it('should dispatch custom event with replace mode', () => {
    let capturedEvent: any = null;

    const originalWindow = (global as any).window;
    const originalCustomEvent = (global as any).CustomEvent;

    (global as any).CustomEvent = class MockCustomEvent {
      constructor(
        public type: string,
        public options: any,
      ) {
        this.detail = options?.detail;
      }
      detail: any;
    };

    (global as any).window = {
      dispatchEvent: (event: any) => {
        capturedEvent = event;
      },
    };

    try {
      const payload: InsertComposerPayload = {
        conversationId: 'conv-test-456',
        text: 'Nội dung thay thế hoàn toàn',
        mode: 'replace',
      };

      insertIntoComposer(payload);

      assert.ok(capturedEvent);
      assert.strictEqual(capturedEvent.detail.mode, 'replace');
      assert.strictEqual(capturedEvent.detail.text, 'Nội dung thay thế hoàn toàn');
    } finally {
      (global as any).window = originalWindow;
      (global as any).CustomEvent = originalCustomEvent;
    }
  });

  it('should not throw when window is undefined (SSR safety)', () => {
    const originalWindow = (global as any).window;
    delete (global as any).window;

    try {
      assert.doesNotThrow(() => {
        insertIntoComposer({
          conversationId: 'conv-test-789',
          text: 'SSR text',
        });
      });
    } finally {
      (global as any).window = originalWindow;
    }
  });
});
