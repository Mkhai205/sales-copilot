Write-Host "=== Cloudflare Tunnel Setup for Sales Copilot ==="

if (!(Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "cloudflared could not be found." -ForegroundColor Red
    Write-Host "Please install it first: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    exit 1
}

Write-Host "Logging into Cloudflare..."
cloudflared tunnel login

Write-Host "Creating tunnel 'sales-copilot'..."
cloudflared tunnel create sales-copilot

Write-Host "Routing DNS for API..."
cloudflared tunnel route dns sales-copilot api.sales-copilot.kakadev.xyz

Write-Host "Routing DNS for App..."
cloudflared tunnel route dns sales-copilot app.sales-copilot.kakadev.xyz

Write-Host "Routing DNS for Storage..."
cloudflared tunnel route dns sales-copilot storage.sales-copilot.kakadev.xyz

Write-Host "Please copy your credentials file (usually in ~/.cloudflared/<TUNNEL_ID>.json) to config\cloudflared\credentials.json"
Write-Host "Then, update config\cloudflared\config.yml with your TUNNEL_ID."
Write-Host "Setup complete!" -ForegroundColor Green
