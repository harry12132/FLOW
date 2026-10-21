export const PALETTE = [
  { name: 'Red', value: '#ff595e' },
  { name: 'Orange', value: '#ff9f1c' },
  { name: 'Lime', value: '#d4f06a' },
  { name: 'Green', value: '#00a86b' },
  { name: 'Cyan', value: '#00cfe8' },
  { name: 'Blue', value: '#3a86ff' },
  { name: 'Purple', value: '#8338ec' },
  { name: 'Pink', value: '#f15bb5' },
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

export function generatePuzzle(level, seed = null, options = {}) {
  const random = seededRandom(seed ?? Math.floor(Math.random() * 0xffffffff));
  const defaultSize = Math.min(8, 5 + Math.floor(Math.max(0, level - 1) / 18));
  const size = Math.max(5, Math.min(8, options.size ?? defaultSize));
  const cells = size * size;
  const desiredPairs = options.pairCount ?? Math.min(8, Math.max(3, 3 + Math.floor(level / 7)));
  const pairCount = Math.max(3, Math.min(8, desiredPairs, Math.floor(cells / 3)));
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

  const puzzle = { size, segments, level, seed: seed ?? null };
  puzzle.difficulty = estimatePuzzleDifficulty(puzzle);
  return puzzle;
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


// Bounded exact-cover search for endpoint ambiguity. Large boards may return "unknown"
// rather than blocking play; this is a diagnostic, not part of the hot gameplay path.
export function analyzePuzzleAmbiguity(puzzle, maxNodes = 12000) {
  if (!validatePuzzle(puzzle)) return { status: 'invalid', solutionsFound: 0, nodes: 0, exhaustive: true };
  const size = puzzle.size;
  const allCells = size * size;
  const endpointKeys = new Set(puzzle.segments.flatMap(segment => [key(segment.start), key(segment.end)]));
  const segments = [...puzzle.segments].sort((a, b) => {
    const distance = s => Math.abs(s.start.r - s.end.r) + Math.abs(s.start.c - s.end.c);
    return distance(a) - distance(b);
  });
  const occupied = new Set();
  let nodes = 0;
  let solutionsFound = 0;
  let exhausted = false;

  const solveSegment = index => {
    if (solutionsFound >= 2 || exhausted) return;
    if (index === segments.length) {
      if (occupied.size === allCells) solutionsFound++;
      return;
    }
    const segment = segments[index];
    const startKey = key(segment.start);
    const targetKey = key(segment.end);
    const local = new Set([startKey]);
    const path = [segment.start];

    const walk = current => {
      nodes++;
      if (nodes > maxNodes) { exhausted = true; return; }
      if (solutionsFound >= 2 || exhausted) return;
      const currentKey = key(current);
      if (currentKey === targetKey) {
        if (path.length < 2) return;
        for (const point of path) occupied.add(key(point));
        solveSegment(index + 1);
        for (const point of path) occupied.delete(key(point));
        return;
      }
      const choices = neighbors(current, size).sort((a, b) => {
        const da = Math.abs(a.r - segment.end.r) + Math.abs(a.c - segment.end.c);
        const db = Math.abs(b.r - segment.end.r) + Math.abs(b.c - segment.end.c);
        return da - db;
      });
      for (const next of choices) {
        const nextKey = key(next);
        if (local.has(nextKey) || occupied.has(nextKey)) continue;
        if (endpointKeys.has(nextKey) && nextKey !== targetKey) continue;
        local.add(nextKey);
        path.push(next);
        walk(next);
        path.pop();
        local.delete(nextKey);
        if (solutionsFound >= 2 || exhausted) return;
      }
    };
    walk(segment.start);
  };

  solveSegment(0);
  return {
    status: solutionsFound >= 2 ? 'ambiguous' : exhausted ? 'unknown' : solutionsFound === 1 ? 'unique' : 'unsolvable',
    solutionsFound,
    nodes: Math.min(nodes, maxNodes),
    exhaustive: !exhausted,
  };
}


export function scorePuzzlePerformance({ puzzle, elapsedSeconds, hints = 0, resets = 0, backtracks = 0 }) {
  const structuralDifficulty = puzzle.difficulty?.score ?? estimatePuzzleDifficulty(puzzle).score;
  const baselineSeconds = 18 + puzzle.size * puzzle.size * 0.65 + puzzle.segments.length * 4.5;
  const expectedSeconds = baselineSeconds * (0.82 + structuralDifficulty / 100 * 0.36);
  const speedScore = 50 + (1 - Math.max(0, elapsedSeconds) / expectedSeconds) * 35;
  const supportPenalty = hints * 7 + resets * 5 + backtracks * 0.65;
  return Math.max(0, Math.min(100, speedScore - supportPenalty));
}

// Estimate puzzle challenge from puzzle structure alone, never from a judgement about a player.
// This is a calibrated heuristic, not a claim that every puzzle of a given score feels identical.
export function estimatePuzzleDifficulty(puzzle) {
  const cells = puzzle.size * puzzle.size;
  const pairCount = puzzle.segments.length;
  let steps = 0;
  let turns = 0;
  let lengthSquares = 0;
  let endpointChoices = 0;
  for (const segment of puzzle.segments) {
    const path = segment.solution || [];
    steps += path.length;
    lengthSquares += path.length * path.length;
    for (let i = 2; i < path.length; i++) {
      const a = path[i - 2], b = path[i - 1], c = path[i];
      if ((b.r - a.r) !== (c.r - b.r) || (b.c - a.c) !== (c.c - b.c)) turns++;
    }
    for (const endpoint of [segment.start, segment.end]) {
      const degree = neighbors(endpoint, puzzle.size).length;
      endpointChoices += Math.max(0, degree - 1);
    }
  }
  const meanLength = steps / Math.max(1, pairCount);
  const lengthVariance = Math.max(0, lengthSquares / Math.max(1, pairCount) - meanLength * meanLength);
  const turnRate = turns / Math.max(1, cells - pairCount);
  const sizeScore = ((puzzle.size - 5) / 3) * 24;
  const pairScore = ((pairCount - 3) / 5) * 18;
  const routeScore = Math.min(25, turnRate * 42);
  const varianceScore = Math.min(12, Math.sqrt(lengthVariance) * 2.1);
  const endpointScore = Math.min(12, endpointChoices / Math.max(1, pairCount * 2) * 8);
  const score = Math.round(Math.max(0, Math.min(100, 18 + sizeScore + pairScore + routeScore + varianceScore + endpointScore)));
  return {
    score,
    size: puzzle.size,
    pairs: pairCount,
    turns,
    turnRate: Number(turnRate.toFixed(3)),
    lengthVariance: Number(lengthVariance.toFixed(2)),
    ambiguityRiskEstimate: Math.round(Math.max(0, Math.min(100, (endpointChoices / Math.max(1, pairCount * 6)) * 100))),
  };
}

// Generate several valid candidates, then select the one whose structural difficulty
// best matches the player's current target. Every candidate carries a known full-board
// solution, so solvability is guaranteed by construction and checked again before return.
export function generateAdaptivePuzzle(level, profile = {}, seed = null, mode = 'adaptive', variant = 'balanced') {
  const rating = Math.max(0, Math.min(100, Number(profile.rating ?? 50)));
  const fastStreak = Math.max(0, Math.min(10, Number(profile.fastStreak ?? 0)));
  const feedbackBias = Math.max(-12, Math.min(12, Number(profile.feedbackBias ?? 0)));
  const defaultSize = Math.min(8, 5 + Math.floor(Math.max(0, level - 1) / 18));
  const defaultPairs = Math.min(8, Math.max(3, 3 + Math.floor(level / 7)));
  const sizeShift = mode === 'relaxed' ? -1 : mode === 'challenging' ? 1 : mode === 'standard' ? 0 : (rating >= 88 || fastStreak >= 2) ? 1 : rating <= 18 && fastStreak === 0 ? -1 : 0;
  const size = Math.max(5, Math.min(8, defaultSize + sizeShift));
  const pairShift = mode === 'relaxed' ? -1 : mode === 'challenging' ? 1 : mode === 'standard' ? 0 : (rating >= 72 || fastStreak >= 1) ? 1 : rating <= 28 ? -1 : 0;
  const pairCount = Math.max(3, Math.min(8, defaultPairs + pairShift, Math.floor((size * size) / 3)));
  const variantBias = mode === 'adaptive' ? ({ gentle: -7, balanced: 0, spicy: 7 }[variant] ?? 0) : 0;
  const modeBias = (mode === 'relaxed' ? -9 : mode === 'challenging' ? 9 : 0) + variantBias;
  const randomSeed = seed ?? Math.floor(Math.random() * 0xffffffff);
  const variants = mode === 'relaxed' ? 3 : mode === 'challenging' ? 5 : 4;
  const candidates = [];
  for (let i = 0; i < variants; i++) {
    const candidateSeed = (randomSeed + Math.imul(i + 1, 0x45d9f3b)) >>> 0;
    const candidate = generatePuzzle(level, candidateSeed, { size, pairCount });
    if (validatePuzzle(candidate)) candidates.push(candidate);
  }
  if (!candidates.length) {
    const fallback = generatePuzzle(level, randomSeed, { size, pairCount });
    return { ...fallback, difficulty: { ...fallback.difficulty, target: fallback.difficulty.score, mode, fit: 100 } };
  }
  const sortedScores = candidates.map(candidate => candidate.difficulty.score).sort((a, b) => a - b);
  const baseline = sortedScores[Math.floor(sortedScores.length / 2)];
  const personalAdjustment = mode === 'adaptive' ? (rating - 50) * 0.38 + feedbackBias : 0;
  const target = Math.max(8, Math.min(96, baseline + personalAdjustment + modeBias));
  let best = candidates[0];
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate.difficulty.score - target);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return {
    ...best,
    difficulty: { ...best.difficulty, target: Math.round(target), mode, variant, fit: Math.max(0, 100 - Math.round(bestDistance)) },
  };
}

export function updateAdaptiveRating(previousRating = 50, performanceScore = 50, samples = 0) {
  const prior = Math.max(0, Math.min(100, Number(previousRating)));
  const observation = Math.max(0, Math.min(100, Number(performanceScore)));
  const weight = Math.max(0.12, Math.min(0.35, 1 / Math.sqrt(Math.max(1, samples + 1))));
  return Math.round(prior * (1 - weight) + observation * weight);
}
