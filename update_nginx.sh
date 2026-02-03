#!/bin/bash
# Update nginx configuration

CONFIG_FILE="/home/deploy/management/config/repos.json"
NGINX_CONF="/etc/nginx/sites-available/opencs.dev"

cat > "$NGINX_CONF" << 'NGINX_BASE'
server {
    listen 80;
    listen [::]:80;
    server_name opencs.dev www.opencs.dev;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name opencs.dev www.opencs.dev;
    
    # SSL certificates (will be configured by certbot)
    ssl_certificate /etc/letsencrypt/live/opencs.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/opencs.dev/privkey.pem;
    
    root /var/www/opencs.dev;
    index index.html index.htm;
    
    # Webhook endpoint
    location /webhook {
        proxy_pass http://127.0.0.1:9000/hooks/deploy;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
NGINX_BASE

# Add page locations
jq -r '.pages[] | "\(.url_path)|\(.web_path)"' "$CONFIG_FILE" 2>/dev/null | while IFS='|' read -r url_path web_path; do
    if [ "$url_path" != "/" ] && [ -n "$url_path" ]; then
        cat >> "$NGINX_CONF" << EOF
    
    location $url_path {
        alias $web_path;
        try_files \$uri \$uri/ =404;
    }
EOF
    fi
done

cat >> "$NGINX_CONF" << 'NGINX_END'
    
    location / {
        try_files $uri $uri/ =404;
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
NGINX_END

# Test and reload
nginx -t && systemctl reload nginx
