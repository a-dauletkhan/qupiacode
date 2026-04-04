# CanvasObjectInspector

`CanvasObjectInspector` is the floating per-object property editor for the canvas surface.

## Purpose

- Attach a compact inspector to the currently selected canvas object.
- Keep property editing outside node renderers so view state stays separate from serializable object data.

## Current Behavior

- Opens only for a single selected object.
- Renders controls from schema metadata instead of hardcoded per-screen conditionals.
- Supports shape, text, and sticky-note property editing.

## Known Limits

- Multi-select editing is not implemented.
- The inspector currently edits one object at a time with immediate local updates only.
