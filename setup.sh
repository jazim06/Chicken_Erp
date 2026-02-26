#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# Chicken ERP — DigitalOcean Droplet First-Time Setup
# Run as root (or with sudo) on a fresh Ubuntu 24.04 droplet
#
# Usage:  sudo bash setup.sh
# ──────────────────────────────────────────────────────────
set -euo pipefail

APP_USER="chickenapp"
APP_DIR="/home/$APP_USER/Chicken-ERP"
REPO_URL="https://github.com/jazim06/Chicken-ERP.git"
BRANCH="main"

echo "══════════════════════════════════════════════════════"
echo "  Chicken ERP — Server Setup"
echo "══════════════════════════════════════════════════════"

# ── 1. System packages ───────────────────────────────────
echo "→ Updating system packages..."
apt update && apt upgrade -y
apt install -y git nginx python3 python3-venv python3-pip ufw curl

# ── 2. Create app user ───────────────────────────────────
if ! id "$APP_USER" &>/dev/null; then
    echo "→ Creating user: $APP_USER"
    adduser --disabled-password --gecos "" "$APP_USER"
fi

# ── 3. Firewall ──────────────────────────────────────────
echo "→ Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ── 4. Clone repo ────────────────────────────────────────
echo "→ Cloning repository..."
if [ ! -d "$APP_DIR" ]; then
    sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
sudo -u "$APP_USER" git checkout "$BRANCH"
sudo -u "$APP_USER" git pull origin "$BRANCH"

# ── 5. Python venv + deps ────────────────────────────────
echo "→ Setting up Python environment..."
cd "$APP_DIR/Chicken_Erp/backend"
if [ ! -d "venv" ]; then
    sudo -u "$APP_USER" python3 -m venv venv
fi
sudo -u "$APP_USER" bash -c "source venv/bin/activate && pip install -r requirements.txt"

# ── 6. Backend .env ──────────────────────────────────────
if [ ! -f ".env" ]; then
    echo "→ Creating backend .env (you MUST fill in secrets afterward)"
    sudo -u "$APP_USER" tee .env > /dev/null <<'ENVEOF'
# ── Firebase (paste your entire service-account JSON as one line) ──
FIREBASE_SERVICE_ACCOUNT_JSON=

# ── Auth ──
JWT_SECRET_KEY=CHANGE_ME_TO_RANDOM_64_CHARS
ADMIN_EMAIL=admin@supplier.com
ADMIN_PASSWORD=CHANGE_ME

# ── CORS (your domain or droplet IP) ──
CORS_ORIGINS=http://YOUR_DOMAIN_OR_IP

# ── Optional ──
SENTRY_DSN=
RATE_LIMIT_PER_MINUTE=60
ENVEOF
    echo ""
    echo "⚠️  IMPORTANT: Edit /home/$APP_USER/chicken-erp/Chicken_Erp/backend/.env"
    echo "   and fill in FIREBASE_SERVICE_ACCOUNT_JSON, JWT_SECRET_KEY, etc."
    echo ""
fi

# ── 7. systemd service ───────────────────────────────────
echo "→ Installing systemd service..."
cp "$APP_DIR/deploy/chicken-erp-api.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable chicken-erp-api

# ── 8. Sudoers — allow deploy user to restart service ────
echo "→ Configuring sudoers for deploy restarts..."
echo "$APP_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart chicken-erp-api" \
    > /etc/sudoers.d/chicken-erp
chmod 0440 /etc/sudoers.d/chicken-erp

# ── 9. Nginx ─────────────────────────────────────────────
echo "→ Configuring Nginx..."
cp "$APP_DIR/deploy/nginx/chicken-erp" /etc/nginx/sites-available/chicken-erp
ln -sf /etc/nginx/sites-available/chicken-erp /etc/nginx/sites-enabled/chicken-erp
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ── 10. SSH key for GitHub Actions ────────────────────────
SSH_DIR="/home/$APP_USER/.ssh"
if [ ! -f "$SSH_DIR/authorized_keys" ] || ! grep -q "github-actions" "$SSH_DIR/authorized_keys" 2>/dev/null; then
    echo ""
    echo "══════════════════════════════════════════════════════"
    echo "  SSH KEY SETUP (for GitHub Actions CI/CD)"
    echo "══════════════════════════════════════════════════════"
    echo ""
    echo "On your LOCAL machine, generate a deploy key:"
    echo ""
    echo "  ssh-keygen -t ed25519 -C github-actions -f ~/.ssh/chicken_deploy"
    echo ""
    echo "Then add the PUBLIC key to this server:"
    echo ""
    echo "  ssh-copy-id -i ~/.ssh/chicken_deploy.pub $APP_USER@YOUR_DROPLET_IP"
    echo ""
    echo "And add the PRIVATE key (~/.ssh/chicken_deploy) as a GitHub secret:"
    echo "  → Repo Settings → Secrets → DEPLOY_SSH_KEY"
    echo ""
    echo "Also add these GitHub secrets:"
    echo "  → DEPLOY_HOST = your droplet IP"
    echo "  → DEPLOY_USER = $APP_USER"
    echo ""
fi

# ── Done ──────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo "  ✅ Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Edit backend .env:  nano $APP_DIR/Chicken_Erp/backend/.env"
echo "  2. Start the service:  sudo systemctl start chicken-erp-api"
echo "  3. Check status:       sudo systemctl status chicken-erp-api"
echo "  4. View logs:          sudo journalctl -u chicken-erp-api -f"
echo "  5. Build & deploy frontend via GitHub Actions (push to main)"
echo "  6. (Optional) Add SSL: sudo apt install certbot python3-certbot-nginx"
echo "     then: sudo certbot --nginx -d yourdomain.com"
echo "══════════════════════════════════════════════════════"
