"""
core/tasks.py
Lightweight periodic task helpers — no external scheduler needed.
"""
import logging
from datetime import timedelta

from django.utils import timezone

logger = logging.getLogger(__name__)


def mark_completed_flights():
    """
    Finds every SCHEDULED or DELAYED flight whose arrival_time is more than
    1 hour in the past and marks it as COMPLETED.

    Safe to call from multiple threads / workers — Django's .update() is atomic.
    Returns the number of rows updated.
    """
    # Import here to avoid AppRegistry-not-ready errors when called early
    from core.models import Flight

    cutoff = timezone.now() - timedelta(hours=1)
    updated = Flight.objects.filter(
        status__in=["SCHEDULED", "DELAYED"],
        arrival_time__lte=cutoff,
    ).update(status="COMPLETED")

    if updated:
        logger.info("[AeroSync] Auto-completed %d flight(s).", updated)

    return updated
