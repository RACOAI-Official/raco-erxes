# Raco AI local modification notice

Modified on 2026-10-21 for the Raco AI self-hosted CRM adaptation.
Original erxes and third-party copyright and license notices remain applicable.
This notice does not grant rights to upstream trademarks or Enterprise code.

The local changes add Windows-compatible backend/router/schema/watcher startup,
portable Nx packaging target paths, Raco AI branding and source-download links,
Raco LLM defaults through the existing OpenAI-compatible automation bridge,
optional Gemini failover, focused checks, local owner/smoke scripts, and operating
documentation. The adaptation also removes full-record automation trigger logging
and supplies controlled defaults to the credential login form. The shared MongoDB
lifecycle handler no longer terminates services on transient disconnects or
intentional connection closes; initial connection failures still reject. Connection
logs omit database URLs. Subscription assets follow the actual runtime file
extension, and `pnpm start:raco` runs the compiled local backend.

The source archive includes the current versions of changed files as later tar
entries overlaying the upstream checkout. Extract the complete archive normally
to obtain those versions. `.env`, local credentials and generated runtime data
are excluded. The working checkout's earlier user changes are retained.
