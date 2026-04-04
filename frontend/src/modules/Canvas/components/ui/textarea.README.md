# Textarea

`Textarea` is the shared multiline text-input primitive for local shadcn-style UI.

## Purpose

- Provide a reusable multiline field for inspectors and inline editing.
- Match the existing `input` styling language without introducing rounded or ad hoc form controls.

## Integration Notes

- Import with `import { Textarea } from "@/components/ui/textarea"`.
- Use feature-local wrappers for behavior-heavy editors and keep this primitive presentation-only.
