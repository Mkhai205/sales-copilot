import sanitizeHtml from 'sanitize-html';

/**
 * Permitted HTML formatting and structural tags for message content.
 */
export const ALLOWED_MESSAGE_TAGS = [
  'b',
  'i',
  'em',
  'strong',
  'a',
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'span',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'u',
  's',
  'strike',
  'del',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
];

/**
 * Permitted attributes per tag for message content.
 */
export const ALLOWED_MESSAGE_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'name', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  '*': ['class'],
};

/**
 * Permitted URL schemes for links and image sources.
 * Strictly disallows dangerous protocols like javascript:, data:, vbscript:.
 */
export const ALLOWED_MESSAGE_SCHEMES = ['http', 'https', 'mailto', 'tel'];

/**
 * Sanitizes rich text / HTML message content to prevent Cross-Site Scripting (XSS).
 *
 * Stricly strips:
 * - <script>, <iframe>, <object>, <embed>, <svg>, <form>, etc.
 * - All inline event handlers (onclick, onerror, onload, onmouseover, etc.)
 * - Dangerous URI schemes (javascript:..., data:...)
 *
 * Preserves safe formatting (<b>, <i>, <code>, <a>, <p>, <ul>, <img>) and hardens
 * target="_blank" links with rel="noopener noreferrer".
 *
 * @param content - Raw message content from user or inbound webhook
 * @returns Clean, safe HTML string
 */
export function sanitizeMessageContent(content: string | null | undefined): string {
  if (!content) {
    return '';
  }

  return sanitizeHtml(content, {
    allowedTags: ALLOWED_MESSAGE_TAGS,
    allowedAttributes: ALLOWED_MESSAGE_ATTRIBUTES,
    allowedSchemes: ALLOWED_MESSAGE_SCHEMES,
    transformTags: {
      a: (tagName, attribs) => {
        const newAttribs = { ...attribs };
        if (newAttribs.target === '_blank') {
          newAttribs.rel = 'noopener noreferrer';
        }
        return {
          tagName,
          attribs: newAttribs,
        };
      },
    },
  });
}
