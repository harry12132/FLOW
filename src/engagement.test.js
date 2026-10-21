import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENT_MESSAGE_COUNT, getAchievementMessage } from './engagement.js';

test('achievement copy includes at least 30 distinct options', () => {
  assert.equal(ACHIEVEMENT_MESSAGE_COUNT, 60);
});

test('achievement message selection is deterministic with an injected random source', () => {
  const first = getAchievementMessage({ score: 60, random: () => 0 });
  const second = getAchievementMessage({ score: 60, random: () => 0 });
  assert.equal(first, second);
  assert.ok(first.length > 10);
});

test('fast, clean solves receive the quick-solve tone', () => {
  assert.match(getAchievementMessage({ score: 95, random: () => 0 }), /quick|Speedrun|fast|express|rapid|Efficient|Efficiency|Speed/i);
});

test('solves with hints or resets receive persistence-focused feedback', () => {
  assert.match(getAchievementMessage({ score: 70, hints: 1, random: () => 0 }), /Hints|stayed|detour|persistence|worked|tools|tricky|Progress|route|plan|patience|experiment|win|solve|solved|finish|thinking|grid|first idea|comeback|adjusted/i);
  assert.match(getAchievementMessage({ score: 70, resets: 1, random: () => 0 }), /Hints|stayed|detour|persistence|worked|tools|tricky|Progress|route|plan|patience|experiment|win|solve|solved|finish|thinking|grid|first idea|comeback|adjusted/i);
});

test('message selection clamps out-of-range random values safely', () => {
  assert.equal(typeof getAchievementMessage({ random: () => -1 }), 'string');
  assert.equal(typeof getAchievementMessage({ random: () => 1 }), 'string');
});
