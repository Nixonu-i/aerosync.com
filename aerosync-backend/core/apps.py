from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        import core.signals  # noqa: F401
        self._start_flight_auto_complete()

    # ------------------------------------------------------------------
    # Background scheduler: auto-complete past flights every 5 minutes.
    # Uses a daemon thread so it dies with the server process.
    # The underlying DB update() is idempotent, so multi-worker Gunicorn
    # is fine — concurrent runs just find nothing left to update.
    # ------------------------------------------------------------------
    def _start_flight_auto_complete(self):
        import threading
        import time
        import logging

        logger = logging.getLogger(__name__)

        def loop():
            # Brief boot delay so Django's ORM is fully ready
            time.sleep(20)
            logger.info("[AeroSync] Flight auto-complete scheduler started (interval: 5 min).")
            while True:
                try:
                    from core.tasks import mark_completed_flights
                    mark_completed_flights()
                except Exception as exc:  # pragma: no cover
                    logger.error("[AeroSync] Auto-complete error: %s", exc)
                time.sleep(5 * 60)  # check every 5 minutes

        t = threading.Thread(target=loop, daemon=True, name="flight-auto-complete")
        t.start()