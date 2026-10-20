const DAY_MS = 24 * 60 * 60 * 1000;

export const EMPTY_ANALYTICS = Object.freeze({
  sessions: 0,
  starts: 0,
  completions: 0,
  abandonments: 0,
  totalSolveSeconds: 0,
  totalHints: 0,
  totalResets: 0,
  returnDays: 0,
  lastSessionDate: null,
  feedback: { easy: 0, balanced: 0, hard: 0 },
  events: [],
});

export function localDayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function readAnalytics(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem('flow-analytics-v1') || 'null');
    return {
      ...EMPTY_ANALYTICS,
      ...(saved && typeof saved === 'object' ? saved : {}),
      feedback: { ...EMPTY_ANALYTICS.feedback, ...(saved?.feedback || {}) },
      events: Array.isArray(saved?.events) ? saved.events.slice(-400) : [],
    };
  } catch {
    return { ...EMPTY_ANALYTICS, feedback: { ...EMPTY_ANALYTICS.feedback }, events: [] };
  }
}

export function appendAnalyticsEvent(current, type, detail = {}, now = Date.now()) {
  const state = {
    ...EMPTY_ANALYTICS,
    ...current,
    feedback: { ...EMPTY_ANALYTICS.feedback, ...(current?.feedback || {}) },
    events: [...(current?.events || [])],
  };
  const event = { type, at: now, ...detail };
  const next = { ...state, events: [...state.events, event].slice(-400) };
  if (type === 'session_start') {
    next.sessions += 1;
    const day = detail.day || localDayKey(new Date(now));
    if (next.lastSessionDate !== day) next.returnDays += 1;
    next.lastSessionDate = day;
  } else if (type === 'puzzle_start') {
    next.starts += 1;
  } else if (type === 'puzzle_complete') {
    next.completions += 1;
    next.totalSolveSeconds += Math.max(0, Number(detail.elapsedSeconds) || 0);
    next.totalHints += Math.max(0, Number(detail.hints) || 0);
    next.totalResets += Math.max(0, Number(detail.resets) || 0);
  } else if (type === 'puzzle_abandon') {
    next.abandonments += 1;
  } else if (type === 'feedback') {
    const key = detail.rating;
    if (key === 'easy') next.feedback.easy += 1;
    if (key === 'balanced') next.feedback.balanced += 1;
    if (key === 'hard') next.feedback.hard += 1;
  }
  return next;
}

export function choosePuzzleVariant(adaptive = {}, random = Math.random) {
  const arms = adaptive.arms || {};
  const variants = ['gentle', 'balanced', 'spicy'];
  // Explore occasionally; otherwise prefer the variant with the best observed reward.
  if (random() < 0.18 || variants.some(name => !Number.isFinite(arms[name]?.mean))) {
    return variants[Math.floor(random() * variants.length)];
  }
  return variants.reduce((best, name) => {
    const a = arms[name] || { mean: 0.5, trials: 0 };
    const b = arms[best] || { mean: 0.5, trials: 0 };
    const adjustedA = a.mean + 0.08 / Math.sqrt(a.trials + 1);
    const adjustedB = b.mean + 0.08 / Math.sqrt(b.trials + 1);
    return adjustedA > adjustedB ? name : best;
  }, variants[0]);
}

export function recordVariantReward(adaptive = {}, variant = 'balanced', reward = 0.6) {
  const arms = { ...(adaptive.arms || {}) };
  const previous = arms[variant] || { mean: 0.5, trials: 0 };
  const bounded = Math.max(0, Math.min(1, reward));
  arms[variant] = {
    trials: previous.trials + 1,
    mean: previous.mean + (bounded - previous.mean) / (previous.trials + 1),
  };
  return { ...adaptive, arms };
}

export function ratingUncertainty(samples = 0) {
  return Math.round(Math.max(8, Math.min(35, 35 / Math.sqrt(Math.max(1, samples + 1)))));
}

export function analyticsSummary(analytics) {
  const completions = analytics?.completions || 0;
  return {
    sessions: analytics?.sessions || 0,
    starts: analytics?.starts || 0,
    completions,
    abandonments: analytics?.abandonments || 0,
    averageSolveSeconds: completions ? Math.round((analytics.totalSolveSeconds || 0) / completions) : 0,
    hintsPerPuzzle: completions ? Number(((analytics.totalHints || 0) / completions).toFixed(1)) : 0,
    resetsPerPuzzle: completions ? Number(((analytics.totalResets || 0) / completions).toFixed(1)) : 0,
    returnDays: analytics?.returnDays || 0,
    feedback: analytics?.feedback || { easy: 0, balanced: 0, hard: 0 },
  };
}
