import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LiquidGlass from 'liquid-glass-react';
import LiquidGlass from 'liquid-glass-react';
import { cellId, createEmptyPaths, generatePuzzle, getOccupied, isAdjacent, puzzleComplete } from './game.js';

const STORE = 'flow-save-v1';
const readSave = () => {
  try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; }
};
const same = (a, b) => a && b && a.r === b.r && a.c === b.c;

function App() {
  const initial = useMemo(() => readSave(), []);
  const [level, setLevel] = useState(Math.max(1, initial.level || 1));
  const [best, setBest] = useState(initial.best || 1);
  const [sound, setSound] = useState(initial.sound !== false);
  const [puzzle, setPuzzle] = useState(() => generatePuzzle(Math.max(1, initial.level || 1)));
  const [paths, setPaths] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [won, setWon] = useState(false);
  const [hints, setHints] = useState(3);
  const [hintCell, setHintCell] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [toast, setToast] = useState('');
  const [daily, setDaily] = useState(false);
  const [moves, setMoves] = useState(0);
  const boardRef = useRef(null);
  const pointerDown = useRef(false);
  const lastPointerCell = useRef(null);
  const audioRef = useRef(null);

  const occupied = useMemo(() => getOccupied(paths, activeId), [paths, activeId]);
  const filled = useMemo(() => Object.values(paths).reduce((n, p) => n + p.length, 0), [paths]);
  const total = puzzle.size * puzzle.size;
  const progress = Math.round((filled / total) * 100);

  useEffect(() => {
    localStorage.setItem(STORE, JSON.stringify({ level, best, sound }));
  }, [level, best, sound]);

  useEffect(() => {
    const stop = () => { pointerDown.current = false; setActiveId(null); };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

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
    const daySeed = Number(new Date().toISOString().slice(0, 10).replaceAll('-', ''));
    const next = generatePuzzle(nextLevel, isDaily ? daySeed : null);
    setLevel(nextLevel);
    setPuzzle(next);
    setPaths(createEmptyPaths(next));
    setActiveId(null);
    setWon(false);
    setHintCell(null);
    setMoves(0);
    setDaily(isDaily);
    setShowMenu(false);
  };

  const reset = () => {
    setPaths(createEmptyPaths(puzzle));
    setActiveId(null);
    setWon(false);
    setHintCell(null);
    setMoves(0);
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
    beep(500 + Math.min(5, next.length) * 35, 0.025);
    if (same(point, segment.end) || same(point, segment.start)) {
      pointerDown.current = false;
      setActiveId(null);
      setMoves(m => m + 1);
      const canonicalPath = same(point, segment.start) ? [...next].reverse() : next;
      setPaths(prev => {
        const completed = { ...prev, [segmentId]: canonicalPath };
        const done = puzzleComplete(puzzle, completed);
        if (done) {
          setWon(true);
          setBest(b => Math.max(b, level + 1));
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

  const useHint = () => {
    if (hints <= 0 || won) { notify(hints <= 0 ? 'No hints left' : 'Already solved'); return; }
    const segment = puzzle.segments.find(s => {
      const path = paths[s.id] || [];
      return path.length < s.solution.length || !same(path.at(-1), s.end);
    });
    if (!segment) return;
    const current = paths[segment.id] || [];
    const nextPoint = segment.solution.find((p, i) => i >= current.length && !current.some(q => same(p, q)));
    setHintCell(nextPoint || segment.solution[Math.min(current.length, segment.solution.length - 1)]);
    setHints(h => h - 1);
    notify('A little nudge');
    beep(680, 0.1);
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

  const pathD = (path) => path.map((p, i) => {
    const x = (p.c + 0.5) * 100 / puzzle.size;
    const y = (p.r + 0.5) * 100 / puzzle.size;
    return `${i ? 'L' : 'M'} ${x} ${y}`;
  }).join(' ');

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
        <h1 className="mb-2 text-center text-4xl font-medium tracking-[-0.075em] sm:text-5xl">{won?'Perfectly connected.':'Find your flow.'}</h1>
        <p className="mb-7 text-center text-sm text-white/45 sm:mb-9">{won?'Every colour. Every cell.':'Connect matching colours. Fill every cell.'}</p>
        <div className="board-glass relative w-full max-w-[590px] rounded-[30px] p-3 sm:p-4" ref={boardRef}>
          <div className={`board-inner relative aspect-square w-full overflow-hidden rounded-[20px] ${won?'board-won':''}`} style={{'--size':puzzle.size}} onPointerMove={event=>{if(pointerDown.current&&activeId!==null){const point=cellFromTarget(document.elementFromPoint(event.clientX,event.clientY));if(point)onCellEnter(point)}}}>
            <div className="board-glow"/>
            <svg className="path-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{pathPoints.map(({segment,path})=><g key={segment.id} className={activeId===segment.id?'active-path':''}><path className="path-halo" d={pathD(path)} stroke={segment.color}/><path className="path-line" d={pathD(path)} stroke={segment.color}/></g>)}</svg>
            <div className="cell-grid" style={{gridTemplateColumns:`repeat(${puzzle.size},minmax(0,1fr))`}}>{grid.map(point=>{
              const endpoint=isEndpoint(point),owner=Object.entries(paths).find(([,path])=>path.some(p=>same(p,point)));
              const color=endpoint?.color||(owner?puzzle.segments.find(s=>s.id===Number(owner[0]))?.color:null),isHint=same(point,hintCell),isPathEnd=owner&&paths[Number(owner[0])]?.at(-1)&&same(paths[Number(owner[0])].at(-1),point);
              return <div key={cellId(point)} data-cell={cellId(point)} className={`cell ${endpoint?'endpoint-cell':''} ${owner?'has-path':''} ${isHint?'hint-cell':''} ${isPathEnd?'path-end':''}`} onPointerDown={ev=>onCellPointerDown(ev,point)} style={{'--path-color':color||'transparent',borderRight:point.c===puzzle.size-1?0:undefined,borderBottom:point.r===puzzle.size-1?0:undefined}}>{endpoint&&<span className="endpoint-dot" style={{'--dot-color':endpoint.color}}><span/></span>}{isHint&&<span className="hint-pulse"/>}</div>
            })}</div>
          </div>
          {won&&<div className="win-overlay"><div className="win-orb">✦</div><h2 className="mt-4 text-2xl font-medium tracking-tight sm:text-3xl">Beautiful.</h2><p className="mt-2 text-sm text-white/55">You found every connection.</p><button className="next-button mt-6" onClick={()=>installLevel(level+1)}>Next puzzle <svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></button></div>}
        </div>
        <div className="mt-5 flex w-full max-w-[590px] items-center justify-between gap-4 px-1"><div className="flex min-w-0 flex-1 items-center gap-3"><div className="progress-track flex-1"><span style={{width:`${progress}%`}}/></div><span className="w-10 text-right text-xs tabular-nums text-white/50">{progress}%</span></div><button className="hint-button" onClick={useHint} disabled={won}><svg viewBox="0 0 24 24"><path d="M9 18h6m-5 3h4m-2-19a7 7 0 0 0-4 12.7c.6.4 1 1.1 1 1.8h6c0-.7.4-1.4 1-1.8A7 7 0 0 0 12 2Z"/></svg><span>Hint</span><span className="hint-number">{hints}</span></button></div>
        <div className="mt-4 flex items-center gap-2 text-[11px] tracking-wide text-white/30"><span className="status-dot"/>{solvedCount} of {puzzle.segments.length} paths connected</div>
      </section>
      <footer className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-5 pb-5 text-[10px] tracking-wide text-white/25 sm:px-8"><span>FLOW</span><span>{Math.max(0,best-1)} completed</span></footer>
      {showMenu&&<div className="menu-backdrop" onClick={()=>setShowMenu(false)}><div className="menu-glass" onClick={ev=>ev.stopPropagation()}><button onClick={()=>installLevel(1)}>Restart from level one</button><button onClick={()=>installLevel(level,true)}>Daily puzzle</button><button onClick={()=>{setSound(v=>!v);setShowMenu(false)}}>{sound?'Sound off':'Sound on'}</button><p>Progress saves automatically.</p></div></div>}
      {toast&&<div className="toast" role="status">{toast}</div>}
    </main>
  );
}

export default App;
