# aerosync

This is the Django backend for the AeroSync application.

## Static assets and admin styling

Because the Django admin (and other static files) are not served by
`runserver` when `DEBUG=False`, make sure to collect and serve them:

```bash
python manage.py collectstatic --noinput
```

The project uses **Whitenoise** to serve files directly from the
`STATIC_ROOT`.  The dependency is listed in `requirements.txt` and the
middleware is already configured in `settings.py`.

If you prefer to serve `/static/` from nginx or another web server,
point the `location /static/` block at the `STATIC_ROOT` directory (by
default `.../aerosync-backend/staticfiles`).

