# FlowCanvas

`FlowCanvas` is the interactive React Flow surface for the canvas module.

## Purpose

- Establish a real node-based workspace inside the canvas area.
- Provide a stable integration point for future editor tools, overlays, and canvas state.
- Keep React Flow setup local to the canvas feature instead of spreading it through `App.tsx`.

## Owned State

- Controlled `nodes` state via `useNodesState`.
- Controlled `edges` state via `useEdgesState`.
- Edge creation through the local `onConnect` handler.
- Local minimap visibility state for hiding and restoring the minimap block.

## Props

- `className`: optional wrapper styling hook for layout integration.
- `overlay`: optional React node rendered above the flow surface for canvas-only controls such as toolbars.

## Dependencies

- `@xyflow/react` for the graph surface, panels, minimap, controls, and background.
- Local `styles.css` for component-scoped React Flow theming.
- Project tokens from `index.css` for visual consistency with the rest of the frontend.

## Integration Notes

- Import with `import { FlowCanvas } from "@/components/canvas/flow-canvas"`.
- Pass canvas overlays through `overlay` rather than positioning them in `App.tsx`.
- Keep editor-specific node types in this module unless they become reusable across multiple canvas features.

## Known Limits

- Initial nodes and edges are seeded sample content.
- The component does not persist flow state yet.
- Toolbar actions are not connected to React Flow interactions yet.
