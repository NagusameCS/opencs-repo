#!/bin/bash
# Auto-update script for cron

MANAGEMENT_DIR="$HOME/management"
CONFIG_FILE="$MANAGEMENT_DIR/config/repos.json"
LOG_FILE="$MANAGEMENT_DIR/logs/auto_update.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "Starting auto-update check..."

# Check and update bots
jq -r '.bots[] | "\(.name)|\(.path)"' "$CONFIG_FILE" 2>/dev/null | while IFS='|' read -r name path; do
    if [ -n "$name" ] && [ -d "$path" ]; then
        cd "$path"
        git fetch
        local_hash=$(git rev-parse HEAD)
        remote_hash=$(git rev-parse origin/$(git rev-parse --abbrev-ref HEAD))
        
        if [ "$local_hash" != "$remote_hash" ]; then
            log "Updating bot: $name"
            git pull
            
            if [ -f "package.json" ]; then
                npm install
            elif [ -f "requirements.txt" ]; then
                source venv/bin/activate 2>/dev/null
                pip install -r requirements.txt
            fi
            
            pm2 restart "$name"
            log "Bot $name updated and restarted"
        fi
    fi
done

# Check and update pages
jq -r '.pages[] | "\(.name)|\(.repo_path)|\(.web_path)|\(.build_cmd)|\(.build_dir)"' "$CONFIG_FILE" 2>/dev/null | while IFS='|' read -r name repo_path web_path build_cmd build_dir; do
    if [ -n "$name" ] && [ -d "$repo_path" ]; then
        cd "$repo_path"
        git fetch
        local_hash=$(git rev-parse HEAD)
        remote_hash=$(git rev-parse origin/$(git rev-parse --abbrev-ref HEAD))
        
        if [ "$local_hash" != "$remote_hash" ]; then
            log "Updating page: $name"
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
            
            log "Page $name updated and deployed"
        fi
    fi
done

log "Auto-update check complete"
