import test from 'node:test';
import assert from 'node:assert/strict';
import { getVictoryHeadline, VICTORY_HEADLINE_COUNT } from './victory.js';

test('there are at least 20 varied victory headlines', () => {
  assert.equal(VICTORY_HEADLINE_COUNT, 21);
});

test('victory headline selection can be deterministic', () => {
  assert.equal(getVictoryHeadline(1, () => 0), 'Incredible!');
  assert.equal(getVictoryHeadline(1, () => 0.99), 'Big brain energy!');
});
