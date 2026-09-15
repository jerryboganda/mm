$VPS_IP = "185.252.233.186"
$VPS_USER = "root"
$PROJECT_DIR = "/opt/docker/maternal-mind"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Deploying to Production VPS ($VPS_IP)   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$remoteCommand = "cd $PROJECT_DIR && git pull origin main && docker compose build app && docker compose up -d --force-recreate app && sleep 4 && curl -s http://127.0.0.1:5000/health"

ssh -o BatchMode=yes -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" $remoteCommand

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n==========================================" -ForegroundColor Green
    Write-Host "  Deployment to VPS $VPS_IP Complete!    " -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
} else {
    Write-Host "`nDeployment failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
