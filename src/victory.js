const HEADLINES = [
  'Incredible!',
  'Outstanding!',
  'Exceptional!',
  'Absolutely brilliant!',
  'Magnificent!',
  'Phenomenal!',
  'Superb!',
  'Remarkable!',
  'Impressive!',
  'Flawless!',
  'Genius at work!',
  'Spectacular!',
  'You nailed it!',
  'Masterfully done!',
  'Beautifully solved!',
  'Elite connecting.',
  'Top-tier thinking!',
  'Simply excellent!',
  'A stunning solve!',
  'Unreasonably good!',
  'Big brain energy!',
];

export function getVictoryHeadline(level = 1, random = Math.random) {
  let sample;
  try { sample = Number(random()); } catch { sample = NaN; }
  const safeRandom = Number.isFinite(sample)
    ? Math.min(0.999999999999, Math.max(0, sample))
    : Math.random();
  const index = Math.floor(safeRandom * HEADLINES.length);
  return HEADLINES[index];
}

export const VICTORY_HEADLINE_COUNT = HEADLINES.length;
