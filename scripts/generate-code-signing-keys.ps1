# Generates the expo-updates code-signing keypair for self-hosted OTA.
#   client/certs/certificate.pem          PUBLIC cert  — committed, bundled into the app
#   secrets/code-signing-private-key.pem  PRIVATE key  — git-ignored, copy to the VPS only
#
# Run from the project root:  powershell -File scripts/generate-code-signing-keys.ps1
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path secrets, client/certs | Out-Null
npx expo-updates codesigning:generate `
  --key-output-directory secrets `
  --certificate-output-directory client/certs `
  --certificate-validity-duration-years 10 `
  --certificate-common-name "Maternal Mind"
Copy-Item secrets/private-key.pem secrets/code-signing-private-key.pem -Force
Write-Host ""
Write-Host "Done."
Write-Host " - Commit client/certs/certificate.pem"
Write-Host " - Copy secrets/code-signing-private-key.pem to the VPS at /root/maternal-mind/secrets/"
