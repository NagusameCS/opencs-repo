#!/bin/bash
# Web UI Installer for OpenCS VPS Manager
# Run after main install.sh

set -e

DEPLOY_HOME="/home/deploy"
WEBUI_DIR="$DEPLOY_HOME/management/webui"

echo "Installing Web UI..."

# Create directory
mkdir -p "$WEBUI_DIR"
cd "$WEBUI_DIR"

# Copy files (these should be uploaded first)
if [ ! -f "package.json" ]; then
    echo "Error: Web UI files not found. Upload them first."
    exit 1
fi

# Install dependencies
npm install

# Generate password hash
read -p "Enter admin password for Web UI: " ADMIN_PASS
PASS_HASH=$(node -e "console.log(require('bcrypt').hashSync('$ADMIN_PASS', 10))")

# Generate session secret
SESSION_SECRET=$(openssl rand -hex 32)

# Create .env file
cat > "$WEBUI_DIR/.env" << EOF
PORT=3000
SESSION_SECRET=$SESSION_SECRET
ADMIN_PASSWORD_HASH=$PASS_HASH
EOF

# Set permissions
chown -R deploy:deploy "$WEBUI_DIR"

# Start with PM2
su - deploy -c "cd $WEBUI_DIR && pm2 start server.js --name 'vps-webui' && pm2 save"

# Update nginx to proxy the web UI
cat > /etc/nginx/sites-available/manager.opencs.dev << 'NGINX_CONF'
server {
    listen 80;
    server_name manager.opencs.dev;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX_CONF

ln -sf /etc/nginx/sites-available/manager.opencs.dev /etc/nginx/sites-enabled/

nginx -t && systemctl reload nginx

echo ""
echo "Web UI installed successfully!"
echo "Access it at: http://manager.opencs.dev (after DNS setup)"
echo "Or temporarily at: http://159.198.42.248:3000"
echo ""
echo "To get SSL, run:"
echo "  certbot --nginx -d manager.opencs.dev"
