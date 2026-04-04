# NodeConnectionHandles

## Purpose

- Render connectable edge handles for each canvas node.
- Keep handle visibility and connection-state behavior consistent across shape, text, and sticky-note nodes.

## Owned State

- No local state.
- Reads the active React Flow connection state via `useConnection`.

## Props

- `nodeId`: current node id used to detect whether another node is being targeted.
- `isConnectable`: inherited React Flow connectability flag.
- `selected`: shows handles for the currently selected node.
- `hidden`: omits handles for draft nodes.

## Dependencies

- `@xyflow/react` for `Handle`, `Position`, and `useConnection`.
- `cn` from `@/lib/utils` for conditional classes.

## Integration Notes

- Intended for custom node renderers that already participate in `ReactFlow` connection state.
- Works with `connectionMode={ConnectionMode.Loose}` so any side handle can start or complete a connection.

## Known Limits

- Handles are fixed to the four cardinal sides.
