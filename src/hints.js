export const HINT_LIMIT = 3;
export const HINT_WINDOW_MS = 10 * 60 * 1000;
export const HINT_STORAGE_KEY = 'flow-hint-window-v1';

export function readHintUsage(now = Date.now(), storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem(HINT_STORAGE_KEY) || 'null');
    const used = Math.max(0, Math.min(HINT_LIMIT, Number(saved?.used) || 0));
    const exhaustedAt = Number(saved?.exhaustedAt) || 0;
    if (used >= HINT_LIMIT) {
      if (!exhaustedAt || now - exhaustedAt >= HINT_WINDOW_MS || now < exhaustedAt) {
        return { used: 0, exhaustedAt: 0 };
      }
      return { used: HINT_LIMIT, exhaustedAt };
    }
    return { used, exhaustedAt: 0 };
  } catch {
    return { used: 0, exhaustedAt: 0 };
  }
}

export function consumeHint(usage = {}, now = Date.now()) {
  const current = readUsageValue(usage, now);
  const used = Math.min(HINT_LIMIT, current.used + 1);
  return { used, exhaustedAt: used >= HINT_LIMIT ? now : 0 };
}

function readUsageValue(usage, now) {
  const used = Math.max(0, Math.min(HINT_LIMIT, Number(usage.used) || 0));
  const exhaustedAt = Number(usage.exhaustedAt) || 0;
  if (used >= HINT_LIMIT && (!exhaustedAt || now - exhaustedAt >= HINT_WINDOW_MS || now < exhaustedAt)) {
    return { used: 0, exhaustedAt: 0 };
  }
  return { used: Math.min(used, HINT_LIMIT - 1), exhaustedAt: 0 };
}

export function hintResetAt(usage = {}) {
  return usage.exhaustedAt ? usage.exhaustedAt + HINT_WINDOW_MS : null;
}
