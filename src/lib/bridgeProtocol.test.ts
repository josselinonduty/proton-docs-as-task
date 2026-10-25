import { describe, expect, it } from 'vitest';
import {
  isBridgeRequest,
  isBridgeResponse,
  isEditorStateMessage,
  readDetail,
} from './bridgeProtocol';

describe('isEditorStateMessage', () => {
  it('accepts a state the bridge sends', () => {
    expect(isEditorStateMessage({ text: '#!tasks', editable: true, origin: 'initial' })).toBe(true);
    expect(isEditorStateMessage({ text: '', editable: false, origin: 'remote' })).toBe(true);
  });

  it.each([
    null,
    'text',
    [],
    {},
    { text: 1, editable: true, origin: 'local' },
    { text: '', editable: 'yes', origin: 'local' },
    { text: '', editable: true },
    { text: '', editable: true, origin: 'elsewhere' },
  ])('rejects %j', (data) => {
    expect(isEditorStateMessage(data)).toBe(false);
  });
});

describe('isBridgeRequest', () => {
  it('accepts hello and apply requests', () => {
    expect(isBridgeRequest({ id: 1, type: 'hello' })).toBe(true);
    expect(isBridgeRequest({ id: 2, type: 'apply', base: ['a'], target: ['a', 'b'] })).toBe(true);
    expect(isBridgeRequest({ id: 3, type: 'apply', base: [], target: [] })).toBe(true);
  });

  it.each([
    null,
    { type: 'hello' },
    { id: '1', type: 'hello' },
    { id: 1.5, type: 'hello' },
    { id: 1, type: 'reset' },
    { id: 1, type: 'apply', base: ['a'] },
    { id: 1, type: 'apply', base: 'a', target: ['a'] },
    { id: 1, type: 'apply', base: ['a'], target: ['a', 2] },
  ])('rejects %j', (data) => {
    expect(isBridgeRequest(data)).toBe(false);
  });
});

describe('isBridgeResponse', () => {
  it('accepts hello and apply results', () => {
    expect(isBridgeResponse({ id: 1, result: { ok: true } })).toBe(true);
    expect(isBridgeResponse({ id: 2, result: { ok: true, lines: ['a'] } })).toBe(true);
    expect(isBridgeResponse({ id: 3, result: { ok: false, reason: 'readonly' } })).toBe(true);
    expect(
      isBridgeResponse({ id: 4, result: { ok: false, reason: 'failed', message: 'boom' } }),
    ).toBe(true);
  });

  it.each([
    null,
    { id: 1 },
    { result: { ok: true } },
    { id: 1, result: null },
    { id: 1, result: { ok: 'true' } },
    { id: 1, result: { ok: true, lines: 'a' } },
    { id: 1, result: { ok: false } },
    { id: 1, result: { ok: false, reason: 'gone' } },
    { id: 1, result: { ok: false, reason: 'failed', message: 42 } },
  ])('rejects %j', (data) => {
    expect(isBridgeResponse(data)).toBe(false);
  });
});

describe('readDetail', () => {
  const event = (detail: unknown) => new CustomEvent('x', { detail });

  it('parses a JSON string payload', () => {
    expect(readDetail(event('{"id":1}'))).toEqual({ id: 1 });
  });

  it('drops anything that is not JSON text', () => {
    expect(readDetail(event('{not json'))).toBeUndefined();
    expect(readDetail(event({ id: 1 }))).toBeUndefined();
    expect(readDetail(new Event('x'))).toBeUndefined();
  });
});
