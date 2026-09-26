import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert';
import { isEditableEventTarget } from '../dom-utils';

class MockHTMLElement {
  tagName: string;
  isContentEditable: boolean;
  attributes: Record<string, string>;
  parentElement: MockHTMLElement | null;

  constructor(options: {
    tagName: string;
    isContentEditable?: boolean;
    attributes?: Record<string, string>;
    parentElement?: MockHTMLElement | null;
  }) {
    this.tagName = options.tagName;
    this.isContentEditable = Boolean(options.isContentEditable);
    this.attributes = options.attributes || {};
    this.parentElement = options.parentElement || null;
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  closest(selector: string): MockHTMLElement | null {
    if (selector === '[contenteditable=true]') {
      if (this.isContentEditable || this.attributes['contenteditable'] === 'true') {
        return this;
      }
      return this.parentElement ? this.parentElement.closest(selector) : null;
    }
    return null;
  }
}

describe('DOM Utilities (dom-utils.spec.ts)', () => {
  const originalHTMLElement = globalThis.HTMLElement;

  before(() => {
    (globalThis as any).HTMLElement = MockHTMLElement;
  });

  after(() => {
    (globalThis as any).HTMLElement = originalHTMLElement;
  });

  it('should return false for null, undefined, or non-HTMLElement targets', () => {
    assert.strictEqual(isEditableEventTarget(null), false);
    assert.strictEqual(isEditableEventTarget(undefined as any), false);
    assert.strictEqual(isEditableEventTarget({} as any), false);
    assert.strictEqual(isEditableEventTarget('not-an-element' as any), false);
  });

  it('should return true for input, textarea, and select elements', () => {
    const input = new MockHTMLElement({ tagName: 'input' });
    const textarea = new MockHTMLElement({ tagName: 'TEXTAREA' });
    const select = new MockHTMLElement({ tagName: 'select' });

    assert.strictEqual(isEditableEventTarget(input as any), true);
    assert.strictEqual(isEditableEventTarget(textarea as any), true);
    assert.strictEqual(isEditableEventTarget(select as any), true);
  });

  it('should return true when isContentEditable is true', () => {
    const div = new MockHTMLElement({ tagName: 'div', isContentEditable: true });
    assert.strictEqual(isEditableEventTarget(div as any), true);
  });

  it('should return true when role is textbox', () => {
    const div = new MockHTMLElement({
      tagName: 'div',
      attributes: { role: 'textbox' },
    });
    assert.strictEqual(isEditableEventTarget(div as any), true);
  });

  it('should return true when element is nested inside a contenteditable parent', () => {
    const parent = new MockHTMLElement({
      tagName: 'div',
      isContentEditable: true,
      attributes: { contenteditable: 'true' },
    });
    const childSpan = new MockHTMLElement({
      tagName: 'span',
      parentElement: parent,
    });

    assert.strictEqual(isEditableEventTarget(childSpan as any), true);
  });

  it('should return false for standard non-editable elements', () => {
    const div = new MockHTMLElement({ tagName: 'div' });
    const span = new MockHTMLElement({ tagName: 'span' });
    const button = new MockHTMLElement({ tagName: 'button' });

    assert.strictEqual(isEditableEventTarget(div as any), false);
    assert.strictEqual(isEditableEventTarget(span as any), false);
    assert.strictEqual(isEditableEventTarget(button as any), false);
  });
});
