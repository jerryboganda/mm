# Podman Local Development Audit

Generated: 2026-06-05

## Host

- Host OS: Microsoft Windows Server 2025 Standard Evaluation
- OS version: 10.0.26100
- OS build: 26100
- Logical processors: 20
- Physical memory reported by Windows: 50331090944 bytes
- Project root: `C:\Users\Administrator\Desktop\NEW OET WEB APP\mm-main`
- Active resource policy: `C:\Users\Administrator\.wslconfig`

```ini
[wsl2]
processors=16
memory=28GB
swap=6GB
localhostForwarding=true
```

## Podman

- Podman Desktop: 1.27.2
- Podman CLI: 5.8.2
- Podman machine: `podman-machine-default`
- Provider/type: WSL
- Rootful: true
- Podman socket inside machine: `unix:///run/podman/podman.sock`
- Windows Podman pipe: `\\.\pipe\podman-machine-default`
- Docker API forwarding after restart: listening on `npipe:////./pipe/docker_engine`
- The first restart after `wsl.exe --shutdown` briefly reported that Docker API forwarding could not start because the expected pipe was unavailable. A subsequent `podman machine stop` / `podman machine start` restored forwarding.
- Default Podman connection: `podman-machine-default-root`
- Existing containers before configuration: none
- Existing images before configuration: none
- Existing volumes before configuration: none
- Current local dev containers after implementation: website, admin, and db running through `compose.dev.yml`
- Current local dev volumes after implementation: seven named volumes, including persistent `maternalmind-localdev_postgres_data`

## Resources

`podman machine set --cpus 16 --memory 28672 --disk-size 180 podman-machine-default` was attempted after stopping the WSL machine. Podman returned:

```text
Error: changing CPUs not supported for WSL machines
```

Because this provider does not support those settings through `podman machine set`, resources were controlled with `.wslconfig` instead.

Live engine resources from `podman info` after `wsl.exe --shutdown` and `podman machine start`:

- CPUs visible to Podman engine: 16
- Memory visible to Podman engine: 29427302400 bytes, approximately 27.4 GiB
- Swap visible to Podman engine: 6442450944 bytes, approximately 6 GiB
- Storage graph root: `/var/lib/containers/storage`
- Storage graph allocated: 1081101176832 bytes
- Storage graph used at audit time: about 1.0 GB

`podman machine inspect` still reports the WSL machine metadata as 10 CPUs, 2048 MiB RAM, and 100 GiB disk. For this provider, the live `podman info` values are the reliable resource evidence.

## Disk

- Windows `C:` drive size: 536764985344 bytes
- Windows `C:` free space during audit: approximately 488318095360 bytes
- Podman store is inside the WSL-backed machine at `/var/lib/containers/storage`

## Compose And Compatibility

- `podman compose` is available.
- Compose provider: `C:\Users\Administrator\AppData\Local\Microsoft\WindowsApps\docker-compose.exe`
- Compose version reported by provider: Docker Compose v5.1.4
- `podman-compose`: not installed
- `docker` CLI in PowerShell: not installed
- Docker API compatibility: Podman starts Docker API forwarding on `npipe:////./pipe/docker_engine`

## Project Stack

Detected stack:

- Node.js / TypeScript
- Express API
- Vite React website in `Maternal Mind Website`
- Vite React admin app in `admin`
- PostgreSQL
- Drizzle ORM references

Existing container workflow:

- Root `docker-compose.yml` is production-oriented.
- Root `Dockerfile` is production-oriented and builds artifacts such as `server_dist`, `web_dist`, `static-build`, and `admin_dist`.
- Development workflow is now separated into `compose.dev.yml`, `Dockerfile.dev` files, bind-mounted source, named dependency/cache volumes, and watch-mode commands.

## Files Added Or Updated

- Added `compose.dev.yml`
- Added `Maternal Mind Website/Dockerfile.dev`
- Added `admin/Dockerfile.dev`
- Added `.env.development.example`
- Added `scripts/podman-cleanup.ps1`
- Added `scripts/podman-cleanup.sh`
- Added `Makefile`
- Added `README_DEV_PODMAN.md`
- Added `PODMAN_HOT_RELOAD_VERIFICATION.md`
- Updated website/admin package scripts
- Updated Vite watch/HMR settings
- Updated website dev no-cache headers
- Updated `.dockerignore`

## Scheduled Cleanup

Windows scheduled tasks were registered:

- `Podman Safe Daily Cleanup`, daily at 09:00
- `Podman Safe Login Cleanup`, at user logon

Because the project path contains spaces, the task action uses the Windows short path:

```text
C:\Users\ADMINI~1\Desktop\NEWOET~1\mm-main\scripts\PODMAN~1.PS1
```

The target resolves to `scripts/podman-cleanup.ps1` in this project.
