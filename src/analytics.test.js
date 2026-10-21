import test from 'node:test';
import assert from 'node:assert/strict';
import { recordVariantReward, variantRewardFromPerformance } from './analytics.js';

test('variant reward is highest near the target performance band', () => {
  assert.ok(variantRewardFromPerformance(62) > variantRewardFromPerformance(20));
  assert.ok(variantRewardFromPerformance(62) > variantRewardFromPerformance(100));
});

test('variant reward stays bounded for extreme scores', () => {
  assert.equal(variantRewardFromPerformance(-10), variantRewardFromPerformance(0));
  assert.equal(variantRewardFromPerformance(110), variantRewardFromPerformance(100));
  assert.ok(variantRewardFromPerformance(0) >= 0.05);
  assert.ok(variantRewardFromPerformance(100) <= 1);
});

test('recordVariantReward updates the selected variant mean and trial count', () => {
  const next = recordVariantReward({ arms: { gentle: { mean: 0.5, trials: 2 } } }, 'gentle', 1);
  assert.equal(next.arms.gentle.trials, 3);
  assert.ok(next.arms.gentle.mean > 0.5);
});
