import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LiquidGlass from 'liquid-glass-react';
import GlassCanvas from './GlassCanvas.jsx';
import { cellId, createEmptyPaths, generatePuzzle, generateAdaptivePuzzle, getOccupied, isAdjacent, puzzleComplete, scorePuzzlePerformance, updateAdaptiveRating } from './game.js';
import { appendAnalyticsEvent, analyticsSummary, choosePuzzleVariant, readAnalytics, ratingUncertainty, recordVariantReward, variantRewardFromPerformance } from './analytics.js';
import { getAchievementMessage } from './engagement.js';
import { getVictoryHeadline } from './victory.js';
import { consumeHint, HINT_LIMIT, HINT_STORAGE_KEY, HINT_WINDOW_MS, readHintUsage } from './hints.js';
import { initializeAdMob, showRewardedHintAd } from './admob.js';

const STORE = 'flow-save-v1';
const readSave = () => {
  try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; }
};
const same = (a, b) => a && b && a.r === b.r && a.c === b.c;

function App() {
  const initial = useMemo(() => readSave(), []);
  const challengeParams = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('challenge')) return null;
    const seed = Number(params.get('challenge'));
    const challengeLevel = Number(params.get('level'));
    const size = Number(params.get('size'));
    const pairs = Number(params.get('pairs'));
    if (!Number.isFinite(seed) || !Number.isFinite(challengeLevel) || challengeLevel < 1 || challengeLevel > 10000 || !Number.isInteger(size) || size < 5 || size > 8 || !Number.isInteger(pairs) || pairs < 3 || pairs > 8) return null;
    return { seed: seed >>> 0, level: Math.floor(challengeLevel), size, pairs };
  }, []);
  const [level, setLevel] = useState(Math.max(1, challengeParams?.level || initial.level || 1));
  const [best, setBest] = useState(initial.best || 1);
  const [sound, setSound] = useState(initial.sound !== false);
  const [adaptive, setAdaptive] = useState(() => ({ rating: Math.max(0, Math.min(100, initial.adaptive?.rating ?? 50)), samples: initial.adaptive?.samples ?? 0, fastStreak: initial.adaptive?.fastStreak ?? 0, feedbackBias: initial.adaptive?.feedbackBias ?? 0, arms: initial.adaptive?.arms ?? {}, uncertainty: initial.adaptive?.uncertainty ?? ratingUncertainty(initial.adaptive?.samples ?? 0) }));
  const difficultyMode = 'adaptive';
  const [reminderEnabled, setReminderEnabled] = useState(initial.reminderEnabled === true);
  const [puzzle, setPuzzle] = useState(() => challengeParams
    ? generatePuzzle(challengeParams.level, challengeParams.seed, { size: challengeParams.size, pairCount: challengeParams.pairs })
    : generateAdaptivePuzzle(Math.max(1, initial.level || 1), initial.adaptive || {}, null, 'adaptive', choosePuzzleVariant(initial.adaptive || {})));
  const [paths, setPaths] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [won, setWon] = useState(false);
  const [achievementMessage, setAchievementMessage] = useState('Every colour. Every cell.');
  const [victoryHeadline, setVictoryHeadline] = useState(() => getVictoryHeadline());
  const [hintUsage, setHintUsage] = useState(() => readHintUsage());
  const hints = Math.max(0, HINT_LIMIT - hintUsage.used);
  const [hintCell, setHintCell] = useState(null);
  const [hintLine, setHintLine] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [toast, setToast] = useState('');
  const [daily, setDaily] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [analytics, setAnalytics] = useState(() => readAnalytics());
  const sessionRecorded = useRef(false);
  const boardRef = useRef(null);
  const pointerDown = useRef(false);
  const lastPointerCell = useRef(null);
  const audioRef = useRef(null);
  const activeElapsedMs = useRef(0);
  const activeSince = useRef(typeof document !== 'undefined' && document.visibilityState === 'hidden' ? null : Date.now());
  const puzzleMetrics = useRef({ hints: 0, resets: 0, backtracks: 0 });
  const puzzleResultRecorded = useRef(false);

  const occupied = useMemo(() => getOccupied(paths, activeId), [paths, activeId]);
  const filled = useMemo(() => Object.values(paths).reduce((n, p) => n + p.length, 0), [paths]);
  const total = puzzle.size * puzzle.size;
  const progress = Math.round((filled / total) * 100);

  const recordEvent = (type, detail = {}) => setAnalytics(previous => appendAnalyticsEvent(previous, type, detail));
  const stats = analyticsSummary(analytics);

  useEffect(() => {
    localStorage.setItem(STORE, JSON.stringify({ level, best, sound, adaptive, reminderEnabled }));
  }, [level, best, sound, adaptive, reminderEnabled]);

  useEffect(() => {
    try { localStorage.setItem('flow-analytics-v1', JSON.stringify(analytics)); } catch { /* Analytics are optional; the game still works without storage. */ }
  }, [analytics]);

  useEffect(() => {
    try { localStorage.setItem(HINT_STORAGE_KEY, JSON.stringify(hintUsage)); } catch { /* Hints still work for this session without storage. */ }
  }, [hintUsage]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHintUsage(current => {
        const fresh = readHintUsage();
        return current.used === fresh.used && current.exhaustedAt === fresh.exhaustedAt ? current : fresh;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void initializeAdMob();
  }, []);

  useEffect(() => {
    if (sessionRecorded.current) return;
    sessionRecorded.current = true;
    recordEvent('session_start');
    recordEvent('puzzle_start', { level, mode: challengeParams ? 'shared' : difficultyMode, variant: puzzle.difficulty?.variant });
    try {
      const now = Date.now();
      const lastOpen = Number(localStorage.getItem('flow-last-open') || 0);
      if (reminderEnabled && lastOpen && now - lastOpen >= 24 * 60 * 60 * 1000) notify('Your optional FLOW reminder: a fresh puzzle is waiting.');
      localStorage.setItem('flow-last-open', String(now));
    } catch { /* Reminders are optional and never block play. */ }
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && activeSince.current !== null) {
        activeElapsedMs.current += Date.now() - activeSince.current;
        activeSince.current = null;
      } else if (!document.hidden && activeSince.current === null) {
        activeSince.current = Date.now();
      }
    };
    const onPageHide = () => {
      if (puzzleResultRecorded.current) return;
      try {
        const current = readAnalytics();
        const next = appendAnalyticsEvent(current, 'puzzle_abandon', { level, mode: difficultyMode, reason: 'pagehide' });
        localStorage.setItem('flow-analytics-v1', JSON.stringify(next));
      } catch { /* The puzzle remains playable if browser storage is unavailable. */ }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [level, difficultyMode]);

  useEffect(() => {
    const stop = () => {
      if (pointerDown.current && activeId !== null) {
        setPaths(prev => ({ ...prev, [activeId]: [] }));
      }
      pointerDown.current = false;
      lastPointerCell.current = null;
      setActiveId(null);
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [activeId]);

  const beep = useCallback((frequency = 520, duration = 0.06) => {
    if (!sound) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.025, ctx.currentTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + duration + 0.02);
    } catch { /* Sound is a bonus, never a blocker. */ }
  }, [sound]);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 1700);
  };

  const installLevel = (nextLevel, isDaily = false) => {
    if (window.location.search.includes('challenge=')) {
      const params = new URLSearchParams(window.location.search);
      ['challenge', 'level', 'size', 'pairs'].forEach(key => params.delete(key));
      window.history.replaceState({}, '', window.location.pathname + (params.toString() ? `?${params.toString()}` : '') + window.location.hash);
    }
    if (!won && !puzzleResultRecorded.current && sessionRecorded.current) recordEvent('puzzle_abandon', { level, mode: difficultyMode });
    const localDate = new Date();
    const daySeed = Number(`${localDate.getFullYear()}${String(localDate.getMonth() + 1).padStart(2, '0')}${String(localDate.getDate()).padStart(2, '0')}`);
    const variant = choosePuzzleVariant(adaptive);
    const next = isDaily ? generatePuzzle(nextLevel, daySeed) : generateAdaptivePuzzle(nextLevel, adaptive, null, 'adaptive', variant);
    activeElapsedMs.current = 0;
    activeSince.current = typeof document !== 'undefined' && document.visibilityState === 'hidden' ? null : Date.now();
    puzzleMetrics.current = { hints: 0, resets: 0, backtracks: 0 };
    puzzleResultRecorded.current = false;
    setLevel(nextLevel);
    setPuzzle(next);
    setPaths(createEmptyPaths(next));
    setActiveId(null);
    setWon(false);
    setAchievementMessage('Every colour. Every cell.');
    setHintCell(null);
    setHintLine(null);
    setDaily(isDaily);
    recordEvent('puzzle_start', { level: nextLevel, mode: isDaily ? 'daily' : difficultyMode, variant: next.difficulty?.variant, difficulty: next.difficulty?.score });
    setShowMenu(false);
  };

  const reset = () => {
    puzzleMetrics.current.resets += 1;
    setPaths(createEmptyPaths(puzzle));
    setActiveId(null);
    setWon(false);
    setHintCell(null);
    setHintLine(null);
    beep(300, 0.07);
  };

  const cellFromTarget = (target) => {
    const cell = target.closest('[data-cell]');
    if (!cell) return null;
    const [r, c] = cell.dataset.cell.split(',').map(Number);
    return { r, c };
  };

  const startPath = (segment, point) => {
    if (won) return;
    const current = paths[segment.id] || [];
    const isStart = same(point, segment.start);
    const isEnd = same(point, segment.end);
    if (!isStart && !isEnd) return;
    if (current.length > 0 && !(same(current[0], segment.start) || same(current.at(-1), segment.end))) return;
    const reversed = isEnd;
    const seed = reversed ? segment.end : segment.start;
    setPaths(prev => ({ ...prev, [segment.id]: [seed] }));
    setActiveId(segment.id);
    pointerDown.current = true;
    lastPointerCell.current = cellId(seed);
    setHintCell(null);
    setHintLine(null);
    beep(420, 0.04);
  };

  const extendPath = (segmentId, point) => {
    if (!pointerDown.current || won) return;
    const segment = puzzle.segments.find(s => s.id === segmentId);
    const current = paths[segmentId] || [];
    if (!segment || !current.length) return;
    const last = current.at(-1);
    if (same(point, last)) {
      if (current.length > 1 && same(point, current[current.length - 2])) {
        puzzleMetrics.current.backtracks += 1;
        setPaths(prev => ({ ...prev, [segmentId]: current.slice(0, -1) }));
        beep(310, 0.025);
      }
      return;
    }
    if (!isAdjacent(last, point)) return;
    const isEndpoint = puzzle.segments.some(s => (same(point, s.start) || same(point, s.end)) && s.id !== segmentId);
    if (isEndpoint) return;
    const otherPath = getOccupied(paths, segmentId);
    if (otherPath.has(cellId(point))) return;
    if (current.some(p => same(p, point))) return;
    const next = [...current, point];
    setPaths(prev => ({ ...prev, [segmentId]: next }));
    setHintCell(null);
    setHintLine(null);
    beep(500 + Math.min(5, next.length) * 35, 0.025);
    if (same(point, segment.end) || same(point, segment.start)) {
      pointerDown.current = false;
      setActiveId(null);
      const canonicalPath = same(point, segment.start) ? [...next].reverse() : next;
      setPaths(prev => {
        const completed = { ...prev, [segmentId]: canonicalPath };
        const done = puzzleComplete(puzzle, completed);
        if (done) {
          setWon(true);
          setVictoryHeadline(getVictoryHeadline());
          setBest(b => Math.max(b, level + 1));
          if (!puzzleResultRecorded.current) {
            puzzleResultRecorded.current = true;
            const elapsedSeconds = Math.max(0, (activeElapsedMs.current + (activeSince.current === null ? 0 : Date.now() - activeSince.current)) / 1000);
            const metrics = { ...puzzleMetrics.current };
            const score = scorePuzzlePerformance({ puzzle, elapsedSeconds, ...metrics });
            setAchievementMessage(getAchievementMessage({ level, score, elapsedSeconds, ...metrics }));
            recordEvent('puzzle_complete', { level, elapsedSeconds: Math.round(elapsedSeconds), hints: metrics.hints, resets: metrics.resets, backtracks: metrics.backtracks, performanceScore: Math.round(score), difficulty: puzzle.difficulty?.score, variant: puzzle.difficulty?.variant, daily });
            if (!daily) {
              const fastSolve = elapsedSeconds <= 20 && metrics.hints === 0 && metrics.resets === 0;
              setAdaptive(previous => {
                const samples = previous.samples + 1;
                const fastStreak = fastSolve ? Math.min(10, (previous.fastStreak || 0) + 1) : 0;
                const adaptiveScore = fastSolve ? Math.max(score, 90) : score;
                const rated = { ...previous, fastStreak, rating: updateAdaptiveRating(previous.rating, adaptiveScore, previous.samples), samples, uncertainty: ratingUncertainty(samples) };
                const reward = variantRewardFromPerformance(score);
                return recordVariantReward(rated, puzzle.difficulty?.variant || 'balanced', reward);
              });
            }
          }
          beep(760, 0.18);
        }
        return completed;
      });
    }
  };

  const onCellPointerDown = (event, point) => {
    event.preventDefault();
    if (won) return;
    const endpoint = puzzle.segments.find(s => same(point, s.start) || same(point, s.end));
    if (endpoint) {
      startPath(endpoint, point);
      return;
    }
    const owner = Object.entries(paths).find(([, path]) => path.some(p => same(p, point)));
    if (owner) {
      const id = Number(owner[0]);
      const path = owner[1];
      if (path.length && !same(point, path[0]) && !same(point, path.at(-1))) {
        puzzleMetrics.current.backtracks += Math.max(1, path.length - path.findIndex(p => same(p, point)) - 1);
        setPaths(prev => ({ ...prev, [id]: path.slice(0, path.findIndex(p => same(p, point)) + 1) }));
        setActiveId(id);
        pointerDown.current = true;
      } else {
        setPaths(prev => ({ ...prev, [id]: [] }));
      }
    }
  };

  const onCellEnter = (point) => {
    if (!pointerDown.current || activeId === null) return;
    const id = cellId(point);
    if (lastPointerCell.current === id) return;
    lastPointerCell.current = id;
    extendPath(activeId, point);
  };

  const revealHint = (consumeTimedHint = true) => {
    if (won) { notify('Already solved'); return false; }
    const segment = puzzle.segments.find(s => {
      const path = paths[s.id] || [];
      return !(path.length >= 2 && same(path[0], s.start) && same(path.at(-1), s.end));
    });
    if (!segment) { notify('Every path is connected'); return false; }
    const current = paths[segment.id] || [];
    const reverse = current.length > 0 && same(current[0], segment.end);
    const route = reverse ? [...segment.solution].reverse() : segment.solution;
    const anchor = current.length ? current.at(-1) : route[0];
    const anchorIndex = route.findIndex(point => same(point, anchor));
    const nextPoint = anchorIndex >= 0 ? route[anchorIndex + 1] : null;
    if (!nextPoint) {
      const fallbackIndex = route.findIndex(point => !current.some(existing => same(existing, point)));
      if (fallbackIndex < 0) { notify('Try completing this connection'); return false; }
      setHintCell(route[fallbackIndex]);
      setHintLine(null);
    } else {
      setHintCell(nextPoint);
      setHintLine([anchor, nextPoint]);
    }
    puzzleMetrics.current.hints += 1;
    if (consumeTimedHint) setHintUsage(consumeHint(hintUsage));
    notify(consumeTimedHint ? 'Highlighted the next correct step' : 'Reward earned: bonus hint unlocked');
    beep(680, 0.1);
    return true;
  };

  const useHint = async () => {
    if (won) { notify('Already solved'); return; }
    if (hints > 0) { revealHint(true); return; }
    notify('Watch a short ad to earn one bonus hint. Your 3 hints refresh after 10 minutes.');
    const rewarded = await showRewardedHintAd();
    if (rewarded) {
      revealHint(false);
    } else {
      notify('Rewarded ad unavailable right now. Your hints still refresh after 10 minutes.');
    }
  };

  const advanceToNextPuzzle = () => installLevel(level + 1);

  const shareChallenge = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('challenge', String(puzzle.seed ?? 0));
    url.searchParams.set('level', String(level));
    url.searchParams.set('size', String(puzzle.size));
    url.searchParams.set('pairs', String(puzzle.segments.length));
    try {
      if (navigator.share) await navigator.share({ title: 'FLOW puzzle challenge', text: 'Can you solve this FLOW puzzle?', url: url.toString() });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url.toString()); notify('Challenge link copied'); }
      else window.prompt('Copy this FLOW challenge link', url.toString());
    } catch (error) {
      if (error?.name !== 'AbortError') notify('Could not share right now');
    }
    setShowMenu(false);
  };

  const pathFor = (segment) => paths[segment.id] || [];
  const isEndpoint = (point) => puzzle.segments.find(s => same(point, s.start) || same(point, s.end));
  const solvedCount = puzzle.segments.filter(s => {
    const path = pathFor(s);
    return path.length >= 2 && same(path[0], s.start) && same(path.at(-1), s.end);
  }).length;

  const grid = Array.from({ length: puzzle.size * puzzle.size }, (_, i) => ({ r: Math.floor(i / puzzle.size), c: i % puzzle.size }));
  const pathPoints = puzzle.segments.flatMap(s => {
    const p = pathFor(s);
    return p.length ? [{ segment: s, path: p }] : [];
  });
  const activeGlassPath = activeId === null ? [] : (paths[activeId] || []);

  const pathD = (path) => {
    const points = path.map(p => ({ x: (p.c + 0.5) * 100 / puzzle.size, y: (p.r + 0.5) * 100 / puzzle.size }));
    if (points.length < 3) return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1], point = points[i], next = points[i + 1];
      const before = { x: point.x + (prev.x - point.x) * 0.18, y: point.y + (prev.y - point.y) * 0.18 };
      const after = { x: point.x + (next.x - point.x) * 0.18, y: point.y + (next.y - point.y) * 0.18 };
      d += ` L ${before.x} ${before.y} Q ${point.x} ${point.y} ${after.x} ${after.y}`;
    }
    const last = points.at(-1);
    return d + ` L ${last.x} ${last.y}`;
  };

  return (
    <main className="min-h-screen relative overflow-hidden text-white selection:bg-cyan-200/30">
      <div className="ambient ambient-one"/><div className="ambient ambient-two"/><div className="ambient ambient-three"/>
      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <button className="brand flex items-center gap-3" onClick={()=>installLevel(1)} aria-label="FLOW home"><span className="brand-symbol"><i/><i/><i/><i/></span><span className="text-[21px] font-semibold tracking-[-0.08em]">flow<span className="text-cyan-200">.</span></span></button>
        <LiquidGlass displacementScale={34} blurAmount={0.08} saturation={145} aberrationIntensity={1.2} elasticity={0.18} cornerRadius={19} padding="5px" className="liquid-controls"><div className="flex items-center gap-1.5">
          <button className="glass-icon" onClick={()=>setSound(v=>!v)} aria-label={sound?'Mute sound':'Enable sound'}><svg viewBox="0 0 24 24">{sound?<><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></>:<><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/></>}</svg></button>
          <button className="glass-icon" onClick={reset} aria-label="Restart puzzle"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/></svg></button>
          <button className="glass-icon" onClick={()=>setShowMenu(v=>!v)} aria-label="Game options"><span className="dots">···</span></button>
        </div></LiquidGlass>
      </header>
      <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-10 pt-5 sm:px-8 sm:pt-8">
        <div className="mb-5 flex items-center gap-3"><span className="level-pill">{daily?'DAILY':`LEVEL ${String(level).padStart(3,'0')}`}</span><span className="text-sm text-white/45">{puzzle.size} × {puzzle.size}</span></div>
        <h1 className="mb-2 text-center text-4xl font-medium tracking-[-0.075em] sm:text-5xl">{won?victoryHeadline:'Find your flow.'}</h1>
        <p className="mb-7 text-center text-sm text-white/45 sm:mb-9">{won?'Every colour. Every cell.':'Connect each pair. Every square should belong to a path.'}</p>
        <div className="board-glass relative w-full max-w-[590px] rounded-[30px] p-3 sm:p-4" ref={boardRef}>
          <div className={`board-inner relative aspect-square w-full overflow-hidden rounded-[20px] ${won?'board-won':''}`} style={{'--size':puzzle.size}} onPointerMove={event=>{if(pointerDown.current&&activeId!==null){const point=cellFromTarget(document.elementFromPoint(event.clientX,event.clientY));if(point)onCellEnter(point)}}}>
            <GlassCanvas size={puzzle.size} activePath={activeGlassPath} />
            <div className="board-glow"/>
            <svg className="path-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{hintLine&&<path className="hint-guide" d={pathD(hintLine)}/ >}{pathPoints.map(({segment,path})=><g key={segment.id} className={activeId===segment.id?'active-path':''}><path className="path-halo" d={pathD(path)} stroke={segment.color}/><path className="path-line" d={pathD(path)} stroke={segment.color}/></g>)}</svg>
            <div className="cell-grid" style={{gridTemplateColumns:`repeat(${puzzle.size},minmax(0,1fr))`}}>{grid.map(point=>{
              const endpoint=isEndpoint(point),owner=Object.entries(paths).find(([,path])=>path.some(p=>same(p,point)));
              const color=endpoint?.color||(owner?puzzle.segments.find(s=>s.id===Number(owner[0]))?.color:null),isHint=same(point,hintCell),isPathEnd=owner&&paths[Number(owner[0])]?.at(-1)&&same(paths[Number(owner[0])].at(-1),point);
              return <div key={cellId(point)} data-cell={cellId(point)} className={`cell ${endpoint?'endpoint-cell':''} ${owner?'has-path':''} ${isHint?'hint-cell':''} ${isPathEnd?'path-end':''}`} onPointerDown={ev=>onCellPointerDown(ev,point)} style={{'--path-color':color||'transparent',borderRight:point.c===puzzle.size-1?0:undefined,borderBottom:point.r===puzzle.size-1?0:undefined}}>{endpoint&&<span className="endpoint-dot" style={{'--dot-color':endpoint.color}} role="img" aria-label={`${endpoint.name} endpoint`}/>}{isHint&&<span className="hint-pulse"/>}</div>
            })}</div>
          </div>
          {won&&<div className="win-overlay"><div className="win-orb">✦</div><h2 className="mt-4 text-2xl font-medium tracking-tight sm:text-3xl">{victoryHeadline}</h2><p className="mt-2 text-sm text-white/55">{achievementMessage}</p><button type="button" className="next-button mt-5" onClick={advanceToNextPuzzle}>Next puzzle <svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></button></div>}
        </div>
        <div className="mt-5 flex w-full max-w-[590px] items-center justify-between gap-4 px-1"><div className="flex min-w-0 flex-1 items-center gap-3"><div className="progress-track flex-1"><span style={{width:`${progress}%`}}/></div><span className="w-10 text-right text-xs tabular-nums text-white/50">{progress}%</span></div><button className="hint-button" onClick={useHint} disabled={won} aria-label={`Use hint. ${hints} remaining. Hints refresh every ${HINT_WINDOW_MS / 60000} minutes.`}><svg viewBox="0 0 24 24"><path d="M9 18h6m-5 3h4m-2-19a7 7 0 0 0-4 12.7c.6.4 1 1.1 1 1.8h6c0-.7.4-1.4 1-1.8A7 7 0 0 0 12 2Z"/></svg><span>Hint</span><span className="hint-number">{hints}</span></button></div>
        <div className="mt-4 flex items-center gap-2 text-[11px] tracking-wide text-white/30"><span className="status-dot"/>{solvedCount} of {puzzle.segments.length} paths connected</div>
        <p className="mt-2 text-[10px] tracking-wide text-white/25">Difficulty adapts to your pace.</p>
      </section>
      <footer className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-5 pb-5 text-[10px] tracking-wide text-white/25 sm:px-8"><span>FLOW</span><span>{Math.max(0,best-1)} completed</span></footer>
      {showMenu&&<div className="menu-backdrop" onClick={()=>setShowMenu(false)}><div className="menu-glass" onClick={ev=>ev.stopPropagation()}><button onClick={()=>installLevel(1)}>Restart from level one</button><button onClick={()=>installLevel(level,true)}>Daily puzzle</button><button onClick={()=>{setShowStats(true);setShowMenu(false)}}>Player stats</button><button onClick={shareChallenge}>Share this puzzle</button><button onClick={()=>{setReminderEnabled(v=>!v);setShowMenu(false);notify('In-app return reminder '+(!reminderEnabled?'on':'off'))}}>Return reminder: {reminderEnabled?'on':'off'}</button><button onClick={()=>{setSound(v=>!v);setShowMenu(false)}}>{sound?'Sound off':'Sound on'}</button><p>Stats stay on this device. Reminders are in-app only. FLOW works offline after its first load.</p></div></div>}
      {showStats&&<div className="stats-backdrop" onClick={()=>setShowStats(false)}><section className="stats-panel" role="dialog" aria-modal="true" aria-label="Player stats" onClick={ev=>ev.stopPropagation()}><div className="stats-heading"><div><span className="stats-eyebrow">YOUR FLOW</span><h2>Player stats</h2></div><button onClick={()=>setShowStats(false)} aria-label="Close stats">×</button></div><div className="stats-rating"><span>Adaptive rating</span><strong>{adaptive.rating}<small>/100</small></strong><p>Estimated challenge fit · uncertainty ±{adaptive.uncertainty ?? ratingUncertainty(adaptive.samples)}</p></div><div className="stats-grid"><div><strong>{stats.completions}</strong><span>Puzzles solved</span></div><div><strong>{stats.averageSolveSeconds ? Math.floor(stats.averageSolveSeconds/60)+'m '+stats.averageSolveSeconds%60+'s' : '—'}</strong><span>Average solve</span></div><div><strong>{stats.returnDays}</strong><span>Days played</span></div><div><strong>{stats.abandonments}</strong><span>Unfinished</span></div><div><strong>{stats.hintsPerPuzzle}</strong><span>Hints per solve</span></div><div><strong>{stats.resetsPerPuzzle}</strong><span>Resets per solve</span></div></div><div className="stats-section"><h3>Difficulty feedback</h3><p>Too easy: {stats.feedback.easy} · Just right: {stats.feedback.balanced} · Too hard: {stats.feedback.hard}</p><p className="stats-note">Your analytics are stored locally in this browser. No account or network connection is needed.</p></div><button className="stats-close" onClick={()=>setShowStats(false)}>Back to puzzle</button></section></div>}
      {toast&&<div className="toast" role="status">{toast}</div>}
    </main>
  );
}

export default App;
