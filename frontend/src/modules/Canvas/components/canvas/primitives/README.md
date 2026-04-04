# Primitive Schema

This module centralizes canvas object schema, editor-facing metadata, inspector definitions, and seeded mock data.

## Purpose

- Keep canvas object definitions separate from React Flow rendering code.
- Make toolbar options and node creation depend on shared schema instead of duplicated literals.
- Provide a stable place to evolve toward backend-driven primitive payloads.

## Files

- `schema.ts`: shared object types, tool metadata, defaults, and node factory helpers.
- `inspector-schema.ts`: selected-object inspector configuration and property-application helpers.
- `mock-data.ts`: seeded canvas objects for the current canvas demo state.

## Integration Notes

- `ShapesToolbar` consumes tool metadata and creation defaults from this module.
- `FlowCanvas` uses the node factory helpers so draft objects and committed objects share the same schema.
- If the backend starts returning primitive definitions, adapt this module first and keep the UI layers thin.

## Known Limits

- The seeded mock data is still local and static.
- Arrow, line, draw, image, and eraser tools are still placeholders.
