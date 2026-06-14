# Podman Hot Reload Verification

Generated: 2026-06-05

## Commands

Primary development start:

```powershell
podman compose -f compose.dev.yml up --build
```

Restart without rebuild:

```powershell
podman compose -f compose.dev.yml up
```

## Verification Results

| Check | Result | Evidence |
| --- | --- | --- |
| Podman engine resources | Passed | `podman info` reports 16 CPUs and 29427302400 bytes of memory after WSL restart. |
| Compose config parse | Passed | `podman compose -f compose.dev.yml config` exited 0 and rendered website/admin/db services, bind mounts, named volumes, labels, and ports. |
| Services start | Passed | `podman compose -f compose.dev.yml up -d --no-build` started website, admin, and db. `podman ps` showed ports `5000`, `5173`, and `5432`. |
| Website localhost | Passed | `Invoke-WebRequest http://localhost:5000` returned HTTP 200. |
| Admin localhost | Passed | `Invoke-WebRequest http://localhost:5173/admin/` returned HTTP 200. |
| Website frontend hot reload | Passed | Changed `Maternal Mind Website/client/src/pages/home.tsx`; `http://localhost:5000/src/pages/home.tsx` served the new string and logs showed `hmr update /src/pages/home.tsx` without rebuild. Temporary text was restored. |
| Admin frontend hot reload | Passed | Changed `admin/src/pages/LoginPage.tsx`; `http://localhost:5173/admin/src/pages/LoginPage.tsx` served the new string and logs showed `hmr update /src/pages/LoginPage.tsx` without rebuild. Temporary text was restored. |
| Backend/API hot reload | Passed | Added dev-only `/api/dev/hot-reload-check`, changed response from `hot-reload-v1` to `hot-reload-v2`, and `Invoke-WebRequest` returned the new response in 7.38 seconds without rebuild. Logs showed `tsx` restarting on `server/routes.ts`. |
| No stale cache headers | Passed | Website and admin both returned `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`, `Pragma: no-cache`, `Expires: 0`, and `Surrogate-Control: no-store`. |
| Dependency reuse | Passed | Ran `podman compose -f compose.dev.yml down`, then `podman compose -f compose.dev.yml up -d --no-build`; containers restarted and named volumes remained. |
| Cleanup safety | Passed | `scripts/podman-cleanup.ps1` ran while services were active; `postgres_data` and all project volumes remained. |

## Notes

- Development uses bind-mounted source for both Node apps.
- `node_modules` is stored in named Podman volumes, not bind-mounted from Windows.
- Database data is stored in the persistent `postgres_data` volume and is not eligible for automatic disposable-volume pruning.
- Cleanup scripts never run `podman system prune --all --volumes --force`.
- Host `node.exe` could not be used for verification because Windows returned `Access is denied`; JSON and build checks were run with PowerShell parsing and in-container npm commands instead.
- `podman exec maternalmind-localdev-website-1 npm run check` exited 0.
- `podman exec maternalmind-localdev-admin-1 npm run build` exited 0; Vite reported a chunk-size warning for the existing admin bundle.
