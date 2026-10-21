import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeHint, HINT_LIMIT, HINT_STORAGE_KEY, HINT_WINDOW_MS, readHintUsage } from './hints.js';

function memoryStorage(value = null) {
  return { getItem: () => value };
}

test('first hint starts a ten-minute window', () => {
  assert.deepEqual(consumeHint({ used: 0, startedAt: 0 }, 1000), { used: 1, startedAt: 1000 });
});

test('hint usage increments to a maximum of three', () => {
  const usage = { used: 2, startedAt: 1000 };
  assert.deepEqual(consumeHint(usage, 2000), { used: HINT_LIMIT, startedAt: 1000 });
});

test('hint usage resets after ten minutes and starts a fresh window', () => {
  assert.deepEqual(consumeHint({ used: 3, startedAt: 1000 }, 1000 + HINT_WINDOW_MS), { used: 1, startedAt: 1000 + HINT_WINDOW_MS });
});

test('stored hint usage expires after ten minutes', () => {
  const value = JSON.stringify({ used: 3, startedAt: 1000 });
  assert.deepEqual(readHintUsage(1000 + HINT_WINDOW_MS, memoryStorage(value)), { used: 0, startedAt: 0 });
});

test('malformed saved data safely resets the hint window', () => {
  assert.deepEqual(readHintUsage(2000, memoryStorage('{broken')), { used: 0, startedAt: 0 });
  assert.equal(HINT_STORAGE_KEY, 'flow-hint-window-v1');
});
