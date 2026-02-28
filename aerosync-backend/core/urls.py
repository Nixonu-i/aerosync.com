from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    FlightViewSet, BookingViewSet,
    AirportAdminViewSet, SeatAdminViewSet, FlightAdminViewSet,
    AircraftAdminViewSet, BookingAdminViewSet, UserAdminViewSet,
    AirlineAdminViewSet, AirlinePublicViewSet,
    AgentFlightViewSet, AgentBookingViewSet,
    SummaryReportView, VerifyQRView, ScanHistoryView,
    PaymentProviderView
)
from . import activity_views

router = DefaultRouter()
router.register(r"flights", FlightViewSet, basename="flights")
router.register(r"bookings", BookingViewSet, basename="bookings")
router.register(r"airlines", AirlinePublicViewSet, basename="airlines")

admin_router = DefaultRouter()
admin_router.register(r"airports", AirportAdminViewSet, basename="admin-airports")
admin_router.register(r"seats", SeatAdminViewSet, basename="admin-seats")
admin_router.register(r"flights", FlightAdminViewSet, basename="admin-flights")
admin_router.register(r"aircraft", AircraftAdminViewSet, basename="admin-aircraft")
admin_router.register(r"bookings", BookingAdminViewSet, basename="admin-bookings")
admin_router.register(r"users", UserAdminViewSet, basename="admin-users")
admin_router.register(r"airlines", AirlineAdminViewSet, basename="admin-airlines")

agent_router = DefaultRouter()
agent_router.register(r"flights",  AgentFlightViewSet,  basename="agent-flights")
agent_router.register(r"bookings", AgentBookingViewSet, basename="agent-bookings")

urlpatterns = [
    path("", include(router.urls)),
    path("admin/", include(admin_router.urls)),
    path("agent/", include(agent_router.urls)),

    path("reports/summary/", SummaryReportView.as_view()),
    path("verify/qr/",       VerifyQRView.as_view()),
    path("agent/scan-history/", ScanHistoryView.as_view()),
    path("payment-providers/", PaymentProviderView.as_view()),
    
    # User Activity Logging Endpoints
    path("admin/user-activities/", activity_views.get_user_activities),
    path("admin/user-activity-stats/", activity_views.get_user_activity_stats),
]