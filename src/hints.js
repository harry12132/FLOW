export const HINT_LIMIT = 3;
export const HINT_WINDOW_MS = 10 * 60 * 1000;
export const HINT_STORAGE_KEY = 'flow-hint-window-v1';

export function readHintUsage(now = Date.now(), storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem(HINT_STORAGE_KEY) || 'null');
    const startedAt = Number(saved?.startedAt) || 0;
    const used = Math.max(0, Math.min(HINT_LIMIT, Number(saved?.used) || 0));
    if (!startedAt || now - startedAt >= HINT_WINDOW_MS || now < startedAt) {
      return { used: 0, startedAt: 0 };
    }
    return { used, startedAt };
  } catch {
    return { used: 0, startedAt: 0 };
  }
}

export function consumeHint(usage = {}, now = Date.now()) {
  const current = usage.startedAt && now >= usage.startedAt && now - usage.startedAt < HINT_WINDOW_MS
    ? { used: Math.max(0, Math.min(HINT_LIMIT, Number(usage.used) || 0)), startedAt: usage.startedAt }
    : { used: 0, startedAt: now };
  return { used: Math.min(HINT_LIMIT, current.used + 1), startedAt: current.startedAt };
}

export function hintResetAt(usage = {}) {
  return usage.startedAt ? usage.startedAt + HINT_WINDOW_MS : null;
}
