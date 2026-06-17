# Multi-pet rendering fixes & refactor — design

Date: 2026-06-17

## Context

Manual QA on the just-implemented multi-pet rendering branch (part 2 of the 4-part
multi-pet feature) surfaced two real issues, and the session surfaced three process
gaps. This is a single, combined pass to close all of them before merging part 2.

## 1. Bug: window doesn't grow during a live drag

Today, `App.tsx`'s window-fit effect only sees a pet's *committed* `layout` position.
While a pet is mid-drag, `PetSlot` tracks the live offset purely as local state (never
bubbled up), so if the drag pushes the sprite past the current window edge, it gets
visually clipped until the drop commits a new position and the window catches up.

**Fix:** `PetSlot` reports live drag offsets to `App.tsx` (a new `onDragLive(dx, dy)`
callback, fired from the same place `usePetDrag`'s `onDragMove` already fires
internally — alongside the existing local `setLiveOffset`, not replacing it).
`App.tsx` keeps this in a small transient `dragLive: { speciesId, dx, dy } | null`
state, used **only** to widen the rect fed into the window-fit effect's bounds
calculation — it is never written to `layout` or persisted. On drop, `dragLive` is
cleared (the existing `onDrop`/`handleDrop` flow, already correct, takes over and
commits the real position via `resolveDropPosition`).

## 2. Bug/decision: 펫상태 panel position

Today the panel is centered at the window's top edge regardless of which pet is
focused — an explicit simplification from part 2's plan. Live testing showed this
reads as "broken" (the panel doesn't track the pet it describes).

**Fix:** position the panel directly above the *focused* pet's actual on-screen rect
(the same `rects`/`originOffset` math `App.tsx` already computes for window-fit),
instead of `left: 50%` window-centering. If the focused pet has no resolved
position/size yet (e.g. first frame), fall back to centered — same as today.

## 3. Component test infrastructure (starting point, not full coverage)

Add `@testing-library/react`, `@testing-library/jest-dom`, and `jsdom` as
devDependencies. Vitest's config currently sets `environment: "node"` globally
(correct for the existing pure-logic tests) — switch component test files to
`jsdom` via a per-file `// @vitest-environment jsdom` pragma comment rather than a
global config change, so the existing 87 pure-logic tests keep their faster `node`
environment unchanged.

Scope for this pass: cover the two riskiest pieces of logic this branch touches,
not the whole UI:
- `PetSlot`'s `onContextMenu` handler genuinely calls `preventDefault`/
  `stopPropagation` and invokes the callback with no other side effect (render it
  standalone with React Testing Library, fire a contextmenu event, assert).
- The extracted `useAppState` hook's `evolveAction`/`resetAction` (see #4) correctly
  sync `displayForm` — this is exactly the class of bug that shipped past review
  last time, and is now mechanically testable since the hook is a unit on its own.

## 4. Extract `App.tsx` state into `useAppState`

`App.tsx` accumulated 9 pieces of state (`appData`, `layout`, `sizes`, `oneShots`,
`focusedSpeciesId`, `evolvingSpeciesId`, `resizing`, `showStatus`, `evoPhase`) plus
several refs and the load/tick/persist effects. Extract all of it into
`src/pet/useAppState.ts`, a hook returning `{ appData, layout, sizes, oneShots,
focusedSpeciesId, evolvingSpeciesId, resizing, showStatus, evoPhase, feedAction,
evolveAction, resetAction, toggleStatus, showMenu, handleDrop, handleDragLive,
setSizes, setResizing }` (exact shape finalized in the implementation plan).
`App.tsx` itself shrinks to: call the hook, compute render-only derived values
(`rects`, `originOffset`), and return JSX. No behavior change — this is a pure
extraction, done before adding tests in #3 so the new tests target the hook
directly (a hook is much easier to unit-test than a full component).

## Out of scope

- Parts 3 (Dex UI) and 4 (펫추가/선택/숨기기 menu items) of the multi-pet feature —
  unchanged, not started.
- Full component test coverage of every existing component (`Pet.tsx`,
  `StatusPanel.tsx`, etc.) — only the two items named in #3 for this pass.
- Any change to the evolution window-grow/restore choreography (`evolve_grow`/
  `evolve_restore`) — unrelated to the drag-live-resize bug, which is about the
  window-fit *effect*, not the evolution-specific resize path.
