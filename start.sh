#!/usr/bin/env bash
# Start script for Render deployment
# First build the frontend
cd /opt/render/project/src/frontend
npm install --silent
npm run build
cd /opt/render/project/src/backend
uvicorn app.main:app --host 0.0.0.0 --port $PORT