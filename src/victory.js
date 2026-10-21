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
  'Pure brilliance!',
];

export function getVictoryHeadline(level = 1, random = Math.random) {
  const safeRandom = Number.isFinite(random()) ? random : Math.random;
  const index = Math.min(HEADLINES.length - 1, Math.max(0, Math.floor(safeRandom() * HEADLINES.length)));
  return HEADLINES[index];
}

export const VICTORY_HEADLINE_COUNT = HEADLINES.length;
