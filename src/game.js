export const PALETTE = [
  { name: 'Coral', value: '#ef725f' },
  { name: 'Ocean', value: '#4c91d8' },
  { name: 'Mint', value: '#38a889' },
  { name: 'Grape', value: '#9271d4' },
  { name: 'Gold', value: '#d9a441' },
  { name: 'Rose', value: '#d65c91' },
  { name: 'Sky', value: '#4ab9c5' },
  { name: 'Tangerine', value: '#e99549' },
];

const key = (p) => p.r * 100 + p.c;
const same = (a, b) => !!a && !!b && a.r === b.r && a.c === b.c;
const neighbors = (p, n) => [
  { r: p.r - 1, c: p.c }, { r: p.r, c: p.c + 1 },
  { r: p.r + 1, c: p.c }, { r: p.r, c: p.c - 1 },
].filter(q => q.r >= 0 && q.c >= 0 && q.r < n && q.c < n);

function seededRandom(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function makeHamiltonianPath(n, random) {
  // Randomised Warnsdorff search: prefer cells with fewer onward choices.
  // A full-board path is the guarantee that the generated puzzle is solvable.
  for (let attempt = 0; attempt < 90; attempt++) {
    const start = { r: Math.floor(random() * n), c: Math.floor(random() * n) };
    const path = [start];
    const visited = new Set([key(start)]);
    let visitedNodes = 0;
    const search = (current) => {
      visitedNodes++;
      if (visitedNodes > 6000) return false;
      if (path.length === n * n) return true;
      const choices = neighbors(current, n)
        .filter(p => !visited.has(key(p)))
        .map(p => ({
          p,
          degree: neighbors(p, n).filter(q => !visited.has(key(q))).length,
          tie: random(),
        }))
        .sort((a, b) => a.degree - b.degree || a.tie - b.tie);
      for (const choice of choices) {
        const p = choice.p;
        visited.add(key(p));
        path.push(p);
        if (search(p)) return true;
        path.pop();
        visited.delete(key(p));
      }
      return false;
    };
    if (search(start)) return path;
  }

  // Guaranteed fallback: a serpentine path, with random row/column orientation.
  const rows = [];
  for (let r = 0; r < n; r++) {
    const row = [];
    const cols = r % 2 === 0
      ? Array.from({ length: n }, (_, c) => c)
      : Array.from({ length: n }, (_, c) => n - c - 1);
    cols.forEach(c => row.push({ r, c }));
    rows.push(row);
  }
  let path = rows.flat();
  if (random() > 0.5) path = path.map(p => ({ r: p.c, c: p.r }));
  if (random() > 0.5) path = path.map(p => ({ r: n - 1 - p.r, c: p.c }));
  return path;
}

export function generatePuzzle(level, seed = null) {
  const random = seededRandom(seed ?? Math.floor(Math.random() * 0xffffffff));
  const size = Math.min(8, 5 + Math.floor(Math.max(0, level - 1) / 18));
  const cells = size * size;
  const desiredPairs = Math.min(8, Math.max(3, 3 + Math.floor(level / 7)));
  const pairCount = Math.min(desiredPairs, Math.floor(cells / 3));
  const route = makeHamiltonianPath(size, random);

  // Cut one complete board-covering route into separate, non-overlapping paths.
  // Each colour gets at least two cells; longer paths become more common over time.
  const minLen = 2;
  const lengths = Array(pairCount).fill(minLen);
  let remaining = cells - pairCount * minLen;
  while (remaining > 0) {
    const i = Math.floor(random() * pairCount);
    const cap = Math.ceil(cells / pairCount) + Math.floor(level / 5);
    if (lengths[i] < cap) {
      lengths[i]++;
      remaining--;
    } else if (lengths.every(v => v >= cap)) {
      lengths[Math.floor(random() * pairCount)] += remaining;
      remaining = 0;
    }
  }

  // Shuffle which segments are longer, without changing the valid full cover.
  const segments = [];
  let offset = 0;
  lengths.forEach((length, i) => {
    const path = route.slice(offset, offset + length);
    offset += length;
    segments.push({
      id: i,
      color: PALETTE[i % PALETTE.length].value,
      name: PALETTE[i % PALETTE.length].name,
      start: path[0],
      end: path[path.length - 1],
      solution: path,
    });
  });
  // Rotate colour assignment so successive levels feel fresh.
  const shift = Math.floor(random() * PALETTE.length);
  segments.forEach((s, i) => {
    const color = PALETTE[(i + shift) % PALETTE.length];
    s.color = color.value;
    s.name = color.name;
  });

  return { size, segments, level, seed: seed ?? null };
}

export function isAdjacent(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

export function cellId(p) {
  return `${p.r},${p.c}`;
}

export function createEmptyPaths(puzzle) {
  return Object.fromEntries(puzzle.segments.map(s => [s.id, []]));
}

export function puzzleComplete(puzzle, paths) {
  const total = Object.values(paths).reduce((sum, path) => sum + path.length, 0);
  return total === puzzle.size * puzzle.size &&
    puzzle.segments.every(s => paths[s.id]?.length >= 2 && same(paths[s.id][0], s.start) && same(paths[s.id].at(-1), s.end));
}

export function getOccupied(paths, exceptId = null) {
  const occupied = new Map();
  Object.entries(paths).forEach(([id, path]) => {
    if (Number(id) === exceptId) return;
    path.forEach(p => occupied.set(cellId(p), Number(id)));
  });
  return occupied;
}

export function validatePuzzle(puzzle) {
  const seen = new Set();
  let total = 0;
  for (const segment of puzzle.segments) {
    if (segment.solution.length < 2) return false;
    for (let i = 0; i < segment.solution.length; i++) {
      const p = segment.solution[i];
      if (p.r < 0 || p.c < 0 || p.r >= puzzle.size || p.c >= puzzle.size) return false;
      const id = cellId(p);
      if (seen.has(id)) return false;
      seen.add(id);
      total++;
      if (i && !isAdjacent(segment.solution[i - 1], p)) return false;
    }
    if (!same(segment.solution[0], segment.start) || !same(segment.solution.at(-1), segment.end)) return false;
  }
  return total === puzzle.size * puzzle.size;
}


// FLOW's adaptive difficulty model. It estimates challenge fit from observed play,
// not from a judgement about the player's intelligence.
export function getAdaptiveLevel(level, rating = 50) {
  const offset = rating >= 80 ? 5
    : rating >= 70 ? 3
    : rating >= 60 ? 1
    : rating < 25 ? -5
    : rating < 35 ? -3
    : rating < 45 ? -1
    : 0;
  return Math.max(1, level + offset);
}

export function scorePuzzlePerformance({ puzzle, elapsedSeconds, hints = 0, resets = 0, backtracks = 0 }) {
  const expectedSeconds = 18 + puzzle.size * puzzle.size * 0.65 + puzzle.segments.length * 4.5;
  const speedScore = 50 + (1 - Math.max(0, elapsedSeconds) / expectedSeconds) * 35;
  const supportPenalty = hints * 9 + resets * 8 + backtracks * 1.5;
  return Math.max(0, Math.min(100, speedScore - supportPenalty));
}

export function updateAdaptiveRating(previousRating = 50, performanceScore = 50) {
  // Smooth updates prevent one unusually easy or difficult puzzle changing the game abruptly.
  return Math.round(previousRating * 0.7 + performanceScore * 0.3);
}
