#!/usr/bin/env bash
set -o errexit

export PIP_DEFAULT_TIMEOUT="${PIP_DEFAULT_TIMEOUT:-100}"

pip install --upgrade pip
pip install --retries 10 -r requirements-prod.txt
chmod +x start.sh
