#!/bin/bash
# GitHub webhook handler

MANAGEMENT_DIR="/home/deploy/management"
CONFIG_FILE="$MANAGEMENT_DIR/config/repos.json"
LOG_FILE="$MANAGEMENT_DIR/logs/webhook.log"

REPO_NAME=$1
REF=$2

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "Webhook received for $REPO_NAME on $REF"

# Check if it's a push to main/master
if [[ "$REF" != "refs/heads/main" ]] && [[ "$REF" != "refs/heads/master" ]]; then
    log "Ignoring non-main branch push: $REF"
    exit 0
fi

# Find matching bot
bot_name=$(jq -r ".bots[] | select(.url | contains(\"$REPO_NAME\")) | .name" "$CONFIG_FILE")
if [ -n "$bot_name" ]; then
    log "Updating bot: $bot_name"
    bot_path=$(jq -r ".bots[] | select(.name==\"$bot_name\") | .path" "$CONFIG_FILE")
    
    cd "$bot_path"
    git pull
    
    if [ -f "package.json" ]; then
        npm install
    elif [ -f "requirements.txt" ]; then
        source venv/bin/activate 2>/dev/null
        pip install -r requirements.txt
    fi
    
    pm2 restart "$bot_name"
    log "Bot $bot_name updated and restarted"
fi

# Find matching page
page_name=$(jq -r ".pages[] | select(.url | contains(\"$REPO_NAME\")) | .name" "$CONFIG_FILE")
if [ -n "$page_name" ]; then
    log "Updating page: $page_name"
    page_info=$(jq -r ".pages[] | select(.name==\"$page_name\")" "$CONFIG_FILE")
    repo_path=$(echo "$page_info" | jq -r '.repo_path')
    web_path=$(echo "$page_info" | jq -r '.web_path')
    build_cmd=$(echo "$page_info" | jq -r '.build_cmd')
    build_dir=$(echo "$page_info" | jq -r '.build_dir')
    
    cd "$repo_path"
    git pull
    
    if [ -f "package.json" ]; then
        npm install
    fi
    
    if [ "$build_cmd" != "null" ] && [ -n "$build_cmd" ]; then
        eval $build_cmd
    fi
    
    if [ "$build_dir" = "." ] || [ "$build_dir" = "null" ]; then
        rsync -av --delete --exclude='.git' --exclude='node_modules' "$repo_path/" "$web_path/"
    else
        rsync -av --delete "$repo_path/$build_dir/" "$web_path/"
    fi
    
    log "Page $page_name updated and deployed"
fi

# Handle webui deploy (opencs.dev management portal)
if [[ "$REPO_NAME" == *"opencs"* ]] || [[ "$REPO_NAME" == *"webui"* ]] || [[ "$REPO_NAME" == *"portal"* ]]; then
    log "Updating webui portal"
    /home/deploy/management/deploy.sh >> "$LOG_FILE" 2>&1
    log "Webui portal updated"
fi
