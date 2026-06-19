#!/usr/bin/env bash
set -o errexit

export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings}"
export PORT="${PORT:-8000}"
export FORWARDED_ALLOW_IPS="${FORWARDED_ALLOW_IPS:-*}"
export WEB_CONCURRENCY="${WEB_CONCURRENCY:-1}"

# Gunicorn binds the port before the worker loads Django/TensorFlow (required on Render).
# UvicornWorker serves ASGI so WebSocket call/chat signaling works.
exec gunicorn config.asgi:application \
  --config gunicorn.conf.py \
  --log-file - \
  --log-level info
