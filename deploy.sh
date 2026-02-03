#!/bin/bash
cd /home/deploy/management/webui
git fetch origin
git reset --hard origin/main
npm install --production
pm2 restart vps-portal
echo "Deploy completed at $(date)"
