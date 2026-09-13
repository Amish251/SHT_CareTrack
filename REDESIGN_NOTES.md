# CareTrack UI Redesign

This version is a visual redesign intended to preserve the existing application functionality.

## What changed
- Reworked the visual design system in `src/shared/styles/tokens.css`.
- Modern dark navigation/sidebar with clearer active states.
- Softer page background, cards, panels, inputs and buttons.
- Improved tables, status pills, empty states, modals and toast notifications.
- Responsive layout for desktop, tablet and mobile.
- Mobile navigation remains the existing off-canvas menu.
- Existing React/TypeScript components, routes, handlers, data storage and business logic were not changed.

## Main file to customize
`src/shared/styles/tokens.css`

The CSS variables at the top are the easiest place to change the overall color palette:
- `--primary` / `--primary-deep`
- `--ink` / `--ink-soft`
- `--paper`
- `--line`
- `--sidebar`

## Important
This redesign intentionally uses the existing class names so the UI can be changed without changing the application's functionality.
