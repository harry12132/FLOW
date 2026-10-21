import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeHint, HINT_LIMIT, HINT_STORAGE_KEY, HINT_WINDOW_MS, readHintUsage } from './hints.js';

function memoryStorage(value = null) {
  return { getItem: () => value };
}

test('first and second hints do not start the cooldown', () => {
  assert.deepEqual(consumeHint({ used: 0, exhaustedAt: 0 }, 1000), { used: 1, exhaustedAt: 0 });
  assert.deepEqual(consumeHint({ used: 1, exhaustedAt: 0 }, 2000), { used: 2, exhaustedAt: 0 });
});

test('the ten-minute cooldown starts when the third hint is used', () => {
  assert.deepEqual(consumeHint({ used: 2, exhaustedAt: 0 }, 9000), { used: HINT_LIMIT, exhaustedAt: 9000 });
});

test('all hints return after ten minutes from the third hint', () => {
  const value = JSON.stringify({ used: 3, exhaustedAt: 9000 });
  assert.deepEqual(readHintUsage(9000 + HINT_WINDOW_MS - 1, memoryStorage(value)), { used: 3, exhaustedAt: 9000 });
  assert.deepEqual(readHintUsage(9000 + HINT_WINDOW_MS, memoryStorage(value)), { used: 0, exhaustedAt: 0 });
});

test('using a hint after cooldown begins a new three-hint allowance', () => {
  assert.deepEqual(consumeHint({ used: 3, exhaustedAt: 1000 }, 1000 + HINT_WINDOW_MS), { used: 1, exhaustedAt: 0 });
});

test('malformed saved data safely resets the hint allowance', () => {
  assert.deepEqual(readHintUsage(2000, memoryStorage('{broken')), { used: 0, exhaustedAt: 0 });
  assert.equal(HINT_STORAGE_KEY, 'flow-hint-window-v1');
});
