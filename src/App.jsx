import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.012);
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
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#" onClick={(e) => { e.preventDefault(); installLevel(1); }}>
          <span className="logo-mark"><i /><i /><i /><i /></span>
          <span>flow<span className="wordmark-period">.</span></span>
        </a>
        <div className="top-actions">
          <button className="icon-button sound-button" onClick={() => setSound(v => !v)} aria-label={sound ? 'Turn sound off' : 'Turn sound on'} title={sound ? 'Sound on' : 'Sound off'}>
            {sound ? <svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg> : <svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/></svg>}
          </button>
          <button className="avatar-button" onClick={() => setShowMenu(v => !v)} aria-label="Open game menu">H</button>
        </div>
      </header>

      <section className="game-layout">
        <aside className="side-panel">
          <div className="eyebrow"><span className="live-dot" /> YOUR DAILY PAUSE</div>
          <h1>A little<br />space to <em>think.</em></h1>
          <p className="intro">Connect the colours. Fill the board. Find your flow.</p>
          <div className="level-card">
            <div className="level-label">{daily ? 'DAILY CHALLENGE' : 'CURRENT LEVEL'}</div>
            <div className="level-number">{daily ? 'TODAY' : String(level).padStart(3, '0')}</div>
            <div className="level-meta"><span>{puzzle.size} × {puzzle.size} grid</span><span className="meta-separator">·</span><span>{puzzle.segments.length} colours</span></div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            <div className="progress-caption"><span>{filled} of {total} cells</span><span>{progress}%</span></div>
          </div>
          <div className="stats-row">
            <div className="stat"><span className="stat-value">{Math.max(0, best - 1)}</span><span className="stat-label">BEST LEVEL</span></div>
            <div className="stat-divider" />
            <div className="stat"><span className="stat-value">{solvedCount}<span className="stat-total">/{puzzle.segments.length}</span></span><span className="stat-label">PATHS FOUND</span></div>
          </div>
          <div className="controls">
            <button className="primary-button" onClick={reset}><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/></svg>Start over</button>
            <button className="secondary-button" onClick={useHint}><svg viewBox="0 0 24 24"><path d="M9 18h6m-5 3h4m-2-19a7 7 0 0 0-4 12.7c.6.4 1 1.1 1 1.8h6c0-.7.4-1.4 1-1.8A7 7 0 0 0 12 2Z"/></svg>Hint <span className="hint-count">{hints}</span></button>
          </div>
          <button className="daily-link" onClick={() => installLevel(level, true)}><span className="calendar-icon">✳</span><span><strong>Daily challenge</strong><small>A fresh board, every day</small></span><span className="arrow">↗</span></button>
          <p className="quiet-note">No timer. No pressure.<br />Just you and the puzzle.</p>
        </aside>

        <section className="board-column">
          <div className="board-heading">
            <div><span className="board-kicker">PUZZLE {daily ? 'OF THE DAY' : String(level).padStart(3, '0')}</span><h2>{won ? 'Beautifully done.' : 'Find the connections.'}</h2></div>
            <div className="board-tools"><span className="difficulty"><i />{level < 8 ? 'Warming up' : level < 25 ? 'Getting tricky' : level < 55 ? 'Brain at work' : 'Deep focus'}</span><button className="tiny-button" onClick={() => { setShowMenu(v => !v); }} aria-label="More options">•••</button></div>
          </div>

          <div className={`board-frame ${won ? 'is-won' : ''}`} ref={boardRef}>
            <div className="board-inner" style={{ '--size': puzzle.size }}>
              <svg className="path-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Puzzle paths">
                {pathPoints.map(({ segment, path }) => <g key={segment.id}>
                  <path className="path-shadow" d={pathD(path)} stroke={segment.color} />
                  <path className="path-line" d={pathD(path)} stroke={segment.color} />
                </g>)}
              </svg>
              <div className="cell-grid" style={{ gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 1fr))` }}>
                {grid.map(point => {
                  const endpoint = isEndpoint(point);
                  const owner = Object.entries(paths).find(([, path]) => path.some(p => same(p, point)));
                  const color = endpoint?.color || (owner ? puzzle.segments.find(s => s.id === Number(owner[0]))?.color : null);
                  const isHint = same(point, hintCell);
                  const isPathEnd = owner && paths[Number(owner[0])]?.at(-1) && same(paths[Number(owner[0])].at(-1), point);
                  return <div
                    key={cellId(point)}
                    data-cell={cellId(point)}
                    className={`cell ${endpoint ? 'endpoint-cell' : ''} ${owner ? 'has-path' : ''} ${isHint ? 'hint-cell' : ''} ${isPathEnd ? 'path-end' : ''}`}
                    onPointerDown={e => onCellPointerDown(e, point)}
                    onPointerEnter={() => onCellEnter(point)}
                    onPointerMove={e => { if (e.buttons === 1) onCellEnter(point); }}
                    style={{ '--path-color': color || 'transparent', borderRight: point.c === puzzle.size - 1 ? 0 : undefined, borderBottom: point.r === puzzle.size - 1 ? 0 : undefined }}
                  >
                    {endpoint && <span className="endpoint-dot" style={{ '--dot-color': endpoint.color }}><span /></span>}
                    {isHint && <span className="hint-pulse" />}
                  </div>;
                })}
              </div>
            </div>
            {won && <div className="win-confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</div>}
            {won && <div className="win-card"><span className="win-spark">✳</span><h3>Every path, found.</h3><p>You made room for every colour.</p><button className="primary-button" onClick={() => installLevel(level + 1)}>Next level <span>→</span></button><button className="text-button" onClick={() => installLevel(level + 1)}>Keep the flow going</button></div>}
          </div>

          <div className="board-footer">
            <div className="legend"><span className="legend-dot" />Drag from one dot to its match</div>
            <div className="footer-right"><span>{moves} {moves === 1 ? 'path' : 'paths'} completed</span><span className="footer-sep">/</span><span>{puzzle.size * puzzle.size - filled} open cells</span></div>
          </div>
          <div className="mobile-controls"><button className="secondary-button" onClick={reset}>↺ Restart</button><button className="primary-button" onClick={useHint}>Hint · {hints}</button></div>
        </section>
      </section>

      <footer className="bottom-bar"><span>MADE FOR THE IN-BETWEEN MOMENTS.</span><span>Take your time. <span className="footer-heart">♥</span></span><button onClick={() => notify('More puzzle modes are on the way.')}>ABOUT FLOW <span>↗</span></button></footer>

      {showMenu && <div className="menu-backdrop" onClick={() => setShowMenu(false)}><div className="menu-popover" onClick={e => e.stopPropagation()}><div className="menu-title">Make yourself at home</div><button onClick={() => installLevel(1)}>↗ <span>Start from level one</span></button><button onClick={() => installLevel(level, true)}>✳ <span>Play today's challenge</span></button><button onClick={() => { setSound(v => !v); setShowMenu(false); }}>♫ <span>{sound ? 'Turn sound off' : 'Turn sound on'}</span></button><p>Your progress is saved on this device.</p></div></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

export default App;
