# RacoAI OpenWA deployment

Deploy this standalone Compose project at `/opt/openwa`. It runs OpenWA
v0.25.0 with SQLite and local session data in `/opt/openwa/data`. The only
published port is host loopback 2785; Nginx serves `wa.racoai.io` over HTTPS.
The container joins the existing `erxes_default` network so Frontline reaches
it at `http://openwa:2785` (the Compose service network alias).

1. An administrator creates the directory:

   ```sh
   sudo install -d -o sajid -g sajid -m 0750 /opt/openwa
   ```

2. Copy `compose.yaml` to `/opt/openwa/compose.yaml`. Run
   `docker compose -f /opt/openwa/compose.yaml config`, then
   `docker compose -f /opt/openwa/compose.yaml up -d`. Confirm
   `curl -fsS http://127.0.0.1:2785/api/health/ready` succeeds.

3. An administrator copies `wa.racoai.io.conf` to
   `/etc/nginx/sites-available/wa.racoai.io.conf`, links it from
   `/etc/nginx/sites-enabled/`, runs `nginx -t`, reloads Nginx, then runs
   `certbot --nginx -d wa.racoai.io --redirect`. Confirm
   `https://wa.racoai.io/api/health/ready` succeeds with a valid certificate.

4. Read the one-time admin key privately with
   `docker exec raco-openwa cat /app/data/.api-key`. Sign in to the dashboard
   at `https://wa.racoai.io`. Create a separate operator key for erxes; do not
   put either key in this directory or Git. Use the dashboard to create and
   pair one session, then record its UUID.

5. Set `OPENWA_SUBDOMAIN` in erxes Frontline configuration and create the
   `openwa-messenger` inbox integration. Then set `OPENWA_BASE_URL` to
   `http://openwa:2785`, and set `OPENWA_API_KEY`, `OPENWA_SESSION_ID`,
   `OPENWA_INTEGRATION_ID`, and `OPENWA_WEBHOOK_SECRET`. Restart Frontline.
   Register a signed `message.received` webhook for the session with URL
   `https://erxes.racoai.io/gateway/pl:frontline/openwa/receive` and the same secret.

Back up `/opt/openwa/data` before changing the image version. Do not run
`docker compose down -v`; the bind mount holds the key, database, and paired
session credentials.
