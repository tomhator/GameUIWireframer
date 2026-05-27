# GameUIWireframer Project Notes

## Purpose

GameUIWireframer is a local React web app for designing game UI wireframes that are easy for both humans and AI agents to understand. The app stores semantic intent rather than only visual shapes: examples include `player_hp`, `status_effect_list`, and `skill_bar` with bindings and interactions.

## Stack

- React + TypeScript + Vite
- YAML export via `yaml`
- Icons via `lucide-react`

## Common Commands

```bash
npm install
npm run dev -- --host 127.0.0.1
npm run build
```

The dev app runs at `http://127.0.0.1:5173/` by default.

## Current MVP

- Editor-first UI with top bar, left component palette, central scaled 1920x1080 canvas, and right properties panel
- Default `combat_hud` sample
- Component add, select, drag move, and property editing
- YAML export for `design.yaml`, `tokens.yaml`, and `flows.yaml`

## Important Files

- `src/App.tsx`: editor UI and interaction logic
- `src/types.ts`: semantic UI component schema
- `src/sampleData.ts`: default sample HUD, tokens, and flows
- `src/exporters.ts`: YAML serialization and download helpers
- `src/styles.css`: tool UI styling

## Known Gaps

- `preview.png` export is not implemented
- No undo/redo yet
- No resize handles on canvas
- No YAML import yet
- State and interaction editing are intentionally minimal

## Repository

Remote: `https://github.com/tomhator/GameUIWireframer.git`
Default branch: `main`
