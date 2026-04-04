# ShapesToolbar

`ShapesToolbar` is a presentational drawing-tool toolbar inspired by the capture in `task.md`.

## Purpose

- Renders a floating "island" toolbar for shape and drawing tool selection.
- Matches the captured visual language: white surface, compact icon buttons, subtle dividers, keybinding chips, and a hint bubble.
- Uses the local shadcn-style `Button` primitive and `lucide-react` icons instead of copying source HTML.

## Current Behavior

- Keeps local UI state for:
  - active tool selection
  - lock toggle state
- Exposes a `className` prop so parent layouts can position it without editing internals.
- Does not integrate with a real canvas or editor model yet.

## Files

- `index.tsx`: component logic and markup
- `styles.css`: component-scoped Tailwind v4 CSS using `@reference "../../index.css"`

## Integration Notes

- Import with `import { ShapesToolbar } from "@/components/shapes-toolbar"`.
- Render it inside a larger canvas/content container rather than attaching it globally.
- If the app later gets a real editor store, lift `activeTool` and `toolLocked` into props or shared state.

## Known Limits

- Hint behavior is inferred from the capture and currently uses a single generic message.
- "More tools" is visual only and has no menu implementation.
- Icons are approximate equivalents from `lucide-react`, not source-extracted SVGs.
