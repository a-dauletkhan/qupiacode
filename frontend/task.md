/senior-frontend

## Task
- Rebuild this as a clean, production-ready component that fits the destination codebase's existing stack, styling approach, and conventions.
- Match the current layout, spacing, typography, colors, radii, and visual hierarchy as closely as possible.
- Use the captured HTML and resolved CSS as implementation reference, not as production code to copy verbatim.
- Treat the framework and styling detections below as source-side hints only; do not assume the destination stack should match them.
- Make the result responsive using judgment; this capture only reflects one breakpoint.
- Avoid hardcoding content-driven computed widths unless they are required for the layout.
- Call out any behavior, assets, or states that cannot be inferred from this capture.
- Use the captured CSS below as the component-specific styling reference (1 CSS rules kept after pruning).

## HTML
```html
<div class="canvas-sticky-content">hello world</div>
```

## CSS
```css
.canvas-sticky-content {
  width: 681.828px;
  height: 543.352px;
  padding: 16px 68px 16px 16px;
  overflow: hidden;
  color: oklch(0.145 0 0);
  font-family: "Geist Variable", sans-serif;
  font-size: 20px; /* was: var(--sticky-note-font-size) */
  line-height: 21px;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}
```