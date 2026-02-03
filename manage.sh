#!/bin/bash
# OpenCS VPS Management Tool

MANAGEMENT_DIR="$HOME/management"
CONFIG_FILE="$MANAGEMENT_DIR/config/repos.json"
REPOS_DIR="$HOME/repos"
BOTS_DIR="$HOME/bots"
PAGES_DIR="/var/www/opencs.dev"
LOG_FILE="$MANAGEMENT_DIR/logs/management.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

show_banner() {
    clear
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║     ${BOLD}🚀 OpenCS.dev VPS Management System 🚀${NC}${CYAN}                ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

show_status() {
    echo -e "\n${BOLD}📊 Current Status:${NC}"
    
    # Count bots and pages
    local bot_count=$(jq '.bots | length' "$CONFIG_FILE")
    local page_count=$(jq '.pages | length' "$CONFIG_FILE")
    local running_bots=$(pm2 jlist 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
    
    echo -e "  ${GREEN}●${NC} Bots registered: ${BOLD}$bot_count${NC} (Running: $running_bots)"
    echo -e "  ${GREEN}●${NC} Pages deployed: ${BOLD}$page_count${NC}"
    echo ""
}

main_menu() {
    show_banner
    show_status
    
    echo -e "${BOLD}What would you like to do?${NC}\n"
    echo -e "  ${YELLOW}1)${NC} 🤖 Manage Bots (24/7 services)"
    echo -e "  ${YELLOW}2)${NC} 🌐 Manage Pages (web deployments)"
    echo -e "  ${YELLOW}3)${NC} 📦 Add New Repository"
    echo -e "  ${YELLOW}4)${NC} 🔄 Check All Updates"
    echo -e "  ${YELLOW}5)${NC} 📋 View All Repositories"
    echo -e "  ${YELLOW}6)${NC} 📜 View Logs"
    echo -e "  ${YELLOW}7)${NC} ⚙️  Settings"
    echo -e "  ${YELLOW}q)${NC} 🚪 Exit\n"
    
    read -p "$(echo -e ${CYAN}Enter choice: ${NC})" choice
    
    case $choice in
        1) manage_bots ;;
        2) manage_pages ;;
        3) add_repository ;;
        4) check_all_updates ;;
        5) view_repositories ;;
        6) view_logs ;;
        7) settings_menu ;;
        q|Q) echo -e "\n${GREEN}Goodbye! 👋${NC}\n"; exit 0 ;;
        *) echo -e "${RED}Invalid option${NC}"; sleep 1; main_menu ;;
    esac
}

add_repository() {
    show_banner
    echo -e "${BOLD}📦 Add New Repository${NC}\n"
    
    echo -e "Repository type:"
    echo -e "  ${YELLOW}1)${NC} 🤖 Bot (runs 24/7)"
    echo -e "  ${YELLOW}2)${NC} 🌐 Page (web content)"
    echo -e "  ${YELLOW}b)${NC} Back\n"
    
    read -p "$(echo -e ${CYAN}Select type: ${NC})" type_choice
    
    case $type_choice in
        1) add_bot ;;
        2) add_page ;;
        b|B) main_menu ;;
        *) echo -e "${RED}Invalid option${NC}"; sleep 1; add_repository ;;
    esac
}

add_bot() {
    show_banner
    echo -e "${BOLD}🤖 Add New Bot${NC}\n"
    
    read -p "$(echo -e ${CYAN}GitHub repo URL \(e.g., https://github.com/user/repo\): ${NC})" repo_url
    
    if [ -z "$repo_url" ]; then
        echo -e "${RED}URL cannot be empty${NC}"
        sleep 2
        add_repository
        return
    fi
    
    # Extract repo name
    repo_name=$(basename "$repo_url" .git)
    
    read -p "$(echo -e ${CYAN}Bot name \(default: $repo_name\): ${NC})" bot_name
    bot_name=${bot_name:-$repo_name}
    
    read -p "$(echo -e ${CYAN}Start command \(e.g., npm start, python bot.py\): ${NC})" start_cmd
    
    if [ -z "$start_cmd" ]; then
        echo -e "${RED}Start command cannot be empty${NC}"
        sleep 2
        add_repository
        return
    fi
    
    read -p "$(echo -e ${CYAN}Environment file path \(optional, press Enter to skip\): ${NC})" env_file
    
    echo -e "\n${YELLOW}Cloning repository...${NC}"
    
    bot_path="$BOTS_DIR/$bot_name"
    
    if [ -d "$bot_path" ]; then
        echo -e "${YELLOW}Directory exists, pulling latest...${NC}"
        cd "$bot_path" && git pull
    else
        git clone "$repo_url" "$bot_path"
    fi
    
    # Detect and install dependencies
    cd "$bot_path"
    if [ -f "package.json" ]; then
        echo -e "${YELLOW}Installing npm dependencies...${NC}"
        npm install
    elif [ -f "requirements.txt" ]; then
        echo -e "${YELLOW}Setting up Python venv and installing dependencies...${NC}"
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
    fi
    
    # Add to config
    local new_bot=$(jq -n \
        --arg name "$bot_name" \
        --arg url "$repo_url" \
        --arg path "$bot_path" \
        --arg cmd "$start_cmd" \
        --arg env "$env_file" \
        '{name: $name, url: $url, path: $path, start_cmd: $cmd, env_file: $env, added: (now | strftime("%Y-%m-%d %H:%M:%S"))}')
    
    jq ".bots += [$new_bot]" "$CONFIG_FILE" > tmp.$$.json && mv tmp.$$.json "$CONFIG_FILE"
    
    # Start with PM2
    echo -e "${YELLOW}Starting bot with PM2...${NC}"
    
    cd "$bot_path"
    if [ -n "$env_file" ] && [ -f "$env_file" ]; then
        pm2 start --name "$bot_name" --cwd "$bot_path" -- $start_cmd
    else
        pm2 start --name "$bot_name" --cwd "$bot_path" -- $start_cmd
    fi
    pm2 save
    
    log "Added bot: $bot_name from $repo_url"
    
    echo -e "\n${GREEN}✅ Bot '$bot_name' added and started successfully!${NC}"
    echo -e "${BLUE}Tip: Use 'pm2 logs $bot_name' to view logs${NC}"
    
    read -p "$(echo -e ${CYAN}Press Enter to continue...${NC})"
    main_menu
}

add_page() {
    show_banner
    echo -e "${BOLD}🌐 Add New Page${NC}\n"
    
    read -p "$(echo -e ${CYAN}GitHub repo URL: ${NC})" repo_url
    
    if [ -z "$repo_url" ]; then
        echo -e "${RED}URL cannot be empty${NC}"
        sleep 2
        add_repository
        return
    fi
    
    repo_name=$(basename "$repo_url" .git)
    
    read -p "$(echo -e ${CYAN}Page name \(default: $repo_name\): ${NC})" page_name
    page_name=${page_name:-$repo_name}
    
    echo -e "\n${BOLD}URL Path Configuration:${NC}"
    echo -e "  ${YELLOW}1)${NC} Root (opencs.dev/)"
    echo -e "  ${YELLOW}2)${NC} Subdirectory (opencs.dev/something)"
    
    read -p "$(echo -e ${CYAN}Select: ${NC})" path_choice
    
    case $path_choice in
        1) 
            url_path="/"
            page_dir="$PAGES_DIR"
            ;;
        2)
            read -p "$(echo -e ${CYAN}Subdirectory name \(e.g., tools, docs\): ${NC})" subdir
            url_path="/$subdir"
            page_dir="$PAGES_DIR/$subdir"
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            sleep 1
            add_page
            return
            ;;
    esac
    
    read -p "$(echo -e ${CYAN}Build command \(optional, e.g., npm run build\): ${NC})" build_cmd
    read -p "$(echo -e ${CYAN}Build output directory \(e.g., dist, build, . for root\): ${NC})" build_dir
    build_dir=${build_dir:-.}
    
    echo -e "\n${YELLOW}Cloning repository...${NC}"
    
    temp_dir="$REPOS_DIR/$page_name"
    
    if [ -d "$temp_dir" ]; then
        echo -e "${YELLOW}Directory exists, pulling latest...${NC}"
        cd "$temp_dir" && git pull
    else
        git clone "$repo_url" "$temp_dir"
    fi
    
    cd "$temp_dir"
    
    # Build if needed
    if [ -n "$build_cmd" ]; then
        if [ -f "package.json" ]; then
            echo -e "${YELLOW}Installing dependencies...${NC}"
            npm install
        fi
        echo -e "${YELLOW}Building...${NC}"
        eval $build_cmd
    fi
    
    # Copy to web directory
    echo -e "${YELLOW}Deploying to $page_dir...${NC}"
    mkdir -p "$page_dir"
    
    if [ "$build_dir" = "." ]; then
        rsync -av --delete --exclude='.git' --exclude='node_modules' "$temp_dir/" "$page_dir/"
    else
        rsync -av --delete "$temp_dir/$build_dir/" "$page_dir/"
    fi
    
    # Add to config
    local new_page=$(jq -n \
        --arg name "$page_name" \
        --arg url "$repo_url" \
        --arg path "$temp_dir" \
        --arg webpath "$page_dir" \
        --arg urlpath "$url_path" \
        --arg build "$build_cmd" \
        --arg builddir "$build_dir" \
        '{name: $name, url: $url, repo_path: $path, web_path: $webpath, url_path: $urlpath, build_cmd: $build, build_dir: $builddir, added: (now | strftime("%Y-%m-%d %H:%M:%S"))}')
    
    jq ".pages += [$new_page]" "$CONFIG_FILE" > tmp.$$.json && mv tmp.$$.json "$CONFIG_FILE"
    
    # Update nginx config
    sudo /home/deploy/management/update_nginx.sh
    
    log "Added page: $page_name from $repo_url at $url_path"
    
    echo -e "\n${GREEN}✅ Page '$page_name' deployed successfully!${NC}"
    echo -e "${BLUE}URL: https://opencs.dev$url_path${NC}"
    
    read -p "$(echo -e ${CYAN}Press Enter to continue...${NC})"
    main_menu
}

manage_bots() {
    show_banner
    echo -e "${BOLD}🤖 Bot Management${NC}\n"
    
    local bots=$(jq -r '.bots[] | .name' "$CONFIG_FILE" 2>/dev/null)
    
    if [ -z "$bots" ]; then
        echo -e "${YELLOW}No bots registered yet.${NC}"
        read -p "$(echo -e ${CYAN}Press Enter to continue...${NC})"
        main_menu
        return
    fi
    
    echo -e "${BOLD}Registered Bots:${NC}\n"
    
    local i=1
    while IFS= read -r bot; do
        local status=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$bot\") | .pm2_env.status" 2>/dev/null)
        if [ "$status" = "online" ]; then
            echo -e "  ${YELLOW}$i)${NC} ${GREEN}●${NC} $bot (running)"
        else
            echo -e "  ${YELLOW}$i)${NC} ${RED}●${NC} $bot (stopped)"
        fi
        ((i++))
    done <<< "$bots"
    
    echo -e "\n  ${YELLOW}a)${NC} Start all bots"
    echo -e "  ${YELLOW}s)${NC} Stop all bots"
    echo -e "  ${YELLOW}r)${NC} Restart all bots"
    echo -e "  ${YELLOW}l)${NC} View logs"
    echo -e "  ${YELLOW}b)${NC} Back\n"
    
    read -p "$(echo -e ${CYAN}Select bot number or action: ${NC})" choice
    
    case $choice in
        a|A) pm2 start all; echo -e "${GREEN}All bots started${NC}"; sleep 2; manage_bots ;;
        s|S) pm2 stop all; echo -e "${YELLOW}All bots stopped${NC}"; sleep 2; manage_bots ;;
        r|R) pm2 restart all; echo -e "${GREEN}All bots restarted${NC}"; sleep 2; manage_bots ;;
        l|L) pm2 logs --lines 50; read -p "Press Enter..."; manage_bots ;;
        b|B) main_menu ;;
        [0-9]*)
            local bot_name=$(echo "$bots" | sed -n "${choice}p")
            if [ -n "$bot_name" ]; then
                manage_single_bot "$bot_name"
            else
                echo -e "${RED}Invalid selection${NC}"
                sleep 1
                manage_bots
            fi
            ;;
        *) echo -e "${RED}Invalid option${NC}"; sleep 1; manage_bots ;;
    esac
}

manage_single_bot() {
    local bot_name=$1
    show_banner
    echo -e "${BOLD}🤖 Managing: $bot_name${NC}\n"
    
    local status=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$bot_name\") | .pm2_env.status" 2>/dev/null)
    local uptime=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$bot_name\") | .pm2_env.pm_uptime" 2>/dev/null)
    
    if [ "$status" = "online" ]; then
        echo -e "Status: ${GREEN}● Running${NC}"
    else
        echo -e "Status: ${RED}● Stopped${NC}"
    fi
    
    echo -e "\n${BOLD}Actions:${NC}\n"
    echo -e "  ${YELLOW}1)${NC} Start"
    echo -e "  ${YELLOW}2)${NC} Stop"
    echo -e "  ${YELLOW}3)${NC} Restart"
    echo -e "  ${YELLOW}4)${NC} View logs"
    echo -e "  ${YELLOW}5)${NC} Pull updates"
    echo -e "  ${YELLOW}6)${NC} Remove bot"
    echo -e "  ${YELLOW}b)${NC} Back\n"
    
    read -p "$(echo -e ${CYAN}Select action: ${NC})" action
    
    case $action in
        1) pm2 start "$bot_name"; echo -e "${GREEN}Started${NC}"; sleep 2 ;;
        2) pm2 stop "$bot_name"; echo -e "${YELLOW}Stopped${NC}"; sleep 2 ;;
        3) pm2 restart "$bot_name"; echo -e "${GREEN}Restarted${NC}"; sleep 2 ;;
        4) pm2 logs "$bot_name" --lines 100; read -p "Press Enter..." ;;
        5) pull_bot_updates "$bot_name" ;;
        6) remove_bot "$bot_name"; manage_bots; return ;;
        b|B) manage_bots; return ;;
    esac
    manage_single_bot "$bot_name"
}

pull_bot_updates() {
    local bot_name=$1
    local bot_path=$(jq -r ".bots[] | select(.name==\"$bot_name\") | .path" "$CONFIG_FILE")
    
    echo -e "${YELLOW}Pulling updates for $bot_name...${NC}"
    
    cd "$bot_path"
    git pull
    
    if [ -f "package.json" ]; then
        npm install
    elif [ -f "requirements.txt" ]; then
        source venv/bin/activate 2>/dev/null
        pip install -r requirements.txt
    fi
    
    pm2 restart "$bot_name"
    
    log "Updated bot: $bot_name"
    echo -e "${GREEN}Updates applied and bot restarted${NC}"
    sleep 2
}

remove_bot() {
    local bot_name=$1
    
    read -p "$(echo -e ${RED}Are you sure you want to remove $bot_name? \(y/N\): ${NC})" confirm
    
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        pm2 delete "$bot_name" 2>/dev/null
        pm2 save
        
        local bot_path=$(jq -r ".bots[] | select(.name==\"$bot_name\") | .path" "$CONFIG_FILE")
        rm -rf "$bot_path"
        
        jq "del(.bots[] | select(.name==\"$bot_name\"))" "$CONFIG_FILE" > tmp.$$.json && mv tmp.$$.json "$CONFIG_FILE"
        
        log "Removed bot: $bot_name"
        echo -e "${GREEN}Bot removed${NC}"
    else
        echo -e "${YELLOW}Cancelled${NC}"
    fi
    sleep 2
}

manage_pages() {
    show_banner
    echo -e "${BOLD}🌐 Page Management${NC}\n"
    
    local pages=$(jq -r '.pages[] | "\(.name)|\(.url_path)"' "$CONFIG_FILE" 2>/dev/null)
    
    if [ -z "$pages" ]; then
        echo -e "${YELLOW}No pages registered yet.${NC}"
        read -p "$(echo -e ${CYAN}Press Enter to continue...${NC})"
        main_menu
        return
    fi
    
    echo -e "${BOLD}Deployed Pages:${NC}\n"
    
    local i=1
    while IFS='|' read -r name path; do
        echo -e "  ${YELLOW}$i)${NC} $name → opencs.dev$path"
        ((i++))
    done <<< "$pages"
    
    echo -e "\n  ${YELLOW}u)${NC} Update all pages"
    echo -e "  ${YELLOW}b)${NC} Back\n"
    
    read -p "$(echo -e ${CYAN}Select page number or action: ${NC})" choice
    
    case $choice in
        u|U) update_all_pages; manage_pages ;;
        b|B) main_menu ;;
        [0-9]*)
            local page_name=$(echo "$pages" | sed -n "${choice}p" | cut -d'|' -f1)
            if [ -n "$page_name" ]; then
                manage_single_page "$page_name"
            else
                echo -e "${RED}Invalid selection${NC}"
                sleep 1
                manage_pages
            fi
            ;;
        *) echo -e "${RED}Invalid option${NC}"; sleep 1; manage_pages ;;
    esac
}

manage_single_page() {
    local page_name=$1
    show_banner
    echo -e "${BOLD}🌐 Managing: $page_name${NC}\n"
    
    local page_info=$(jq -r ".pages[] | select(.name==\"$page_name\")" "$CONFIG_FILE")
    local url_path=$(echo "$page_info" | jq -r '.url_path')
    local repo_url=$(echo "$page_info" | jq -r '.url')
    
    echo -e "URL: ${BLUE}https://opencs.dev$url_path${NC}"
    echo -e "Repo: $repo_url"
    
    echo -e "\n${BOLD}Actions:${NC}\n"
    echo -e "  ${YELLOW}1)${NC} Pull updates & redeploy"
    echo -e "  ${YELLOW}2)${NC} View files"
    echo -e "  ${YELLOW}3)${NC} Remove page"
    echo -e "  ${YELLOW}b)${NC} Back\n"
    
    read -p "$(echo -e ${CYAN}Select action: ${NC})" action
    
    case $action in
        1) update_single_page "$page_name" ;;
        2) 
            local web_path=$(echo "$page_info" | jq -r '.web_path')
            ls -la "$web_path"
            read -p "Press Enter..."
            ;;
        3) remove_page "$page_name"; manage_pages; return ;;
        b|B) manage_pages; return ;;
    esac
    manage_single_page "$page_name"
}

update_single_page() {
    local page_name=$1
    local page_info=$(jq -r ".pages[] | select(.name==\"$page_name\")" "$CONFIG_FILE")
    local repo_path=$(echo "$page_info" | jq -r '.repo_path')
    local web_path=$(echo "$page_info" | jq -r '.web_path')
    local build_cmd=$(echo "$page_info" | jq -r '.build_cmd')
    local build_dir=$(echo "$page_info" | jq -r '.build_dir')
    
    echo -e "${YELLOW}Pulling updates...${NC}"
    cd "$repo_path"
    git pull
    
    if [ -f "package.json" ]; then
        npm install
    fi
    
    if [ "$build_cmd" != "null" ] && [ -n "$build_cmd" ]; then
        echo -e "${YELLOW}Building...${NC}"
        eval $build_cmd
    fi
    
    echo -e "${YELLOW}Deploying...${NC}"
    if [ "$build_dir" = "." ] || [ "$build_dir" = "null" ]; then
        rsync -av --delete --exclude='.git' --exclude='node_modules' "$repo_path/" "$web_path/"
    else
        rsync -av --delete "$repo_path/$build_dir/" "$web_path/"
    fi
    
    log "Updated page: $page_name"
    echo -e "${GREEN}Page updated successfully!${NC}"
    sleep 2
}

update_all_pages() {
    echo -e "${YELLOW}Updating all pages...${NC}"
    
    local pages=$(jq -r '.pages[].name' "$CONFIG_FILE" 2>/dev/null)
    
    while IFS= read -r page; do
        echo -e "\n${BLUE}Updating $page...${NC}"
        update_single_page "$page"
    done <<< "$pages"
    
    echo -e "\n${GREEN}All pages updated!${NC}"
    sleep 2
}

remove_page() {
    local page_name=$1
    
    read -p "$(echo -e ${RED}Are you sure you want to remove $page_name? \(y/N\): ${NC})" confirm
    
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        local page_info=$(jq -r ".pages[] | select(.name==\"$page_name\")" "$CONFIG_FILE")
        local repo_path=$(echo "$page_info" | jq -r '.repo_path')
        local web_path=$(echo "$page_info" | jq -r '.web_path')
        
        rm -rf "$repo_path"
        rm -rf "$web_path"
        
        jq "del(.pages[] | select(.name==\"$page_name\"))" "$CONFIG_FILE" > tmp.$$.json && mv tmp.$$.json "$CONFIG_FILE"
        
        sudo /home/deploy/management/update_nginx.sh
        
        log "Removed page: $page_name"
        echo -e "${GREEN}Page removed${NC}"
    else
        echo -e "${YELLOW}Cancelled${NC}"
    fi
    sleep 2
}

check_all_updates() {
    show_banner
    echo -e "${BOLD}🔄 Checking All Updates${NC}\n"
    
    echo -e "${BLUE}Checking bots...${NC}"
    local bots=$(jq -r '.bots[] | "\(.name)|\(.path)"' "$CONFIG_FILE" 2>/dev/null)
    
    while IFS='|' read -r name path; do
        if [ -n "$name" ] && [ -d "$path" ]; then
            cd "$path"
            git fetch
            local behind=$(git rev-list HEAD..origin/$(git rev-parse --abbrev-ref HEAD) --count 2>/dev/null || echo "0")
            if [ "$behind" -gt 0 ]; then
                echo -e "  ${YELLOW}●${NC} $name: ${YELLOW}$behind commits behind${NC}"
            else
                echo -e "  ${GREEN}●${NC} $name: up to date"
            fi
        fi
    done <<< "$bots"
    
    echo -e "\n${BLUE}Checking pages...${NC}"
    local pages=$(jq -r '.pages[] | "\(.name)|\(.repo_path)"' "$CONFIG_FILE" 2>/dev/null)
    
    while IFS='|' read -r name path; do
        if [ -n "$name" ] && [ -d "$path" ]; then
            cd "$path"
            git fetch
            local behind=$(git rev-list HEAD..origin/$(git rev-parse --abbrev-ref HEAD) --count 2>/dev/null || echo "0")
            if [ "$behind" -gt 0 ]; then
                echo -e "  ${YELLOW}●${NC} $name: ${YELLOW}$behind commits behind${NC}"
            else
                echo -e "  ${GREEN}●${NC} $name: up to date"
            fi
        fi
    done <<< "$pages"
    
    log "Checked updates for all repos"
    
    echo ""
    read -p "$(echo -e ${CYAN}Would you like to update all? \(y/N\): ${NC})" update_all
    
    if [ "$update_all" = "y" ] || [ "$update_all" = "Y" ]; then
        echo -e "\n${YELLOW}Updating all repositories...${NC}"
        
        while IFS='|' read -r name path; do
            if [ -n "$name" ]; then
                echo -e "${BLUE}Updating bot: $name${NC}"
                pull_bot_updates "$name"
            fi
        done <<< "$bots"
        
        update_all_pages
    fi
    
    read -p "$(echo -e ${CYAN}Press Enter to continue...${NC})"
    main_menu
}

view_repositories() {
    show_banner
    echo -e "${BOLD}📋 All Repositories${NC}\n"
    
    echo -e "${BOLD}🤖 Bots:${NC}"
    jq -r '.bots[] | "  • \(.name)\n    URL: \(.url)\n    Path: \(.path)\n    Command: \(.start_cmd)\n"' "$CONFIG_FILE" 2>/dev/null || echo "  No bots"
    
    echo -e "\n${BOLD}🌐 Pages:${NC}"
    jq -r '.pages[] | "  • \(.name)\n    URL: \(.url)\n    Path: opencs.dev\(.url_path)\n    Build: \(.build_cmd // "none")\n"' "$CONFIG_FILE" 2>/dev/null || echo "  No pages"
    
    read -p "$(echo -e ${CYAN}Press Enter to continue...${NC})"
    main_menu
}

view_logs() {
    show_banner
    echo -e "${BOLD}📜 Logs${NC}\n"
    
    echo -e "  ${YELLOW}1)${NC} Management logs"
    echo -e "  ${YELLOW}2)${NC} PM2 logs (bots)"
    echo -e "  ${YELLOW}3)${NC} Nginx access logs"
    echo -e "  ${YELLOW}4)${NC} Nginx error logs"
    echo -e "  ${YELLOW}b)${NC} Back\n"
    
    read -p "$(echo -e ${CYAN}Select: ${NC})" choice
    
    case $choice in
        1) tail -100 "$LOG_FILE"; read -p "Press Enter..." ;;
        2) pm2 logs --lines 100; read -p "Press Enter..." ;;
        3) sudo tail -100 /var/log/nginx/access.log; read -p "Press Enter..." ;;
        4) sudo tail -100 /var/log/nginx/error.log; read -p "Press Enter..." ;;
        b|B) main_menu; return ;;
    esac
    view_logs
}

settings_menu() {
    show_banner
    echo -e "${BOLD}⚙️  Settings${NC}\n"
    
    echo -e "  ${YELLOW}1)${NC} Configure auto-update interval"
    echo -e "  ${YELLOW}2)${NC} View webhook secret"
    echo -e "  ${YELLOW}3)${NC} Regenerate webhook secret"
    echo -e "  ${YELLOW}4)${NC} Test nginx config"
    echo -e "  ${YELLOW}5)${NC} Reload nginx"
    echo -e "  ${YELLOW}b)${NC} Back\n"
    
    read -p "$(echo -e ${CYAN}Select: ${NC})" choice
    
    case $choice in
        1) configure_cron ;;
        2) cat "$MANAGEMENT_DIR/config/webhook_secret" 2>/dev/null || echo "Not configured"; read -p "Press Enter..." ;;
        3) 
            openssl rand -hex 20 > "$MANAGEMENT_DIR/config/webhook_secret"
            echo -e "${GREEN}New secret generated:${NC}"
            cat "$MANAGEMENT_DIR/config/webhook_secret"
            read -p "Press Enter..."
            ;;
        4) sudo nginx -t; read -p "Press Enter..." ;;
        5) sudo systemctl reload nginx; echo -e "${GREEN}Nginx reloaded${NC}"; sleep 2 ;;
        b|B) main_menu; return ;;
    esac
    settings_menu
}

configure_cron() {
    echo -e "\n${BOLD}Auto-update interval:${NC}"
    echo -e "  ${YELLOW}1)${NC} Every hour"
    echo -e "  ${YELLOW}2)${NC} Every 6 hours"
    echo -e "  ${YELLOW}3)${NC} Every 12 hours"
    echo -e "  ${YELLOW}4)${NC} Daily"
    echo -e "  ${YELLOW}5)${NC} Disable\n"
    
    read -p "$(echo -e ${CYAN}Select: ${NC})" interval
    
    # Remove existing cron
    crontab -l 2>/dev/null | grep -v "auto_update.sh" | crontab -
    
    case $interval in
        1) (crontab -l 2>/dev/null; echo "0 * * * * $MANAGEMENT_DIR/auto_update.sh") | crontab - ;;
        2) (crontab -l 2>/dev/null; echo "0 */6 * * * $MANAGEMENT_DIR/auto_update.sh") | crontab - ;;
        3) (crontab -l 2>/dev/null; echo "0 */12 * * * $MANAGEMENT_DIR/auto_update.sh") | crontab - ;;
        4) (crontab -l 2>/dev/null; echo "0 0 * * * $MANAGEMENT_DIR/auto_update.sh") | crontab - ;;
        5) echo -e "${YELLOW}Auto-updates disabled${NC}" ;;
    esac
    
    echo -e "${GREEN}Cron updated${NC}"
    sleep 2
}

# Quick commands for non-interactive use
case "$1" in
    update) check_all_updates ;;
    status) pm2 list ;;
    *) main_menu ;;
esac
