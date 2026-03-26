bind = "127.0.0.1:8000"

workers = 3
worker_class = "sync"

max_requests = 1000
max_requests_jitter = 100

timeout = 120
graceful_timeout = 30
keepalive = 5

preload_app = True

# Disable access logs (we use custom logging in views)
accesslog = None
errorlog = "-"
loglevel = "info"  # Show info level to capture our custom logs
capture_output = True
