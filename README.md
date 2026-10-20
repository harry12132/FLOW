# FLOW

A calm, tactile connect-the-colours puzzle game built with React and Vite.

## Run locally

```bash
npm install
npm run dev
```

## Play

Drag from a coloured endpoint to its matching endpoint. Paths move orthogonally, cannot cross other paths, and the goal is to fill every cell. The game includes an endless level sequence, saved progress, hints, restart, sound effects and a daily board.

## Puzzle generation

Each generated board is built from a complete board-covering route, partitioned into colour paths. This guarantees that every generated board has at least one valid solution. Grid size and number of colour pairs increase over time, with a cap on board size. The route generator uses a randomized Warnsdorff-style search with a deterministic serpentine fallback.

## Notes

- Progress is stored locally in the browser.
- The daily challenge is seeded by the current date.
- No account, server, paid assets or external game engine is required.
