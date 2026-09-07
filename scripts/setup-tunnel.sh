#!/bin/bash

echo "=== Cloudflare Tunnel Setup for Sales Copilot ==="

if ! command -v cloudflared &> /dev/null; then
    echo "cloudflared could not be found."
    echo "Please install it first: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    exit 1
fi

echo "Logging into Cloudflare..."
cloudflared tunnel login

echo "Creating tunnel 'sales-copilot'..."
cloudflared tunnel create sales-copilot

echo "Routing DNS for App (single domain)..."
cloudflared tunnel route dns sales-copilot sales-copilot.kakadev.xyz

echo "Routing DNS for Storage..."
cloudflared tunnel route dns sales-copilot storage-sales-copilot.kakadev.xyz

echo "Please copy your credentials file (usually in ~/.cloudflared/<TUNNEL_ID>.json) to config/cloudflared/credentials.json"
echo "Then, update config/cloudflared/config.yml with your TUNNEL_ID."
echo "Setup complete!"

