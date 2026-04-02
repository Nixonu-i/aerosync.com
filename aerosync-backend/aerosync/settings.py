from pathlib import Path
import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# -------------------------------------------------------------------
# Core Security
# -------------------------------------------------------------------

SECRET_KEY = os.getenv("DJANGO_SECRET")
if not SECRET_KEY:
    raise Exception("DJANGO_SECRET must be set in production")

DEBUG = False

# ALLOWED_HOSTS is read from environment so that CI and production
# can control valid hostnames.  Earlier we were manually adding
# everything, but when the frontend is served from a custom URL such as
# `https://api.aerosync.live` you also need the backend to accept that
# host header.  A convenient pattern is to specify the base domain and
# then allow all its subdomains as well.
ALLOWED_HOSTS = [
    h.strip()
    for h in os.getenv("DJANGO_ALLOWED_HOSTS", "").split(",")
    if h.strip()
]

# automatically allow subdomains for each explicit host by inserting a
# leading-dot variant (Django treats ".example.com" as a wildcard).
# this saves you from having to update the env every time a new subdomain
# is used in development/tunneling.
expanded = set(ALLOWED_HOSTS)
for h in list(ALLOWED_HOSTS):
    if h and not h.startswith('.') and '.' in h:
        expanded.add('.' + h)
ALLOWED_HOSTS = list(expanded)

if not DEBUG and not ALLOWED_HOSTS:
    raise Exception("DJANGO_ALLOWED_HOSTS must be set in production")

# -------------------------------------------------------------------
# Installed Apps
# -------------------------------------------------------------------

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "accounts",
    "core",
    "channels",  # Django Channels for WebSocket support
]

# -------------------------------------------------------------------
# Middleware
# -------------------------------------------------------------------

# middleware configuration
# WhiteNoise is only needed when DEBUG=False; in development Django's
# staticfiles app will serve admin/css/js itself.  When WhiteNoise is
# active it intercepts /static/ requests first and will return 404 if the
# collected STATIC_ROOT is empty (which it is in dev), hence the missing
# admin styles you saw.
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # ensure users complete their profile on first login (customers/agents)
    "accounts.middleware.ProfileCompletionMiddleware",
    # block direct access to profile photos for security
    "accounts.middleware_block_media.BlockDirectMediaAccessMiddleware",
]
if not DEBUG:
    MIDDLEWARE.append("whitenoise.middleware.WhiteNoiseMiddleware")

MIDDLEWARE += [
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "core.middleware.UserActivityMiddleware",
    "core.db_middleware.DatabaseActivityMiddleware",
]

# -------------------------------------------------------------------
# Cloudflare / Reverse Proxy Support
# -------------------------------------------------------------------

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

# Defaults suitable for development (prevents devserver redirecting to HTTPS)
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_HSTS_SECONDS = 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
SECURE_BROWSER_XSS_FILTER = False
SECURE_CONTENT_TYPE_NOSNIFF = False
X_FRAME_OPTIONS = "SAMEORIGIN"

# Force HTTPS in production
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"

# Ensure local hosts are never forced to HTTPS (defensive override for development)
if '127.0.0.1' in ALLOWED_HOSTS or 'localhost' in ALLOWED_HOSTS:
    SECURE_SSL_REDIRECT = False
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False

# -------------------------------------------------------------------
# Templates
# -------------------------------------------------------------------

ROOT_URLCONF = "aerosync.urls"
WSGI_APPLICATION = "aerosync.wsgi.application"
ASGI_APPLICATION = "aerosync.asgi.application"

# Cache configuration for Pesapal token caching
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'pesapal-cache',
        'TIMEOUT': 3600,
    }
}

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

# -------------------------------------------------------------------
# Database
# -------------------------------------------------------------------

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME"),
        "USER": os.getenv("DB_USER"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
        "HOST": os.getenv("DB_HOST"),
        "PORT": os.getenv("DB_PORT", "5432"),
        "CONN_MAX_AGE": 600,
        "OPTIONS": {
            "sslmode": "require" if not DEBUG else "disable",
        },
    }
}

AUTH_USER_MODEL = "accounts.User"

# -------------------------------------------------------------------
# CORS (Cloudflare + Vercel Compatible)
# -------------------------------------------------------------------

# Some requests (our frontend sets axios.withCredentials) are sent with
# credentials mode "include".  if so the browser requires the response
# to include Access-Control-Allow-Credentials: true.  we previously kept
# this False because JSON‑Web‑Tokens live in the Authorization header, but
# setting it to True is harmless and simplifies local tunnelling / proxy
# scenarios where the browser might still attach cookies.
CORS_ALLOW_CREDENTIALS = True

CORS_ALLOWED_ORIGINS = [
    "https://aerosync.live",
    "https://www.aerosync.live",
    "https://api.aerosync.live",  # <-- add backend tunnel domain
    "http://127.0.0.1:5173",       # local dev
    "http://localhost:5173",       # local dev
    "https://*.pages.dev",         # Cloudflare Pages preview deployments
]

# Allow Vercel deployments
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.vercel\.app$",
    r"^https://.*\.pages\.dev$",   # Cloudflare Pages
]

# Allow your Cloudflare tunnel domain
cloudflare_domain = os.getenv("CLOUDFLARE_DOMAIN")
if cloudflare_domain:
    CORS_ALLOWED_ORIGINS.append(f"https://{cloudflare_domain}")

CORS_ALLOW_HEADERS = [
    "accept",
    "authorization",
    "content-type",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

# -------------------------------------------------------------------
# REST Framework / JWT
# -------------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MIN", "480"))),  # 8 hours
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "30"))),  # 30 days
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

# -------------------------------------------------------------------
# Static / Media
# -------------------------------------------------------------------

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Media files configuration - store outside project directory
MEDIA_URL = "/media/"
# Store media files in a dedicated directory outside the project
# In development: ~/aerosync-media/ or /var/aerosync/media/
# In production: Use cloud storage (S3, Cloudinary, etc.)
import os
MEDIA_ROOT = os.path.expanduser("~/aerosync-media/")  # Outside project

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# -------------------------------------------------------------------
# Logging
# -------------------------------------------------------------------

LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{message}",
            "style": "{",
        },
    },
    "handlers": {
        "file": {
            "class": "logging.FileHandler",
            "filename": LOG_DIR / "django.log",
            "formatter": "verbose",
        },
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "simple",
            "level": "INFO",
        },
    },
    "loggers": {
        "core.middleware": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "core.views": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
    },
    "root": {
        "handlers": ["file", "console"],
        "level": "INFO",
    },
}

# -------------------------------------------------------------------
# Cloudflare Tunnel
# -------------------------------------------------------------------

TUNNEL = "aerosync-backend"
CREDENTIALS_FILE = "/home/nixii/.cloudflared/aerosync-backend.json"

INGRESS = [
    {
        "hostname": "api.aerosync.live",
        "service": "http://localhost:8000",
    },
    {
        "service": "http_status:404",
    },
]

# -------------------------------------------------------------------
# Email Configuration
# -------------------------------------------------------------------

# Check if Brevo API key is provided
BREVO_API_KEY = os.getenv('BREVO_API_KEY', '')

if BREVO_API_KEY and BREVO_API_KEY != 'xkeysib-your-api-key-here':
    # Use Brevo (SendGrid) for professional emails
    # Free tier: 300 emails/day
    EMAIL_BACKEND = 'sgbackend.SendGridBackend'
    SENDGRID_API_KEY = BREVO_API_KEY
    DEFAULT_FROM_EMAIL = 'AeroSync <noreply@aerosync.live>'
    SERVER_EMAIL = 'noreply@aerosync.live'
    print("✅ Using Brevo email backend")
else:
    # Fallback to Gmail OAuth 2.0
    GMAIL_OAUTH_CLIENT_ID = os.getenv('GMAIL_OAUTH_CLIENT_ID', '')
    GMAIL_OAUTH_CLIENT_SECRET = os.getenv('GMAIL_OAUTH_CLIENT_SECRET', '')
    GMAIL_OAUTH_REFRESH_TOKEN = os.getenv('GMAIL_OAUTH_REFRESH_TOKEN', '')
    GMAIL_OAUTH_TOKEN_URI = os.getenv('GMAIL_OAUTH_TOKEN_URI', 'https://oauth2.googleapis.com/token')
    GMAIL_SENDER_EMAIL = os.getenv('GMAIL_SENDER_EMAIL', '')
    
    # Gmail SMTP settings (used if OAuth fails)
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = 'smtp.gmail.com'
    EMAIL_PORT = 587
    EMAIL_USE_TLS = True
    EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
    EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
    DEFAULT_FROM_EMAIL = f'AeroSync <{GMAIL_SENDER_EMAIL}>' if GMAIL_SENDER_EMAIL else 'AeroSync <noreply@aerosync.live>'
    print("ℹ️  Using Gmail OAuth email backend")

# Email verification settings
EMAIL_VERIFICATION_EXPIRY_MINUTES = 15  # Code expires after 15 minutes

# -------------------------------------------------------------------
# Pesapal Payment Gateway Configuration
# -------------------------------------------------------------------

PESAPAL_CONSUMER_KEY = os.getenv('PESAPAL_CONSUMER_KEY', '')
PESAPAL_CONSUMER_SECRET = os.getenv('PESAPAL_CONSUMER_SECRET', '')
PESAPAL_ENVIRONMENT = os.getenv('PESAPAL_ENVIRONMENT', 'sandbox')  # 'sandbox' or 'production'

# Pesapal API URLs
PESAPAL_API_URLS = {
    'sandbox': 'https://cybqa.pesapal.com/pesapalv3',
    'production': 'https://pay.pesapal.com/v3',
}

# Callback URLs (must be publicly accessible)
PESAPAL_CALLBACK_URL = os.getenv('PESAPAL_CALLBACK_URL', 'https://api.aerosync.live/api/payments/pesapal/callback/')

# -------------------------------------------------------------------
# Django Channels Configuration (WebSocket support)
# -------------------------------------------------------------------

ASGI_APPLICATION = 'aerosync.asgi.application'

# Channel Layers configuration - use Redis for cross-worker communication
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [(os.getenv('REDIS_HOST', '127.0.0.1'), os.getenv('REDIS_PORT', 6379))],
            "capacity": 1500,  # Maximum number of messages to store
            "expiry": 10,  # Message expiry time in seconds
        },
    },
}
PESAPAL_IPN_URL = os.getenv('PESAPAL_IPN_URL', 'https://api.aerosync.live/api/payments/pesapal/ipn/')