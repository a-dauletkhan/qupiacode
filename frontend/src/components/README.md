# Components Module

This module contains application-specific UI composition plus local wrappers around shadcn/ui primitives.

## Purpose

- `app-sidebar.tsx`: app-level sidebar composition using the local sidebar and resizable primitives.
- `theme-provider.tsx`: theme state and dark or light mode application.
- `shapes-toolbar/`: a documented feature component for the drawing toolbar UI.
- `ui/`: shared shadcn-style primitives and low-level building blocks.

## Documentation Convention

- Folder components keep a local `README.md`.
- Single-file components keep an adjacent `<name>.README.md`.
- This avoids file moves that create unnecessary branch merge conflicts.

## Extension Guidance

- Prefer building feature components from `ui/` primitives and local utilities.
- Keep app-specific orchestration outside `ui/`.
- When a component starts owning multiple files, move it into a folder and keep its `README.md` there.
