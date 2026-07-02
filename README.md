# AlgoChip

Big-O reference plus sort race. A single-page React app that pairs an algorithm complexity cheat sheet with a head-to-head sorting visualizer.

**Live demo:** https://myougotti.github.io/algochip/

## Features

- **Big-O reference table**: 26 algorithms across 8 categories (Sort, Search, Graph, Tree, Hash, Heap, String, DP) with best, average, worst, and space complexity plus practical notes
- **Live search**: filters by name or category on every keystroke
- **Sortable columns**: click any header to toggle ascending and descending
- **Sort race**: pick any two of 8 sorting algorithms and watch them race on identical data, rendered as animated bar charts on twin canvases at about 30 fps
- **Step counters**: each side tracks total steps and reports "Done in N steps" on finish, making asymptotic differences concrete
- **Deterministic shuffle**: arrays come from a seeded PRNG (Mulberry32), so the same seed always produces the same race
- **Stop button**: interrupt a race mid-flight and inspect the partial state
- **Dark mode**: full theme toggle including canvas colors

## Tech stack

- React 19 with hooks only, no state library
- Tailwind CSS v4 via the Vite plugin
- HTML Canvas for the race animation
- Vite for dev and build
- Zero runtime dependencies beyond React

## Repo structure

- `app/` — the production Vite + React app. Open this folder for active development.
- `iterations/` — the prompt-engineered iterations (`AlgoChip.jsx` is the seed-prompt output, `AlgoChip_1..6.jsx` the follow-ups; `_6` is the version that became `app/src/AlgoChip.jsx`), plus the seed and follow-up prompts. Kept as a record of how the design evolved from a claude.ai artifact into this app.

## Getting started

```bash
git clone https://github.com/myougotti/algochip.git
cd algochip/app
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`).

## How the race works

Each sorting algorithm is implemented as a JavaScript generator that yields one step object per operation:

```js
{ type: "compare" | "swap" | "set", i, j, snapshot }
```

- `compare(i, j)` reads two positions, no mutation
- `swap(i, j)` exchanges two positions (bubble, insertion, selection, quick, heap)
- `set(i, value)` overwrites one position from a temp buffer (merge, counting, radix, which do not sort by pairwise swaps)

The animation loop pulls one step per side per frame using `requestAnimationFrame`, throttled to about 30 fps by elapsed time rather than frame skipping. Each yielded snapshot is painted directly to its canvas. Snapshots live in refs, not React state, so the loop never forces 30 re-renders per second; only the step counters and statuses go through state.

A standalone `applyStep(arr, step)` reducer can replay any step sequence onto a base array. Both paths (snapshot and reducer) produce identical sorted output for all 8 algorithms — checked by `npm run verify` (`app/scripts/verify-sorts.mjs`), which also reproduces the step-count table below.

### Step counts on the default seed (1337, n = 30)

| Algorithm | Steps | Compares | Swaps/Sets |
|---|---|---|---|
| Counting Sort | 60 | 30 | 30 |
| Radix Sort | 120 | 60 | 60 |
| Quick Sort | 207 | 150 | 57 |
| Merge Sort | 254 | 106 | 148 |
| Heap Sort | 326 | 203 | 123 |
| Insertion Sort | 452 | 240 | 212 |
| Selection Sort | 460 | 435 | 25 |
| Bubble Sort | 646 | 434 | 212 |

Try Counting vs Bubble for the most dramatic gap, or Merge vs Heap for a close O(n log n) matchup.

## Design decisions

- **Generators over precomputed step arrays**: algorithm code reads like the textbook version, and memory stays proportional to one step rather than the whole run
- **Seeded PRNG over `Math.random`**: races are reproducible, which makes step counts verifiable claims instead of anecdotes
- **Conditional classes over Tailwind `dark:` variant**: theme is driven by a `t(light, dark)` helper so the component works without a Tailwind dark-mode config
- **Bar heights normalized to a fixed max (100)** rather than the array max, so both canvases stay visually comparable and the scale never jumps between shuffles

## Roadmap

- Highlight the active `i` and `j` indices on each frame in a contrasting color
- Complexity-aware column sorting (parse Big-O strings into a rank instead of lexicographic order)
- Separate compare and swap counters per side
- Adjustable array size and speed
- HiDPI canvas scaling via `devicePixelRatio`

## License

MIT
