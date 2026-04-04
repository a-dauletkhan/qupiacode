# ThemeProvider

`ThemeProvider` manages application theme state and applies the resolved theme class to the document root.

## Purpose

- Stores and restores the selected theme from local storage.
- Resolves `system`, `light`, and `dark` theme modes.
- Applies the resulting class to the root element and supports keyboard toggling.

## Owned State

- current theme
- theme setter exposed through context
- mobile or storage listeners needed to keep theme state in sync

## Props

- `children`
- `defaultTheme`
- `storageKey`
- `disableTransitionOnChange`

## Dependencies

- React context and effects only.
- No external theme library dependency.

## Integration Notes

- Mounted once near the app root in `main.tsx`.
- Current default theme is dark to match the project surface palette.
- Keyboard `d` toggles dark and light mode when focus is not in an editable field.

## Known Limits

- No visible theme switcher UI is implemented yet.
- Theme state is global rather than route or workspace scoped.
