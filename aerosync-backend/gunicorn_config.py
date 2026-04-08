bind = "127.0.0.1:8000"

workers = 3
worker_class = "sync"

max_requests = 1000
max_requests_jitter = 100

<<<<<<< HEAD
timeout = 120
=======
# Increased timeout for SSE long-polling connections
timeout = 300
>>>>>>> 9007297460809f07bfaa364ef37dd6359fbbe48b
graceful_timeout = 30
keepalive = 5

preload_app = True

<<<<<<< HEAD
accesslog = "-"
errorlog = "-"
loglevel = "warning"
=======
# Disable access logs (we use custom logging in views)
accesslog = None
errorlog = "-"
loglevel = "info"  # Show info level to capture our custom logs
>>>>>>> 9007297460809f07bfaa364ef37dd6359fbbe48b
capture_output = True
