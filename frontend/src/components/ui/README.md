# UI Module

This directory contains local shadcn-style primitives and wrappers used as the shared UI foundation.

## Purpose

- Provide reusable, low-level building blocks for feature and app components.
- Keep styling and interaction patterns consistent across the app.

## Contents

- Form primitives such as `input`, `label`, and `separator`
- Layout primitives such as `sidebar`, `sheet`, and `resizable`
- Interaction primitives such as `button`, `tooltip`, and `dropdown-menu`
- Support components such as `skeleton`, `navigation-menu`, and `breadcrumb`

## Usage Rules

- Prefer these primitives before creating new local base components.
- Keep business logic out of this module.
- If extending a primitive, preserve the existing API shape unless there is a strong reason to change it.

## Merge Notes

- Treat this module as shared infrastructure.
- Keep changes narrow and avoid broad style churn because these files have high merge impact.
