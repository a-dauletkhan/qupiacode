/senior-frontend

## Task
- Rebuild this as a clean, production-ready component that fits the destination codebase's existing stack, styling approach, and conventions.
- Match the current layout, spacing, typography, colors, radii, and visual hierarchy as closely as possible.
- Use the captured HTML and resolved CSS as implementation reference, not as production code to copy verbatim.
- Treat the framework and styling detections below as source-side hints only; do not assume the destination stack should match them.
- Make the result responsive using judgment; this capture only reflects one breakpoint.
- Avoid hardcoding content-driven computed widths unless they are required for the layout.
- Call out any behavior, assets, or states that cannot be inferred from this capture.
- Use the captured CSS below as the component-specific styling reference (20 CSS rules kept after pruning).

## HTML
```html
<div role="article" id="cm_NT6p8o2679DrK-fCTEAA4" class="lb-root lb-comment lb-comment:indent-content lb-comment:show-actions-hover lb-thread-comment" aria-labelledby="cm_NT6p8o2679DrK-fCTEAA4:body" dir="ltr" tabindex="0" aria-posinset="1" aria-setsize="1" data-unread="">
  <div class="lb-comment-header">
    <div class="lb-comment-details">
      <div class="lb-avatar lb-comment-avatar">
        <span class="lb-avatar-fallback" aria-label="73fbe14f-0b19-42ec-8f9b-15fac862abea" title="73fbe14f-0b19-42ec-8f9b-15fac862abea">7</span>
      </div>
      <span class="lb-comment-details-labels">
        <span class="lb-name lb-user lb-comment-author">Anonymous</span>
        <span class="lb-comment-date">
          <time class="lb-date lb-comment-date-created" datetime="2026-04-04T23:04:45.697Z" title="4/5/2026, 4:04 AM">2m ago</time>
        </span>
      </span>
    </div>
    <div class="lb-comment-actions lb-thread-actions">
      <button type="button" class="lb-button lb-comment-action" data-variant="default" data-size="default" aria-label="Resolve thread" aria-pressed="false" data-state="closed">
        <span class="lb-icon-container">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="presentation" class="lb-icon">
            <circle cx="10" cy="10" r="7"></circle>
            <path d="m13 8-4 4-2-2"></path>
          </svg>
        </span>
      </button>
      <button type="button" class="lb-button lb-comment-action" data-variant="default" data-size="default" aria-label="Add reaction" aria-haspopup="dialog" aria-expanded="false" aria-controls="radix-_r_1i_" data-state="closed">
        <span class="lb-icon-container">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="presentation" class="lb-icon">
            <path d="M11 3.07A7 7 0 1 0 16.93 9"></path>
            <path d="M7.5 11.5S8.25 13 10 13s2.5-1.5 2.5-1.5M8 8h0"></path>
            <path d="M12 8h0"></path>
            <path d="M13 5h4m-2-2v4"></path>
            <circle cx="8" cy="8" r=".25"></circle>
            <circle cx="12" cy="8" r=".25"></circle>
          </svg>
        </span>
      </button>
      <button type="button" class="lb-button lb-comment-action" data-variant="default" data-size="default" aria-label="More" id="radix-_r_1k_" aria-haspopup="menu" aria-expanded="false" data-state="closed">
        <span class="lb-icon-container">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="presentation" class="lb-icon">
            <circle cx="5" cy="10" r="0.75"></circle>
            <circle cx="10" cy="10" r="0.75"></circle>
            <circle cx="15" cy="10" r="0.75"></circle>
          </svg>
        </span>
      </button>
    </div>
  </div>
  <div class="lb-comment-content">
    <div class="lb-comment-body" id="cm_NT6p8o2679DrK-fCTEAA4:body" style="white-space: break-spaces;">
      <p style="min-height: 1lh;">
        <span>@agent remove the ellipse</span>
      </p>
    </div>
  </div>
</div>
```

## CSS
```css
#cm_NT6p8o2679DrK-fCTEAA4 {
  position: relative;
  z-index: 0;
  padding: 16px;
  background-color: rgb(255, 255, 255);
  color: rgb(17, 17, 17); /* was: var(--lb-foreground) */
  font-family: "Geist Variable", sans-serif;
  line-height: 24px;
  overflow-wrap: break-word;
}

#cm_NT6p8o2679DrK-fCTEAA4 div.lb-comment-header {
  display: flex;
  position: relative;
  margin-bottom: 4px;
  gap: 12px;
  align-items: center;
}

#cm_NT6p8o2679DrK-fCTEAA4 div.lb-comment-details {
  display: flex;
  gap: 12px;
  align-items: center;
}

#cm_NT6p8o2679DrK-fCTEAA4 div.lb-avatar.lb-comment-avatar {
  display: flex;
  position: absolute;
  right: 360px;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  background-color: color(srgb 0.925333 0.925333 0.925333);
  border-radius: 50%;
  color: color(srgb 0.639111 0.639111 0.639111); /* was: var(--lb-foreground-moderate) */
}

#cm_NT6p8o2679DrK-fCTEAA4 span.lb-avatar-fallback {
  display: block;
  font-size: 9.8px;
  font-weight: 500;
  line-height: 14.7px;
  white-space: nowrap;
  user-select: none;
  pointer-events: none;
}

#cm_NT6p8o2679DrK-fCTEAA4 span.lb-comment-details-labels {
  display: flex;
  margin-left: 40px;
  gap: 8px;
  align-items: baseline;
}

#cm_NT6p8o2679DrK-fCTEAA4 span.lb-name.lb-user {
  display: block;
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

#cm_NT6p8o2679DrK-fCTEAA4 span.lb-comment-date {
  display: block;
  overflow: hidden;
  color: color(srgb 0.448296 0.448296 0.448296); /* was: var(--lb-foreground-tertiary) */
  font-size: 14px;
  line-height: 21px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

#cm_NT6p8o2679DrK-fCTEAA4 time.lb-date.lb-comment-date-created {
  display: contents;
}

#cm_NT6p8o2679DrK-fCTEAA4 div.lb-comment-actions.lb-thread-actions {
  display: flex;
  position: relative;
  margin-left: 104.047px;
  gap: 2px;
}

#cm_NT6p8o2679DrK-fCTEAA4 button.lb-button.lb-comment-action:nth-of-type(1) {
  display: flex;
  position: relative;
  padding: 4px;
  align-items: center;
  justify-content: center;
  background-color: rgb(255, 255, 255);
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
}

#cm_NT6p8o2679DrK-fCTEAA4 button.lb-button.lb-comment-action:nth-of-type(1) span.lb-icon-container,
#cm_NT6p8o2679DrK-fCTEAA4 button.lb-button.lb-comment-action:nth-of-type(2) span.lb-icon-container,
#cm_NT6p8o2679DrK-fCTEAA4 #radix-_r_1k_ span.lb-icon-container {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

#cm_NT6p8o2679DrK-fCTEAA4 button.lb-button.lb-comment-action:nth-of-type(1) span.lb-icon-container svg.lb-icon,
#cm_NT6p8o2679DrK-fCTEAA4 button.lb-button.lb-comment-action:nth-of-type(2) span.lb-icon-container svg.lb-icon {
  display: block;
  fill: none;
  stroke: color(srgb 0.639111 0.639111 0.639111);
  stroke-width: 1.5px;
  vertical-align: middle;
}

#cm_NT6p8o2679DrK-fCTEAA4 button.lb-button.lb-comment-action:nth-of-type(1) span.lb-icon-container svg.lb-icon circle,
#cm_NT6p8o2679DrK-fCTEAA4 button.lb-button.lb-comment-action:nth-of-type(1) span.lb-icon-container svg.lb-icon path,
#cm_NT6p8o2679DrK-fCTEAA4 button.lb-button.lb-comment-action:nth-of-type(2) span.lb-icon-container svg.lb-icon path:nth-of-type(1),
#cm_NT6p8o2679DrK-fCTEAA4 path:nth-of-type(2),
#cm_NT6p8o2679DrK-fCTEAA4 path:nth-of-type(3),
#cm_NT6p8o2679DrK-fCTEAA4 path:nth-of-type(4),
#cm_NT6p8o2679DrK-fCTEAA4 button.lb-button.lb-comment-action:nth-of-type(2) span.lb-icon-container svg.lb-icon circle:nth-of-type(1),
#cm_NT6p8o2679DrK-fCTEAA4 button.lb-button.lb-comment-action:nth-of-type(2) span.lb-icon-container svg.lb-icon circle:nth-of-type(2) {
  fill: none;
  stroke: color(srgb 0.639111 0.639111 0.639111);
  stroke-width: 1.5px; /* was: var(--lb-icon-weight) */
}

#cm_NT6p8o2679DrK-fCTEAA4 button.lb-button.lb-comment-action:nth-of-type(2),
#cm_NT6p8o2679DrK-fCTEAA4 #radix-_r_1k_ {
  display: flex;
  position: relative;
  padding: 4px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
}

#cm_NT6p8o2679DrK-fCTEAA4 #radix-_r_1k_ span.lb-icon-container svg.lb-icon {
  display: block;
  fill: color(srgb 0.639111 0.639111 0.639111);
  stroke: color(srgb 0.639111 0.639111 0.639111);
  stroke-width: 1.5px;
  vertical-align: middle;
}

#cm_NT6p8o2679DrK-fCTEAA4 #radix-_r_1k_ span.lb-icon-container svg.lb-icon circle:nth-of-type(1),
#cm_NT6p8o2679DrK-fCTEAA4 #radix-_r_1k_ span.lb-icon-container svg.lb-icon circle:nth-of-type(2),
#cm_NT6p8o2679DrK-fCTEAA4 circle:nth-of-type(3) {
  fill: color(srgb 0.639111 0.639111 0.639111);
  stroke: color(srgb 0.639111 0.639111 0.639111);
  stroke-width: 1.5px; /* was: var(--lb-icon-weight) */
}

#cm_NT6p8o2679DrK-fCTEAA4 div.lb-comment-content {
  padding-left: 40px;
}

#cm_NT6p8o2679DrK-fCTEAA4 #cm_NT6p8o2679DrK-fCTEAA4\:body {
  color: color(srgb 0.257481 0.257481 0.257481); /* was: var(--lb-foreground-secondary) */
  white-space: break-spaces;
}

#cm_NT6p8o2679DrK-fCTEAA4 p {
  min-height: 24px;
  margin-top: -2px;
  margin-bottom: -2px;
}
```