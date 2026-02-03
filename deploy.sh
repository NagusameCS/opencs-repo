#!/bin/bash
cd /home/deploy/management
git fetch origin
git reset --hard origin/main
cd webui && npm install
pm2 restart vps-portal
echo "Deploy complete at $(date)"
