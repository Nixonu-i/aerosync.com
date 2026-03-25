# Pesapal Payment Gateway Integration Guide

## Overview
AeroSync now supports Pesapal payment gateway for processing flight booking payments securely.

## Features Implemented

### Backend (Django)
- ✅ **PesapalService** - Complete API wrapper for Pesapal v3
  - Token authentication with caching
  - Order submission
  - Transaction status checking
  - IPN (Instant Payment Notification) handling

- ✅ **API Endpoints**
  - `POST /api/payments/pesapal/initiate/<booking_id>/` - Start payment
  - `GET /api/payments/pesapal/callback/` - User callback after payment
  - `POST /api/payments/pesapal/ipn/` - Pesapal IPN webhook
  - `GET /api/payments/pesapal/status/<payment_id>/` - Check payment status

- ✅ **Payment Model Updates**
  - Added 'PESAPAL' to provider choices
  - Automatic booking payment status updates
  - Payment history tracking

### Frontend (React)
- ✅ **PesapalPayment Component** - Modal-based payment flow
  - Automatic payment initiation
  - Redirect to Pesapal iframe
  - Real-time status polling
  - Success/failure handling

## Setup Instructions

### 1. Get Pesapal Credentials

1. Visit [Pesapal Developer Portal](https://developer.pesapal.com/)
2. Create an account (sandbox account for testing)
3. Register your application to get:
   - Consumer Key
   - Consumer Secret

### 2. Configure Backend

Edit `/aerosync-backend/.env`:

```bash
# For Sandbox Testing
PESAPAL_CONSUMER_KEY=your_sandbox_consumer_key
PESAPAL_CONSUMER_SECRET=your_sandbox_secret
PESAPAL_ENVIRONMENT=sandbox

# For Production (when ready)
# PESAPAL_CONSUMER_KEY=your_production_key
# PESAPAL_CONSUMER_SECRET=your_production_secret
# PESAPAL_ENVIRONMENT=production
```

### 3. Restart Backend Service

```bash
sudo systemctl restart aerosync
```

### 4. Test the Integration

1. **Create a booking** as a customer
2. **Select "Pesapal"** as payment method
3. **Complete payment** on Pesapal sandbox
4. **Verify** booking is marked as paid

## How It Works

### Payment Flow

```
1. User creates booking → Booking saved (is_paid=False)
2. User selects Pesapal → Frontend opens payment modal
3. Backend calls Pesapal API → Gets redirect URL
4. User redirected to Pesapal → Completes payment
5. Pesapal sends IPN → Backend updates payment status
6. Frontend polls status → Detects success
7. Booking marked as paid → Boarding pass available
```

### IPN (Instant Payment Notification)

Pesapal automatically notifies your backend when:
- Payment is completed
- Payment fails
- Payment is cancelled

The IPN endpoint (`/api/payments/pesapal/ipn/`) automatically:
- Validates the notification
- Updates payment status
- Marks booking as paid (if successful)
- Returns acknowledgment to Pesapal

### Security

- ✅ JWT authentication for payment initiation
- ✅ Ownership verification (only booking owner can pay)
- ✅ Token caching to avoid unnecessary API calls
- ✅ HTTPS required for production callbacks
- ✅ Payment status validation before marking as paid

## Testing

### Sandbox Mode

Use sandbox credentials to test without real money:

```bash
PESAPAL_ENVIRONMENT=sandbox
```

Sandbox test cards are provided by Pesapal after registration.

### Production Mode

When ready for live payments:

```bash
PESAPAL_ENVIRONMENT=production
PESAPAL_CONSUMER_KEY=your_live_key
PESAPAL_CONSUMER_SECRET=your_live_secret
```

## Troubleshooting

### Common Issues

**1. "Authentication failed"**
- Check consumer key and secret in `.env`
- Ensure they match the environment (sandbox vs production)
- Restart backend after changing `.env`

**2. "Callback URL not accessible"**
- Ensure your domain is publicly accessible
- For local dev, use Cloudflare tunnel or ngrok
- Update `PESAPAL_CALLBACK_URL` in `.env`

**3. "Payment not updating"**
- Check IPN logs in backend
- Verify Pesapal can reach your IPN URL
- Check firewall/security settings

### Logs

Check backend logs for payment activity:

```bash
sudo journalctl -u aerosync -f | grep -i pesapal
```

Look for:
- ✅ "Pesapal: New access token obtained"
- ✅ "Pesapal order submitted"
- 🔔 "Pesapal IPN received"
- ❌ Error messages

## API Reference

### Initiate Payment

```http
POST /api/payments/pesapal/initiate/<booking_id>/
Authorization: Bearer <JWT_TOKEN>

Response: {
  "redirect_url": "https://pay.pesapal.com/...",
  "order_tracking_id": "abc123",
  "payment_id": 123,
  "amount": "5000.00",
  "currency": "KES"
}
```

### Check Status

```http
GET /api/payments/pesapal/status/<payment_id>/
Authorization: Bearer <JWT_TOKEN>

Response: {
  "payment": {
    "id": 123,
    "status": "SUCCESS",
    "amount": "5000.00"
  },
  "booking_is_paid": true,
  "pesapal_status": {
    "status": "COMPLETED",
    "confirmation_code": "ABC123XYZ"
  }
}
```

## Next Steps

- [ ] Add M-Pesa integration via Pesapal
- [ ] Support multiple currencies
- [ ] Add refund functionality
- [ ] Payment analytics dashboard
- [ ] Recurring payments for subscriptions

## Support

For Pesapal-specific issues:
- Email: support@pesapal.com
- Docs: https://developer.pesapal.com/documentation

For AeroSync integration issues:
- Check backend logs
- Review this guide
- Contact development team
