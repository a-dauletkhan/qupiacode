# ShapesToolbar

`ShapesToolbar` is the centered control surface for canvas tool selection and creation defaults.

## Purpose

- Renders a floating island toolbar for shape and drawing tool selection.
- Lives under the canvas feature because it is specific to the drawing surface.
- Uses local shadcn-style primitives for buttons, menus, and sliders instead of source HTML.

## Current Behavior

- Receives active tool, tool lock, and editor-default settings through explicit props.
- Keeps local hint visibility state so the onboarding message can fade after interaction.
- Exposes tool-specific creation defaults through a local dropdown menu.
- Exposes a `className` prop so parent canvas layouts can position it without editing internals.
- Enables shape, text, and sticky-note creation while leaving the unsupported tools disabled.

## Files

- `index.tsx`: component logic and markup
- `styles.css`: component-scoped Tailwind v4 CSS using `@reference "../../../index.css"`

## Integration Notes

- Import with `import { ShapesToolbar } from "@/components/canvas/shapes-toolbar"`.
- Render it inside canvas-specific layouts rather than generic app wrappers.
- Keep toolbar state outside the component so backend-driven schema or editor stores can replace local app state without rewriting the toolbar internals.

## Known Limits

- Arrow, line, draw, image, and eraser remain disabled placeholders.
- Color defaults are still lime-biased until a richer creation-preset system is added.
