# ShapesToolbar

`ShapesToolbar` is a presentational drawing-tool toolbar for the canvas module.

## Purpose

- Renders a floating island toolbar for shape and drawing tool selection.
- Lives under the canvas feature because it is specific to the drawing surface.
- Uses the local shadcn-style `Button` primitive and `lucide-react` icons instead of source HTML.

## Current Behavior

- Keeps local UI state for active tool selection.
- Keeps local UI state for the tool-lock toggle.
- Exposes a `className` prop so parent canvas layouts can position it without editing internals.
- Does not integrate with a real canvas or editor model yet.

## Files

- `index.tsx`: component logic and markup
- `styles.css`: component-scoped Tailwind v4 CSS using `@reference "../../../index.css"`

## Integration Notes

- Import with `import { ShapesToolbar } from "@/components/canvas/shapes-toolbar"`.
- Render it inside canvas-specific layouts rather than generic app wrappers.
- If the app later gets a real editor store, lift `activeTool` and `toolLocked` into props or shared state.

## Known Limits

- Hint behavior is inferred from the capture and currently uses a single generic message.
- "More tools" is visual only and has no menu implementation.
- Icons are approximate equivalents from `lucide-react`, not source-extracted SVGs.
