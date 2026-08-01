/**
 * Text sanitisation for user-supplied chat messages.
 *
 * The server used to HTML-escape chat text before storing it. That was wrong
 * for this transport: messages leave as JSON and the only consumer renders
 * them through React, which escapes text nodes itself. Escaping twice meant a
 * message typed as `it's fine` reached the screen as `it&#x27;s fine` — an
 * apostrophe is enough to trigger it, so most real sentences were mangled.
 *
 * The right split: strip characters that are dangerous *as data* (control
 * codes, bidi overrides, zero-width joiners used for spoofing), and leave
 * escaping to whoever renders. Anything rendering this as raw HTML must
 * escape at that point — see `escapeHtml`, kept for exactly that case.
 */

export const MAX_CHAT_LENGTH = 500;

// C0/C1 control characters. \t \r \n are handled separately below.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

// Unicode bidirectional overrides. These visually reorder text ("trojan
// source"), so a message can read differently than it is stored.
const BIDI_OVERRIDES = /[\u202A-\u202E\u2066-\u2069]/g;

// Zero-width and invisible formatting characters used to pad or hide content.
const INVISIBLES = /[\u200B-\u200D\u2060\uFEFF]/g;

/**
 * Normalise a chat message. Returns '' for anything empty once cleaned, which
 * callers treat as "drop this message".
 */
export function sanitizeChatText(input: unknown): string {
  if (typeof input !== 'string') return '';

  let text = input
    .replace(CONTROL_CHARS, '')
    .replace(BIDI_OVERRIDES, '')
    .replace(INVISIBLES, '');

  // Chat is single-line; a message full of newlines would otherwise stretch
  // every connected client's message list.
  text = text.replace(/[\t\r\n]+/g, ' ');

  // Collapse long whitespace runs used to shove other messages off screen.
  text = text.replace(/ {3,}/g, '  ');

  text = text.trim();
  if (text.length > MAX_CHAT_LENGTH) {
    text = text.slice(0, MAX_CHAT_LENGTH).trim();
  }

  return text;
}

/**
 * HTML entity encoder. No longer applied to stored chat text — kept for any
 * consumer that needs to inject a string into an HTML context directly.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
