bind = "127.0.0.1:8000"

workers = 3
worker_class = "sync"

max_requests = 1000
max_requests_jitter = 100

timeout = 120
graceful_timeout = 30
keepalive = 5

preload_app = True

accesslog = "-"
errorlog = "-"
loglevel = "warning"
capture_output = True
