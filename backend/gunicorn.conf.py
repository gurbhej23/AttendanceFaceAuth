import os

bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
workers = int(os.getenv("WEB_CONCURRENCY", "1"))
threads = int(os.getenv("GUNICORN_THREADS", "2"))
timeout = int(os.getenv("GUNICORN_TIMEOUT", "120"))
graceful_timeout = int(os.getenv("GUNICORN_GRACEFUL_TIMEOUT", "30"))
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", "75"))
worker_connections = int(os.getenv("GUNICORN_WORKER_CONNECTIONS", "1000"))
forwarded_allow_ips = os.getenv("FORWARDED_ALLOW_IPS", "*")
# ASGI worker for Django Channels WebSockets (chat).
worker_class = "uvicorn.workers.UvicornWorker"
# Bind the port before loading Django/TensorFlow in workers (critical on Render).
preload_app = False
max_requests = 1000
max_requests_jitter = 50
