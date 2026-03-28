import { describe, it, expect } from 'vitest';
import {
  isWelcomePayload,
  isVisitorEventPayload,
  isVisitorsListPayload,
  isChatHistoryPayload,
  isChatMessagePayload,
} from './useVisitors';

describe('WebSocket payload type guards', () => {
  describe('isWelcomePayload', () => {
    it('returns true for valid welcome payload', () => {
      const payload = {
        visitor: { id: 'v_1', geo: null, connectedAt: 0, userAgent: '' },
        visitors: [],
      };
      expect(isWelcomePayload(payload)).toBe(true);
    });

    it('rejects null', () => {
      expect(isWelcomePayload(null)).toBe(false);
    });

    it('rejects payload missing visitor field', () => {
      expect(isWelcomePayload({ visitors: [] })).toBe(false);
    });

    it('rejects payload with non-array visitors', () => {
      expect(isWelcomePayload({ visitor: {}, visitors: 'bad' })).toBe(false);
    });

    it('rejects malformed WebSocket message that would have caused undefined access without guard', () => {
      // Before the fix, `(message.payload as WelcomePayload).visitor.id` would throw
      const malformed = { notVisitor: true };
      expect(isWelcomePayload(malformed)).toBe(false);
    });
  });

  describe('isVisitorEventPayload', () => {
    it('returns true for valid visitor event payload', () => {
      expect(isVisitorEventPayload({ visitor: { id: 'v_1' } })).toBe(true);
    });

    it('rejects missing visitor field', () => {
      expect(isVisitorEventPayload({ notVisitor: true })).toBe(false);
    });

    it('rejects non-object', () => {
      expect(isVisitorEventPayload('string')).toBe(false);
    });
  });

  describe('isVisitorsListPayload', () => {
    it('returns true for valid list payload', () => {
      expect(isVisitorsListPayload({ visitors: [] })).toBe(true);
    });

    it('rejects non-array visitors', () => {
      expect(isVisitorsListPayload({ visitors: {} })).toBe(false);
    });
  });

  describe('isChatHistoryPayload', () => {
    it('returns true for valid chat history payload', () => {
      expect(isChatHistoryPayload({ messages: [] })).toBe(true);
    });

    it('rejects missing messages field', () => {
      expect(isChatHistoryPayload({ text: 'hello' })).toBe(false);
    });
  });

  describe('isChatMessagePayload', () => {
    it('returns true for valid chat message', () => {
      expect(isChatMessagePayload({ text: 'hello', timestamp: 0 })).toBe(true);
    });

    it('rejects payload with non-string text', () => {
      expect(isChatMessagePayload({ text: 42, timestamp: 0 })).toBe(false);
    });

    it('rejects null', () => {
      expect(isChatMessagePayload(null)).toBe(false);
    });
  });
});
