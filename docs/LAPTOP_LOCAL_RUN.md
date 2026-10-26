# Run Raco / erxes on **your laptop** (local)

The cloud agent VM is **not** your machine. Opening `http://localhost:3001` in your laptop browser only works if **you** start the stack on that laptop.

**Fork:** https://github.com/razin0900/https-github.com-razin0900-erxes  
**Product shape:** standalone / self-hosted (not SaaS)  
**Licence gate:** still **NOT APPROVED** for commercial claims

---

## 1. Prerequisites (laptop)

| Tool | Version |
|------|---------|
| Node.js | **22** (recommended; 18+ minimum) |
| pnpm | **9.12.3** (`corepack enable` then `corepack prepare pnpm@9.12.3 --activate`) |
| Git | any recent |
| MongoDB | listening on **27017** |
| Redis | listening on **6379** |

### Easiest data stores: Docker Desktop

```bash
docker run -d --name erxes-mongo -p 27017:27017 mongo:7
docker run -d --name erxes-redis -p 6379:6379 redis:7
```

(Or install MongoDB + Redis natively on Windows/macOS/Linux.)

---

## 2. Clone the fork (not upstream erxes/erxes)

**PowerShell / bash:**

```bash
git clone https://github.com/razin0900/https-github.com-razin0900-erxes.git
cd https-github.com-razin0900-erxes
git checkout main
# Optional — latest run-recipe / branding docs:
# git fetch origin pull/2/head:pr-2 && git checkout pr-2
```

---

## 3. Install and configure

```bash
pnpm install

# First time only — this repo uses `.env.sample` (not `.env.example`)
cp .env.sample .env
```

Edit `.env` and set at least:

```env
MONGO_URL=mongodb://localhost:27017/erxes
REDIS_HOST=localhost
REDIS_PORT=6379
REACT_APP_API_URL=http://localhost:4000
NODE_ENV=development
NODE_OPTIONS=--max-old-space-size=1536
```

**Important:** leave `ENABLED_PLUGINS` **unset** for a core-only first run.  
Do **not** set `ENABLED_PLUGINS=` (empty) — that hangs the gateway.  
If you later set e.g. `ENABLED_PLUGINS=frontline,sales,operation`, also run `pnpm dev:apis` in another terminal.

Never commit `.env` or secrets.

---

## 4. Start (two terminals)

**Terminal 1 — Gateway + Core API**

```bash
pnpm dev:core-api
```

Wait until you see Core joined / Router started. Check:

- http://localhost:3300/health → `ok`
- GraphQL: `POST http://localhost:4000/graphql` with `{ "__typename" }` (or open playground if enabled)

**Terminal 2 — UI**

```bash
pnpm dev:uis
```

Wait for `Server ready at http://localhost:3001` / Rspack compiled.

**Browser on the same laptop:** http://localhost:3001/

---

## 5. Optional

| Command | Purpose |
|---------|---------|
| `pnpm dev:apis` | All plugin APIs when `ENABLED_PLUGINS` is set |
| `cd backend/services/raco-webhooks && pnpm exec tsx src/main.ts` | Outbound webhooks sidecar (`docs/WEBHOOKS.md`) |

---

## 6. Windows tips

- Prefer **PowerShell** or **Git Bash**; run each `pnpm` command in its own window.  
- If `pnpm` is missing: `npm i -g pnpm@9.12.3` or Corepack (above).  
- Antivirus can slow `pnpm install`; allow the repo folder.  
- First install + UI compile can take several minutes and several GB of RAM.  
- If port 3001/4000/3300 is busy, stop other Node/Docker apps using those ports.

---

## 7. Smoke checklist

1. Redis: `redis-cli ping` → `PONG` (or Docker healthy)  
2. Mongo accepting connections on 27017  
3. `pnpm dev:core-api` stays up (no endless `Waiting for plugin`)  
4. `pnpm dev:uis` → http://localhost:3001 returns HTML  
5. UI can reach API via `REACT_APP_API_URL=http://localhost:4000`

More evidence / pitfalls: `docs/BASELINE_RUN.md`.
