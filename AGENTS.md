# AGENTS.md

This file is a fast orientation guide for coding agents working in this repo.

## Project At A Glance

- App: Transformation Studio (single-page React app).
- Stack: React 19 + TypeScript + Vite.
- Rendering: WebGL2 shader pipeline (inverse mapping) for image warps.
- State: central reducer store with undo/redo history.
- Scope: frontend-only, no backend/API.

## Runbook

- Install: `npm install`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Unit tests: `npm test`
- Build: `npm run build`
- E2E (optional): `npm run test:e2e`

Before finishing changes, run at least:
1. `npm run lint`
2. `npm run build`
3. `npm test`

## Important Files

- App shell/composition:
  - `src/App.tsx`
  - `src/styles/app.css`
- State + actions + undo/redo:
  - `src/state/editorStore.tsx`
- Transform math/model/status/runtime conversion:
  - `src/math/transformEval.ts`
  - `src/math/matrix.ts`
  - `src/math/complex.ts`
  - `src/types/transforms.ts`
- WebGL renderer + shaders:
  - `src/render/webgl/Renderer.ts`
  - `src/render/webgl/shaders/warp.vert.glsl`
  - `src/render/webgl/shaders/warp.frag.glsl`
- UI:
  - `src/ui/TopToolbar.tsx`
  - `src/ui/LeftSidebar.tsx`
  - `src/ui/MatrixPanel.tsx`
  - `src/ui/CanvasViewport.tsx`
  - `src/ui/ManipulatorOverlay.tsx`
  - `src/ui/RightSidebar.tsx`
  - `src/ui/TransformList.tsx`
- Tests:
  - `tests/unit/transformEval.test.ts`
  - `tests/unit/categoryLift.test.ts`

## Architecture Notes

### 1) Step Ordering And Composition

- `state.steps` is stored newest-first (top of right sidebar first).
- UI right stack is top = newest, bottom = oldest.
- Composition for rendering must still respect chronological application.
- `CanvasViewport` currently calls `toRuntimeSteps([...steps].reverse())` to feed runtime steps oldest->newest.
- Shader inverse mapping loops from end to start, so do not casually change list ordering without re-validating composition.

### 2) Coordinate/Sign Conventions (High Risk)

This app has non-trivial y-axis conventions between UI and shader space.

- World bounds are computed in `CanvasViewport` with aspect correction and global scale:
  - `WORLD_SCALE = 2` (visible range doubled from old `[-1,1]` baseline).
- Shader (`warp.frag.glsl`) also applies aspect correction and multiplies world by `2.0`.
- Manipulator overlay receives identical `worldBounds` and maps pointer->world from that.

#### Critical affine/projective sign rule

Do not "simplify" these without full end-to-end validation:

- Affine inverse runtime (`stepToRuntimeInverse`):
  - `tx = -(inv00 * tx + inv01 * ty)`
  - `ty =  (inv10 * tx + inv11 * ty)`
- Affine -> Projective lift (`liftStepToCategory`):
  - Projective `h[5]` stores `-(affine.ty)`

These two pieces must stay consistent to avoid vertical translation flips when switching category.

### 3) Tool Defaults

From `createInitialPayload`:

- Translate default: `(tx, ty) = (1, 0)` (distance 1)
- Circle inversion default radius: `1` (stored as `b.re = radius^2 = 1`)
- Scale default: `1`
- Shear default: `0.35`
- Rotate default: `pi/8`
- Mirror default line: `y = x`

### 4) "Define" vs "Custom"

- Internal tool kind remains `define`.
- User-facing label should be `Custom`.
- Current places updated:
  - `toolLabel('define')` in `transformEval.ts`
  - label generation in `editorStore.tsx`
  - left sidebar buttons via `toolLabel(...)`

Do not rename the enum/tool kind unless you migrate all data/state/tests.

### 5) Right Sidebar Reordering

- Implemented in `TransformList.tsx` with pointer-based drag (not native HTML5 DnD).
- Uses optimistic local order (`dropOrderIds`) and release transition suppression (`releaseNoTransition`) to reduce release artifacts.
- This area is sensitive; if you change reorder behavior, validate up/down moves and release smoothness manually.

## UI/Behavior Requirements Currently Implemented

- Top toolbar: upload, square grid toggle, polar grid toggle, previous versions toggle.
- Undo/redo buttons are intentionally removed from toolbar.
- Keyboard shortcuts still active in `App.tsx`:
  - `Cmd/Ctrl+Z` undo
  - `Cmd/Ctrl+Shift+Z` redo
- Left sidebar:
  - tool groups at top
  - matrix/equation panel anchored to bottom with its own scroll
- Right sidebar:
  - step cards, selectable, reorderable, deletable

## Linting Constraints To Respect

The ESLint setup is strict about hooks usage:

- Avoid reading refs during render (`react-hooks/refs`).
- Avoid direct synchronous `setState` in effects (`react-hooks/set-state-in-effect`).

If you need to update state from setup effects, use event callbacks/observers or deferred async callbacks when appropriate.

## Testing Guidance

When touching math/category logic, update/add unit tests in:

- `tests/unit/transformEval.test.ts`
- `tests/unit/categoryLift.test.ts`

For UI drag/list interactions, manual verification is important in addition to tests.

## Practical Edit Checklist

1. Identify whether change affects:
   - step ordering,
   - y-sign conventions,
   - category lifting,
   - runtime inverse conversion.
2. If yes, run targeted manual checks:
   - translation direction in affine,
   - same result after affine->projective lift,
   - reorder stack and verify composition.
3. Run `lint`, `build`, and `test` before handoff.

