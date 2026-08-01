import { describe, it, expect } from 'vitest';
import { sanitizeChatText, escapeHtml, MAX_CHAT_LENGTH } from './sanitize.js';

describe('sanitizeChatText', () => {
  // The bug this replaced: the server HTML-escaped chat before storing it, and
  // the React client escaped it again on render, so "it's fine" reached the
  // screen as "it&#x27;s fine". Punctuation must survive the round trip.
  describe('does not mangle ordinary punctuation', () => {
    it.each([
      ["it's fine", "it's fine"],
      ['she said "hi"', 'she said "hi"'],
      ['a < b && c > d', 'a < b && c > d'],
      ['5 > 3 & 2 < 4', '5 > 3 & 2 < 4'],
      ["don't <blink> me", "don't <blink> me"],
      ['100% & rising', '100% & rising'],
    ])('%s survives verbatim', (input, expected) => {
      expect(sanitizeChatText(input)).toBe(expected);
    });

    it('never emits an HTML entity for plain text', () => {
      const out = sanitizeChatText(`it's a "test" of <tags> & things`);
      expect(out).not.toMatch(/&(amp|lt|gt|quot|#x27);/);
    });
  });

  describe('rejects non-strings', () => {
    it.each([[null], [undefined], [42], [{}], [[]], [true]])('%s -> empty', (input) => {
      expect(sanitizeChatText(input)).toBe('');
    });
  });

  describe('strips characters that are dangerous as data', () => {
    it('removes C0 control characters', () => {
      expect(sanitizeChatText('a\u0000b\u0007c')).toBe('abc');
    });

    it('removes C1 control characters', () => {
      expect(sanitizeChatText('a\u0085\u009Fb')).toBe('ab');
    });

    it('removes bidi overrides used to reorder displayed text', () => {
      expect(sanitizeChatText('safe\u202Etxet desrever')).toBe('safetxet desrever');
      expect(sanitizeChatText('\u2066iso\u2069late')).toBe('isolate');
    });

    it('removes zero-width and invisible padding', () => {
      expect(sanitizeChatText('he\u200Bll\u200Do\u2060!')).toBe('hello!');
      expect(sanitizeChatText('\uFEFFbom')).toBe('bom');
    });

    it('keeps ordinary unicode, including emoji and non-latin scripts', () => {
      expect(sanitizeChatText('héllo 👋 世界')).toBe('héllo 👋 世界');
    });
  });

  describe('normalises layout abuse', () => {
    it('collapses newlines to spaces so one message cannot span the panel', () => {
      expect(sanitizeChatText('line1\nline2\r\nline3')).toBe('line1 line2 line3');
    });

    it('collapses tabs', () => {
      expect(sanitizeChatText('a\t\tb')).toBe('a b');
    });

    it('collapses long space runs', () => {
      expect(sanitizeChatText('a' + ' '.repeat(80) + 'b')).toBe('a  b');
    });

    it('trims surrounding whitespace', () => {
      expect(sanitizeChatText('   padded   ')).toBe('padded');
    });
  });

  describe('length', () => {
    it(`truncates beyond ${MAX_CHAT_LENGTH} characters`, () => {
      const out = sanitizeChatText('x'.repeat(MAX_CHAT_LENGTH + 250));
      expect(out).toHaveLength(MAX_CHAT_LENGTH);
    });

    it('keeps a message exactly at the limit', () => {
      expect(sanitizeChatText('y'.repeat(MAX_CHAT_LENGTH))).toHaveLength(MAX_CHAT_LENGTH);
    });

    it('returns empty for whitespace-only input', () => {
      expect(sanitizeChatText('   \n\t  ')).toBe('');
      expect(sanitizeChatText('\u200B\u200B')).toBe('');
    });
  });
});

describe('escapeHtml', () => {
  // Retained for genuine HTML contexts, and still correct there.
  it('encodes the five significant characters', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#x27;');
  });

  it('escapes & first so entities are not double-encoded', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});
