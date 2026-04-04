# AppSidebar

`AppSidebar` is the app-level right sidebar composition used by the main workspace layout.

## Purpose

- Wraps the local sidebar container and composes two vertically resizable panels.
- Keeps app layout concerns out of the low-level `ui/sidebar` primitive.

## Owned State

- None. It is currently presentational and forwards sidebar props to the underlying sidebar component.

## Props

- Accepts `React.ComponentProps<typeof Sidebar>`.
- Intended to receive placement and collapsibility configuration from the app shell.

## Dependencies

- `@/components/ui/sidebar`
- `@/components/ui/resizable`

## Integration Notes

- Use this in top-level workspace layouts, not as a generic reusable primitive.
- Replace placeholder panel content with real sidebar modules as the app grows.

## Known Limits

- Current top and bottom sections are placeholders.
- No domain-specific data or actions are wired yet.
