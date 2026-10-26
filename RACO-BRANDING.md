# Raco AI brand assets

This branch includes the same logo and theme used by the local RacoAI CRM.

- Original logo: `frontend/core-ui/src/assets/raco-logo.png`
- Compact icon/favicon: `frontend/core-ui/src/assets/raco-icon.svg`
- Theme: `frontend/core-ui/src/styles.css`
- Logo renderer: `frontend/core-ui/src/modules/auth/components/Logo.tsx`

The palette uses coral #ff7864, charcoal #29292b / #1e1e21, warm white
#f7f5f0 and gray #ebebed, with Instrument Sans and local fallbacks. Logo
variants support light/dark surfaces and retain organization-specific overrides.
Login, loading, navigation and onboarding use the same identity. Upstream erxes
attribution and license notices are retained.

Rebuild the core-ui frontend to see these source changes in a deployment.
The current integrated application is maintained on main. Historical development branches are archived after consolidation; standalone backend/integration work is retained.
