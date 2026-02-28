#!/bin/bash

# Test script for AeroSync payment flow
echo "Testing AeroSync payment flow..."

# Variables
BASE_URL="http://localhost:8000"
EMAIL="testuser@example.com"
PASSWORD="testpassword123"
REFERENCE_NUMBER="TEST_REF_$(date +%s)"

echo "1. Creating a user account..."
curl -X POST "$BASE_URL/api/auth/register/" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"testuser\",
    \"email\": \"$EMAIL\",
    \"full_name\": \"Test User\",
    \"password\": \"$PASSWORD\",
    \"password2\": \"$PASSWORD\"
  }"

echo -e "\n2. Logging in to get token..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login/" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"testuser\",
    \"password\": \"$PASSWORD\"
  }" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access'))")

if [ -z "$TOKEN" ]; then
  echo "Failed to get token"
  exit 1
fi

echo "Token obtained: ${TOKEN:0:20}..."

echo -e "\n3. Getting available flights..."
curl -X GET "$BASE_URL/api/flights/" \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n4. Creating a booking for a SCHEDULED flight (assuming flight id 1 exists and is SCHEDULED)..."
curl -X POST "$BASE_URL/api/bookings/create_booking/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"flight_id\": 1,
    \"seat_id\": 1,
    \"reference_number\": \"$REFERENCE_NUMBER\",
    \"passenger_full_name\": \"Test Passenger\",
    \"passport_number\": \"P12345678\",
    \"nationality\": \"Kenyan\"
  }"

echo -e "\n5. Initiating payment for the booking (assuming booking id 1)..."
curl -X POST "$BASE_URL/api/bookings/1/initiate_payment/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{}"

echo -e "\n6. Checking payment status (assuming booking id 1)..."
curl -X GET "$BASE_URL/api/bookings/1/payment_status/" \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n7. Trying to download boarding pass before payment (should return 402)..."
curl -X GET "$BASE_URL/api/bookings/1/boarding_pass_png/" \
  -H "Authorization: Bearer $TOKEN"

echo -e "\nTest completed!"