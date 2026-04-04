# FlowCanvas

`FlowCanvas` is the interactive React Flow surface and editor shell for the canvas module.

## Purpose

- Establish a real node-based workspace inside the canvas area.
- Provide a stable integration point for future editor tools, overlays, and canvas state.
- Keep React Flow setup local to the canvas feature instead of spreading it through `App.tsx`.

## Owned State

- Controlled canvas-object `nodes` state via `useNodesState`.
- Controlled `edges` state via `useEdgesState`.
- Pointer-driven draft state during click-and-drag object creation.
- Selected-object ids and the active inline-editing target.
- Local minimap visibility state for hiding and restoring the minimap block.

## Props

- `className`: optional wrapper styling hook for layout integration.
- `overlay`: optional React node rendered above the flow surface for canvas-only controls such as toolbars.
- `activeTool`, `toolLocked`, and `editorDefaults`: editor controls passed down from the parent shell.
- `onActiveToolChange`: callback used for switching back to selection mode after primitive placement.

## Dependencies

- `@xyflow/react` for the graph surface, panels, minimap, controls, and background.
- Shared canvas-object schema from `../primitives/` for tool metadata, defaults, inspector config, and node creation helpers.
- Local `styles.css` for component-scoped React Flow theming.
- Project tokens from `index.css` for visual consistency with the rest of the frontend.

## Integration Notes

- Import with `import { FlowCanvas } from "@/components/canvas/flow-canvas"`.
- Pass canvas overlays through `overlay` rather than positioning them in `App.tsx`.
- Keep editor-specific node types in this module unless they become reusable across multiple canvas features.
- Dragging on the empty pane while a creation tool is active creates a draft object, previews its bounds, and commits it on pointer release.
- A floating inspector is anchored to a single selected object and edits it without embedding property menus inside the node renderers.

## Known Limits

- Initial objects are still seeded mock content.
- The component does not persist flow state yet.
- Shape, text, and sticky-note creation are wired; line/arrow/draw/image remain future work.
