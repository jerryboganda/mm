dev:
	podman compose -f compose.dev.yml up --build

dev-no-build:
	podman compose -f compose.dev.yml up

down:
	podman compose -f compose.dev.yml down

restart:
	podman compose -f compose.dev.yml restart

logs:
	podman compose -f compose.dev.yml logs -f

ps:
	podman ps

df:
	podman system df

safe-prune:
	podman system prune --force --filter until=24h
