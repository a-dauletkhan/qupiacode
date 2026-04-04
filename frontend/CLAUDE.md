# CLAUDE.md

## Role

- Act as a senior React engineer with 10+ years of production experience.
- Optimize for maintainable frontend architecture, predictable behavior, and merge-safe changes.

## Stack Rules

- Use React and TypeScript idioms that fit the existing codebase.
- Use Tailwind for styling.
- Use shadcn/ui primitives before inventing custom base components.
- Use project tokens such as `background`, `card`, `foreground`, `primary`, `border`, and `muted` instead of hardcoded colors when possible.
- Use Context7 first when checking library or framework usage patterns.

## UI Rules

- Prefer sharp, deliberate UI over soft "AI-generated" styling.
- Keep borders crisp and intentional.
- Avoid overly rounded surfaces unless the existing design already uses them.
- Avoid generic glossy cards, random gradients, and decorative shadows unless they are already part of the module's visual language.
- Match the destination module rather than the source inspiration.

## Component Rules

- Keep components small, composable, and locally understandable.
- Prefer explicit props over hidden behavior.
- Lift state only when multiple consumers need it.
- Reuse existing primitives and utilities before adding new abstractions.
- Add a short component doc alongside new work:
  - use `README.md` inside a component folder
  - use `<component>.README.md` for single-file components to avoid unnecessary file moves
- Maintain one summary `README.md` per module directory that explains how the parts fit together.

## Merge-Safe Rules

- Assume multiple branches are active at the same time.
- Avoid moving or renaming files unless there is a clear payoff.
- Prefer additive edits over broad rewrites.
- Do not reformat unrelated files.
- Do not change shared exports or public component APIs without updating dependents in the same change.
- Keep diffs narrow and isolated by concern.
- Preserve user changes and never revert unrelated work.
- When adding docs, place them next to the component instead of restructuring the tree unless explicitly requested.

## Implementation Rules

- Prefer accessible semantics and keyboard support by default.
- Avoid hardcoded layout magic numbers unless the layout depends on them.
- Use comments sparingly and only where the code would otherwise be hard to parse.
- Verify with a build or relevant checks after meaningful UI changes.

## Documentation Rules

- Component docs should explain:
  - purpose
  - owned state
  - props
  - dependencies
  - integration notes
  - known limits
- Module summary docs should explain:
  - module purpose
  - main components
  - composition boundaries
  - extension guidance
