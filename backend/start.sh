#!/usr/bin/env bash
set -o errexit

export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings}"
export PORT="${PORT:-8000}"

# Daphne is the reference ASGI server for Django Channels and handles
# WebSocket upgrades reliably on Render (gunicorn+uvicorn often fails WS).
exec daphne -b 0.0.0.0 -p "${PORT}" --proxy-headers config.asgi:application
