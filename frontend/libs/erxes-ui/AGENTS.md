# Shared UI library

Apply the repository root guide. Changes here affect the host and plugin remotes;
keep public interfaces compatible and verify affected consumers.

## Theme and editors

- `themeState` stores `light`, `dark`, or `system`.
- Use `useResolvedTheme` when a provider needs a concrete `light` or `dark` value.
  It follows OS preference changes through the existing media-query hook.
- Editable and read-only BlockNote views use that resolved value. Do not cast
  `system` into a provider's narrower theme type or overwrite document text colors
  to compensate for a theme-selection error.
- Shared hook regressions run with `frontend/libs/erxes-ui/jest.config.ts`.
