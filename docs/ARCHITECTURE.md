# ARCHITECTURE — erxes (inspected baseline)

**Baseline:** tag `3.3.2` / commit `b5737b8f9a6f3d229cf63081569bfebc7196a29c`  
**Sources:** repo tree, [erxes.io/docs/introduction](https://erxes.io/docs/introduction), README  
**Tags:** `verified-from-source` | `inferred-from-docs`

---

## 1. High-level shape

erxes is an **Nx + pnpm monorepo** that ships:

1. **Core platform** — contacts, products, properties, segments, documents, automations, permissions, organization settings  
2. **Plugins** — domain APIs (`*_api`) + Module Federation UI remotes (`*_ui`)  
3. **Gateway** — Apollo Router + service discovery over Redis; federated GraphQL at `/graphql`  
4. **Standalone apps** — client portal, help center, POS client, frontline widgets  
5. **Background services** — automations, logs  

Evidence: docs introduction “How the parts work together”; README Architecture Overview; directory listing at tag `3.3.2` — all **verified-from-source**.

```
Browser (Core UI :3001)
        │  Module Federation remotes (*_ui :3002+)
        ▼
API Gateway (:4000) ── Apollo Router + Redis discovery
        │
   ┌────┼──────────────┐
   ▼    ▼              ▼
Core  Plugin APIs   Background
API   (*_api)       (automations, logs)
:3300 :3303+
   └────┼──────────────┘
        ▼
   MongoDB + Redis / BullMQ
```

---

## 2. Backend

| Component | Role | Port (dev docs) | Evidence |
|-----------|------|-----------------|----------|
| `backend/gateway` | Federated GraphQL entry, Apollo Router | 4000 | docs introduction |
| `backend/core-api` | Core business + org/settings | 3300 | docs introduction |
| `backend/plugins/*_api` | Plugin GraphQL subgraphs / Express services | 3303+ | docs + tree |
| `backend/erxes-api-shared` | Shared Mongo models helpers, tRPC, SaaS helpers | n/a | tree + `package.json` license AGPL-3.0-only |
| `backend/services/automations` | Automation workers | 3301–3302 range per docs | docs introduction |
| `backend/services/logs` | Log / undo journal persistence | same | `.env.sample` comments |
| `backend/saas-migrations` | SaaS migration scripts | n/a | tree + CI workflow |

**IPC patterns** (verified-from-source — docs introduction):

- GraphQL Federation via gateway  
- Service-to-service **tRPC v11**  
- Redis for discovery, subscriptions (`graphql-redis-subscriptions`), BullMQ queues  

**Tenancy model** (verified-from-source — `backend/erxes-api-shared/src/utils/mongo/generate-models.ts`):

- Default `VERSION` env = `os` → single Mongo connection for all requests  
- `VERSION=saas` → resolve organization by **subdomain**, then `useDb` per organization id (`DB_NAME` template `erxes_<organizationId>`)  

This is first-party multi-tenant SaaS scaffolding inside the public tree — commercial right to *operate* a competing SaaS remains a **licence** question (`LICENCE_REVIEW.md`), not an architecture gap.

---

## 3. Frontend

| Component | Role | Port | Evidence |
|-----------|------|------|----------|
| `frontend/core-ui` | Module Federation **host** | 3001 | docs / README |
| `frontend/plugins/*_ui` | Remotes | 3002–3011 | docs |
| `frontend/libs/erxes-ui` | Design system | library | package + docs |
| `frontend/libs/ui-modules` | Shared business UI | library | tree |

Stack (docs introduction + root deps): React 18.3.1, React Router v7, Rspack, `@module-federation/enhanced`, Tailwind v4, Jotai, Apollo Client, RHF + Zod, `react-i18next`.

**White-label hooks already in core** (verified-from-source):

- Org fields: `orgLogo`, `orgFavicon`, login copy (`organization/whitelabel`)  
- UI consumption: auth `Logo.tsx`, favicon in `OrganizationProvider.tsx`  

**Operational caveat** (verified-from-source — docs introduction): production Core API may return plugin asset URLs hosted at `plugins.erxes.io` — self-hosters must plan whether assets stay on Raco infrastructure.

---

## 4. Standalone apps (`apps/`)

| App | Stack (docs) | Dev port |
|-----|--------------|----------|
| `client-portal-template` | Next.js 16 / React 19 | 3800 |
| `help-center` | Next.js 16 / React 19 | 3900 |
| `posclient-front` | Next.js 14 / React 18 PWA | 7002 |
| `frontline-widgets` | Rspack (chat, forms) | n/a |

Evidence: docs introduction table — **verified-from-source** (docs). Versions may drift vs lockfile; confirm against lockfile before pinning app images.

---

## 5. Extension model (preferred for Raco)

Official path (README + `pnpm create-plugin`):

1. Generate backend + frontend plugin projects  
2. Enable via `ENABLED_PLUGINS` in env  
3. Serve with `pnpm nx serve <name>_api` / `<name>_ui`  

**Raco preference (project context):** plugins / config / isolated services over forking core. Preserve upstream upgrade path.

---

## 6. Deployment shapes

| Shape | Mechanism | Evidence |
|-------|-----------|----------|
| Local | Node processes + local/Compose Mongo+Redis | README, local-setup docs |
| Self-host | Docker Swarm stacks, Nginx, generated compose | self-hosting docs |
| Containerized services | Per-package `Dockerfile`s | tree listing |

No claim that Raco has a production deploy yet.

---

## 7. Security / ops touchpoints (inventory)

- `SECURITY.md` → report to `info@erxes.io`, 90-day disclosure (verified-from-source)  
- Sentry env vars in `.env.sample`  
- GraphQL Armor packages in root dependencies  
- WorkOS SSO dependency present  

---

## 8. Implications for Raco AI

1. Treat **gateway + core-api + selected CE plugins + core-ui** as the minimum white-label surface.  
2. Use **org white-label fields** before inventing parallel branding systems.  
3. If multi-tenant SaaS is required, upstream already has `VERSION=saas` — legal gate must clear **before** enabling it for commercial Raco SaaS.  
4. Plan offline/self-hosted plugin asset hosting so production does not depend on `plugins.erxes.io` unless contractually allowed.
