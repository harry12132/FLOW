import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAdaptivePuzzle, PALETTE } from './game.js';

test('fast solves increase the next puzzle pair count', () => {
  const normal = generateAdaptivePuzzle(1, { rating: 50, fastStreak: 0 }, 12345, 'adaptive', 'balanced');
  const fast = generateAdaptivePuzzle(1, { rating: 50, fastStreak: 1 }, 12345, 'adaptive', 'balanced');
  assert.equal(normal.size, 5);
  assert.equal(fast.size, 5);
  assert.equal(fast.segments.length, normal.segments.length + 1);
});

test('two consecutive fast solves increase the next grid size', () => {
  const normal = generateAdaptivePuzzle(1, { rating: 50, fastStreak: 0 }, 12345, 'adaptive', 'balanced');
  const fast = generateAdaptivePuzzle(1, { rating: 50, fastStreak: 2 }, 12345, 'adaptive', 'balanced');
  assert.equal(normal.size, 5);
  assert.equal(fast.size, 6);
});

test('all eight endpoint colours are unique and named', () => {
  assert.equal(PALETTE.length, 8);
  assert.equal(new Set(PALETTE.map(({ value }) => value.toLowerCase())).size, 8);
  assert.equal(new Set(PALETTE.map(({ name }) => name)).size, 8);
  assert.ok(PALETTE.every(({ value }) => /^#[0-9a-f]{6}$/i.test(value)));
});
