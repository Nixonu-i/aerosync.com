#!/usr/bin/env python
"""
Diagnostic script to check if the Via Cities endpoint is working correctly.
Run this from the aerosync-backend directory:
  python check_via_cities.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aerosync.settings')
django.setup()

from core.models import Flight

print("=" * 60)
print("VIA CITIES DIAGNOSTIC CHECK")
print("=" * 60)

# Check if route_type field exists
try:
    flights_with_route_type = Flight.objects.filter(route_type='VIA')
    print("✅ route_type field exists in database")
except Exception as e:
    print(f"❌ route_type field missing: {e}")
    print("\n🔧 SOLUTION: Run migrations:")
    print("   python manage.py makemigrations core")
    print("   python manage.py migrate")
    exit(1)

# Check if via_cities field exists
try:
    via_flights = Flight.objects.filter(route_type='VIA').values_list('via_cities', flat=True)
    print("✅ via_cities field exists in database")
except Exception as e:
    print(f"❌ via_cities field missing: {e}")
    print("\n🔧 SOLUTION: Run migrations:")
    print("   python manage.py makemigrations core")
    print("   python manage.py migrate")
    exit(1)

# Count VIA flights
via_count = Flight.objects.filter(route_type='VIA').count()
direct_count = Flight.objects.filter(route_type='DIRECT').count()
total_count = Flight.objects.count()

print(f"\n📊 Flight Statistics:")
print(f"   Total flights: {total_count}")
print(f"   DIRECT flights: {direct_count}")
print(f"   VIA flights: {via_count}")

if via_count == 0:
    print("\n⚠️  No VIA flights found in database!")
    print("\n📝 To test the via-cities endpoint, you need to:")
    print("   1. Create a VIA flight in admin panel")
    print("   2. Set route_type='VIA'")
    print("   3. Add via_cities (e.g., ['Mombasa', 'Dar es Salaam'])")
    print("\n   Or run this Python code in Django shell:")
    print("   python manage.py shell")
    print("   >>> from core.models import Flight, Airport, Aircraft")
    print("   >>> aircraft = Aircraft.objects.first()")
    print("   >>> dep = Airport.objects.first()")
    print("   >>> arr = Airport.objects.last()")
    print("   >>> Flight.objects.create(")
    print("   ...     airline='Test Air',")
    print("   ...     flight_number='TEST123',")
    print("   ...     aircraft=aircraft,")
    print("   ...     departure_airport=dep,")
    print("   ...     arrival_airport=arr,")
    print("   ...     route_type='VIA',")
    print("   ...     via_cities=['Mombasa', 'Dar es Salaam'],")
    print("   ...     price=5000,")
    print("   ...     trip_type='ONE_WAY'")
    print("   ... )")
else:
    print(f"\n✅ Found {via_count} VIA flight(s)")
    
    # Extract unique cities
    all_cities = set()
    for flight in Flight.objects.filter(route_type='VIA'):
        if flight.via_cities:
            all_cities.update(flight.via_cities)
    
    print(f"   Unique via cities: {sorted(list(all_cities))}")

print("\n" + "=" * 60)
print("DIAGNOSTIC COMPLETE")
print("=" * 60)
