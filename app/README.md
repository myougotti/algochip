# AlgoChip app

The production Vite + React app. See the [repo root README](../README.md) for what AlgoChip is and how it works.

## Commands

```bash
npm install      # once
npm run dev      # dev server with HMR (usually http://localhost:5173)
npm run build    # production build to dist/
npm run preview  # serve the production build locally
npm run lint     # eslint
npm run verify   # check all 8 generators sort correctly + applyStep replay equivalence
```

## Layout

- `src/AlgoChip.jsx` — the UI: Big-O table, race controls, canvas animation loop
- `src/sortSteps.js` — pure algorithm code: seeded PRNG, the 8 sort-step generators, and the `applyStep` replay reducer (no React; runs in plain Node)
- `src/App.jsx` — renders `<AlgoChip />`
- `src/index.css` — single Tailwind v4 import; the plugin is registered in `vite.config.js`

Deploys to GitHub Pages via `.github/workflows/deploy.yml` on every push to `main` (built with `--base=/algochip/`).
