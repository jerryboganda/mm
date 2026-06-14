# Podman Local Development

This project uses Podman for local development. The production `Dockerfile` and `docker-compose.yml` remain unchanged; local development uses `compose.dev.yml`.

## Start Development

From `C:\Users\Administrator\Desktop\NEW OET WEB APP\mm-main`:

```powershell
podman compose -f compose.dev.yml up --build
```

Restart without rebuilding:

```powershell
podman compose -f compose.dev.yml up
```

Stop services:

```powershell
podman compose -f compose.dev.yml down
```

## Local Ports

- Website and API: `http://localhost:5000`
- Admin app: `http://localhost:5173`
- PostgreSQL: `localhost:5432`

## Hot Reload

- Website/API source is bind-mounted from `Maternal Mind Website` into `/app`.
- Admin source is bind-mounted from `admin` into `/app`.
- The website server runs `tsx watch server/index.ts`.
- Vite uses polling in containers through `CHOKIDAR_USEPOLLING=true`.
- Vite HMR is configured for `localhost`.
- Rebuilds are only needed after dependency, Dockerfile, base image, or system package changes.

## Volumes

Persistent:

- `postgres_data`: PostgreSQL data, labeled `com.localdev.persistent=true`.

Reusable dependency/cache volumes:

- `website_node_modules`
- `website_npm_cache`
- `admin_node_modules`
- `admin_npm_cache`

Disposable cache volumes:

- `website_tmp_cache`, labeled `com.localdev.ephemeral=true`
- `admin_tmp_cache`, labeled `com.localdev.ephemeral=true`

Source code is not copied into the dev containers at runtime. It is bind-mounted so edits on the host are visible inside containers immediately.

## No Stale Localhost Cache

Development responses set no-store headers:

```http
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
Surrogate-Control: no-store
```

Dev startup removes app build caches only:

```sh
rm -rf dist build .vite .turbo .next/cache
```

It does not delete `node_modules`.

## Safe Cleanup

Manual safe cleanup:

```powershell
.\scripts\podman-cleanup.ps1
```

Windows scheduled tasks are registered for daily cleanup at 09:00 and cleanup at user logon:

- `Podman Safe Daily Cleanup`
- `Podman Safe Login Cleanup`

The cleanup script runs:

```powershell
podman system prune --force --filter "until=24h"
podman volume prune --force --filter "label=com.localdev.ephemeral=true" --filter "until=24h"
```

It never runs global destructive volume cleanup such as:

```powershell
podman system prune --all --volumes --force
```

## When To Rebuild

Rebuild when one of these changes:

- `package.json` or `package-lock.json`
- `Dockerfile.dev`
- base image
- system packages
- Compose build context or build args

For normal source changes, use hot reload and restart without rebuilding if needed.
