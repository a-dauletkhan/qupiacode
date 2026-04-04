# Canvas Module

This module contains canvas-specific UI components and supporting documentation.

## Purpose

- Keep drawing-surface components grouped by feature instead of scattering them across shared component directories.
- Provide a stable home for future canvas tools, overlays, and editor-specific controls.

## Current Components

- `flow-canvas/`: interactive React Flow surface for the main canvas workspace.
- `shapes-toolbar/`: floating tool-selection toolbar for the canvas surface.

## Guidance

- Put canvas-only UI here, even if it reuses shared `ui/` primitives.
- Keep generic primitives out of this module.
- Add a local `README.md` for each multi-file component.
