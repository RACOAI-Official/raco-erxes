# Raco AI local modification notice

On 2026-10-24, added an opt-in Raco XOS SaaS configuration: verified self-service
workspace signup, per-organization databases, 14-day trial access controls,
owner subscription status, configurable plan descriptions/prices and disabled
checkout. The public portal and container overlay target xos.racoai.io. No SaaS
deployment, DNS changes or conversion of existing customer data were performed.
Disposable tenant-isolation tests and CI coverage accompany the new modules.

Modified on 2026-10-21 for the Raco AI self-hosted CRM adaptation.
Brand styling updated on 2026-10-22 using the supplied Raco AI logo and the
coral, charcoal, gray, and Instrument Sans identity from racoai.io. The original
logo is included without redrawing; compact marks display its existing symbol.
Login, navigation, loading, invitations, and onboarding share the supplied mark.
Organization-specific logos and login text continue to override the defaults.
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

2026-10-24: Added opt-in SSLCommerz BDT hosted checkout, monthly/yearly calendar renewals, validated signed IPN handling, payment history and isolated mock payment checks. Merchant account, credentials, prices and deployment remain pending.
