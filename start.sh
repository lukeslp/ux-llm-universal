#!/bin/bash
cd /home/coolhand/servers/geepers-chat
export $(cat .env | grep -v '^#' | xargs)
exec node dist/index.js
