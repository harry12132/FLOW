import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePuzzle, generateAdaptivePuzzle, validatePuzzle, estimatePuzzleDifficulty, analyzePuzzleAmbiguity, scorePuzzlePerformance } from '../src/game.js';
import { appendAnalyticsEvent, analyticsSummary, choosePuzzleVariant, recordVariantReward, ratingUncertainty } from '../src/analytics.js';

test('adaptive generator creates valid full-board puzzles across levels and ratings', () => {
  for (const level of [1, 18, 41, 80]) {
    for (const rating of [10, 50, 95]) {
      const puzzle = generateAdaptivePuzzle(level, { rating }, level * 100 + rating, 'adaptive', 'balanced');
      assert.ok(validatePuzzle(puzzle), `invalid puzzle at level ${level}, rating ${rating}`);
      assert.ok(puzzle.size >= 5 && puzzle.size <= 8);
      assert.ok(puzzle.difficulty.score >= 0 && puzzle.difficulty.score <= 100);
      assert.ok(Number.isFinite(puzzle.difficulty.target));
      assert.equal(puzzle.segments.reduce((sum, segment) => sum + segment.solution.length, 0), puzzle.size * puzzle.size);
    }
  }
});

test('player rating changes actual generated board parameters', () => {
  const easier = generateAdaptivePuzzle(41, { rating: 10 }, 123, 'adaptive', 'gentle');
  const harder = generateAdaptivePuzzle(41, { rating: 95 }, 123, 'adaptive', 'spicy');
  assert.ok(easier.size < harder.size);
  assert.ok(easier.segments.length < harder.segments.length);
  assert.notEqual(easier.difficulty.target, harder.difficulty.target);
});

test('seeded daily puzzles are deterministic', () => {
  assert.deepEqual(generatePuzzle(41, 20261020), generatePuzzle(41, 20261020));
});

test('difficulty estimate and performance score remain bounded', () => {
  const puzzle = generateAdaptivePuzzle(41, { rating: 64 }, 641, 'adaptive', 'balanced');
  const estimate = estimatePuzzleDifficulty(puzzle);
  assert.ok(estimate.score >= 0 && estimate.score <= 100);
  for (const elapsedSeconds of [0, 60, 6000]) {
    const score = scorePuzzlePerformance({ puzzle, elapsedSeconds, hints: 1, resets: 1, backtracks: 2 });
    assert.ok(score >= 0 && score <= 100);
  }
});

test('ambiguity diagnostic detects multiple valid covers when search is conclusive', () => {
  const ambiguous = {
    size: 3,
    segments: [
      { id: 0, start: { r: 0, c: 0 }, end: { r: 0, c: 2 }, solution: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }] },
      { id: 1, start: { r: 1, c: 2 }, end: { r: 2, c: 2 }, solution: [{ r: 1, c: 2 }, { r: 1, c: 1 }, { r: 1, c: 0 }, { r: 2, c: 0 }, { r: 2, c: 1 }, { r: 2, c: 2 }] },
    ],
  };
  assert.equal(validatePuzzle(ambiguous), true);
  const result = analyzePuzzleAmbiguity(ambiguous, 12000);
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.solutionsFound, 2);
  assert.ok(result.nodes <= 12000);
});

test('ambiguity diagnostic respects its search budget', () => {
  const puzzle = generatePuzzle(41, 20261020);
  const result = analyzePuzzleAmbiguity(puzzle, 20);
  assert.ok(['unique', 'ambiguous', 'unknown', 'unsolvable'].includes(result.status));
  assert.ok(result.nodes <= 20);
});

test('offline analytics track starts, completions, feedback and return days', () => {
  let analytics = appendAnalyticsEvent(undefined, 'session_start', { day: '2026-10-20' }, 1000);
  analytics = appendAnalyticsEvent(analytics, 'session_start', { day: '2026-10-21' }, 2000);
  analytics = appendAnalyticsEvent(analytics, 'puzzle_start', { level: 1 }, 3000);
  analytics = appendAnalyticsEvent(analytics, 'puzzle_complete', { elapsedSeconds: 90, hints: 1, resets: 2 }, 4000);
  analytics = appendAnalyticsEvent(analytics, 'feedback', { rating: 'balanced' }, 5000);
  const summary = analyticsSummary(analytics);
  assert.equal(summary.sessions, 2);
  assert.equal(summary.returnDays, 2);
  assert.equal(summary.completions, 1);
  assert.equal(summary.averageSolveSeconds, 90);
  assert.equal(summary.feedback.balanced, 1);
});

test('variant selection and reward updates stay local and bounded', () => {
  assert.ok(['gentle', 'balanced', 'spicy'].includes(choosePuzzleVariant({}, () => 0.5)));
  const updated = recordVariantReward({}, 'spicy', 1);
  assert.equal(updated.arms.spicy.trials, 1);
  assert.equal(updated.arms.spicy.mean, 1);
  assert.ok(ratingUncertainty(20) < ratingUncertainty(1));
});
