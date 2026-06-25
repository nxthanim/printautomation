#!/bin/bash
set -e

# ─── Print Automation Server — Ubuntu One-Command Deploy ───
# Run: curl -fsSL https://raw.githubusercontent.com/nxthanim/printautomation/master/deploy-ubuntu.sh | bash
# Or:  wget -qO- https://raw.githubusercontent.com/nxthanim/printautomation/master/deploy-ubuntu.sh | bash

REPO_URL="https://github.com/nxthanim/printautomation.git"
APP_DIR="/opt/printautomation"
SERVICE_NAME="printautomation"

echo "===== Print Automation Server — Ubuntu Install ====="

# 1. Install system dependencies
echo "[1/5] Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq python3 python3-pip python3-venv git curl

# 2. Clone the repo
echo "[2/5] Cloning repository..."
if [ -d "$APP_DIR" ]; then
  echo "  $APP_DIR already exists, pulling latest..."
  cd "$APP_DIR" && sudo git pull
else
  sudo git clone "$REPO_URL" "$APP_DIR"
fi

# 3. Create virtualenv and install Python deps
echo "[3/5] Installing Python dependencies..."
cd "$APP_DIR/server"
sudo python3 -m venv venv
sudo venv/bin/pip install -q -r requirements.txt

# 4. Create systemd service
echo "[4/5] Creating systemd service..."
sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null <<'EOF'
[Unit]
Description=Print Automation Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/printautomation/server
ExecStart=/opt/printautomation/server/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# 5. Enable and start service
echo "[5/5] Starting service..."
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME

# Print result
echo ""
echo "===== DONE ====="
echo ""
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')
echo "Server running at: http://$SERVER_IP:8000"
echo "Health check:      http://$SERVER_IP:8000/api/health"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status $SERVICE_NAME   — check status"
echo "  sudo journalctl -u $SERVICE_NAME -f    — follow logs"
echo "  sudo systemctl restart $SERVICE_NAME   — restart server"
echo ""
