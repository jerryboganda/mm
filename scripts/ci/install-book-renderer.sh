#!/usr/bin/env bash
set -euo pipefail

readonly LIBREOFFICE_VERSION='4:24.2.7-0ubuntu0.24.04.6'
readonly FONTCONFIG_VERSION='2.15.0-1.1ubuntu2'
readonly LIBERATION_VERSION='1:2.1.5-3'
readonly NOTO_VERSION='20201225-2'
readonly DEJAVU_VERSION='2.37-8'

print_versions() {
  libreoffice --headless --version
  fc-cache --version
}

if [[ "${1:-}" == '--print-versions' ]]; then
  print_versions
  exit 0
fi

if [[ ! -r /etc/os-release ]]; then
  echo 'This pinned installer requires Ubuntu 24.04.' >&2
  exit 2
fi

# shellcheck disable=SC1091
source /etc/os-release
if [[ "${ID:-}" != 'ubuntu' || "${VERSION_ID:-}" != '24.04' ]]; then
  echo 'This pinned installer requires Ubuntu 24.04.' >&2
  exit 2
fi

if (( EUID != 0 )); then
  exec sudo -- "$0" "$@"
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends \
  "libreoffice-core-nogui=${LIBREOFFICE_VERSION}" \
  "libreoffice-writer-nogui=${LIBREOFFICE_VERSION}" \
  "fontconfig=${FONTCONFIG_VERSION}" \
  "fonts-liberation=${LIBERATION_VERSION}" \
  "fonts-noto-core=${NOTO_VERSION}" \
  "fonts-dejavu-core=${DEJAVU_VERSION}"

fc-cache -f
print_versions
