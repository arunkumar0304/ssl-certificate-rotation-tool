# CertRotator - SSL Certificate Rotation Tool (Node.js / Express / React)

Discovers the certificate each endpoint is actually serving, tracks expiry, renews before it lapses,
deploys the new cert, **verifies the endpoint serves it**, and keeps an audit trail + alerts.
100% free and local - no cloud account, no domain, no paid service.

## Stack
Node.js 20+ - Express - React (Vite) - SQLite (better-sqlite3) - node-cron - node-forge (demo CA) -
acme-client (real ACME) - Ansible - nginx in Docker.

## Features
| Requirement | Where |
|---|---|
| Discover certificates | `src/scanner.js` - `tls.connect` against each target |
| Inventory + expiry tracking | SQLite `certs` table; status `ok / expiring / expired / unreachable` |
| Renew before expiry | `src/service.js` - renews when `days_left < renewBeforeDays` (30) |
| ACME pipeline (HTTP-01) | `src/issuers/acme.js` using `acme-client` (Pebble / Let's Encrypt) |
| Offline issuer | `src/issuers/localCa.js` - built-in CA so the demo works anywhere |
| Automatic deployment | `src/deployers.js` - atomic file deploy and Ansible (`ansible/deploy_cert.yml`, AWX-compatible) |
| Verification | After deploy, re-scans until the endpoint serves the **new serial** |
| Alerting + audit | `src/alerts.js` (log + Slack/Teams webhook), append-only `audit` table |
| UI / API / scheduler | React dashboard, Express REST API, node-cron |

## Option 1 - Run locally (no Docker)
```bash
npm install
npm test            # 3 tests (node:test)
npm run demo        # prints the full rotate loop + audit trail in the terminal
```
Dashboard with live rotation:
```bash
npm run build:client
node src/cli.js bootstrap --validity-days 1      # seed an almost-expired cert
node -e "import('./src/devServer.js').then(m=>m.startDevServer(8443,'data/certs/site-a/fullchain.pem','data/certs/site-a/privkey.pem'))" &
npm start                                        # http://localhost:8000
```
Frontend dev mode (hot reload): `npm run dev:client` -> http://localhost:5173 (proxies `/api` to :8000).

## Option 2 - Docker (real nginx, two sites)
```bash
docker compose up --build
```
- Dashboard: http://localhost:8000
- Sites: https://localhost:8443 (site-a), https://localhost:8444 (site-b)
- Both start with 1-day certs; within ~1 minute the scheduler detects, renews, deploys, nginx reloads.

Watch a live certificate change:
```bash
echo | openssl s_client -connect localhost:8443 -servername site-a.local 2>/dev/null | openssl x509 -noout -serial -enddate
```

## REST API
`GET /api/certs` - `GET /api/audit?limit=50` - `POST /api/scan` - `POST /api/renew?name=site-a&force=true`

## CLI
```
node src/cli.js bootstrap --validity-days 1
node src/cli.js scan
node src/cli.js renew [--force] [--name site-a]
```

## Config (`config.json`)
`renewBeforeDays`, `schedule` (cron), `alertWebhook`, `issuer.type` (`localCa` | `acme`), `targets[]`
(each with host/port/domain and a `deploy` block: `file` or `ansible`).

## Optional: real ACME with Pebble
Set `issuer.type` to `acme`, run Pebble + `pebble-challtestsrv`, start the service with
`NODE_TLS_REJECT_UNAUTHORIZED=0` (Pebble uses a self-signed directory cert), and make the target serve
`acme.webroot` at `/.well-known/acme-challenge/`. Implemented but not part of the default demo.

## Next steps
DNS-01 for wildcards, secrets in Vault, Postgres, AWX job-template deploy, appliance deployers, metrics endpoint.
