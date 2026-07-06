#!/usr/bin/env bash
# Generates the expo-updates code-signing keypair for self-hosted OTA.
#   client/certs/certificate.pem          PUBLIC cert  — committed, bundled into the app
#   secrets/code-signing-private-key.pem  PRIVATE key  — git-ignored, copy to the VPS only
#
# Run from the project root:  bash scripts/generate-code-signing-keys.sh
set -euo pipefail
mkdir -p secrets client/certs
npx expo-updates codesigning:generate \
  --key-output-directory secrets \
  --certificate-output-directory client/certs \
  --certificate-validity-duration-years 10 \
  --certificate-common-name "Maternal Mind"
cp secrets/private-key.pem secrets/code-signing-private-key.pem
echo ""
echo "Done."
echo " - Commit client/certs/certificate.pem"
echo " - Copy secrets/code-signing-private-key.pem to the VPS at /root/maternal-mind/secrets/"
