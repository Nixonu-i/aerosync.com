# Pesapal Payment Testing Checklist

## Prerequisites
- [ ] Pesapal sandbox account created
- [ ] Consumer key and secret obtained from https://developer.pesapal.com/
- [ ] Credentials added to `.env` file (or use the provided `.env.pesapal` template)

## Setup Steps

### 1. Configure Backend
```bash
cd /home/nixii/Documents/aerosync/aerosync-backend
# Edit .env with your Pesapal credentials:
# PESAPAL_CONSUMER_KEY=your_key_here
# PESAPAL_CONSUMER_SECRET=your_secret_here
# PESAPAL_ENVIRONMENT=sandbox
```

### 2. Restart Backend Service
```bash
sudo systemctl restart aerosync
```

### 3. Verify Deployment
Check that Cloudflare Pages has deployed the latest frontend changes.

---

## Testing Flow

### Test Case 1: Initiate Pesapal Payment
- [ ] Login as a customer
- [ ] Navigate to Dashboard → Bookings
- [ ] Find a PENDING booking
- [ ] Click "Initiate Payment"
- [ ] Select "Pesapal 💳" from dropdown
- [ ] Click "Process Payment"

**Expected Result:**
- Payment modal closes
- Pesapal payment component opens
- Shows "Initializing secure payment..."
- Then shows "Continue to Payment →" button

### Test Case 2: Complete Payment on Pesapal
- [ ] Click "Continue to Payment"
- [ ] Pesapal iframe opens in new tab
- [ ] Complete payment using Pesapal test card
- [ ] Return to AeroSync

**Expected Result:**
- Frontend polls status every 3 seconds
- Detects payment completion
- Shows success message
- Booking marked as paid
- Boarding pass becomes available

### Test Case 3: Payment Status Polling
- [ ] Open browser console (F12)
- [ ] Initiate Pesapal payment
- [ ] Watch console logs

**Expected Logs:**
```
✅ Pesapal payment initiated: <tracking_id>
💳 Payment status: PENDING
💳 Payment status: PENDING
💳 Payment status: COMPLETED
✅ Payment SUCCESS for booking <id>
```

### Test Case 4: IPN Webhook
- [ ] Check backend logs after payment
```bash
sudo journalctl -u aerosync -f | grep -i pesapal
```

**Expected Logs:**
```
🔔 Pesapal IPN received: <tracking_id> - Status: COMPLETED
✅ Payment SUCCESS for booking <booking_id>
```

### Test Case 5: Failed Payment
- [ ] Initiate payment
- [ ] Cancel on Pesapal or use failed card
- [ ] Return to AeroSync

**Expected Result:**
- Shows error message
- Payment status = FAILED or CANCELLED
- Can retry payment

---

## API Testing (Optional)

### Test Initiate Payment Endpoint
```bash
curl -X POST https://api.aerosync.live/api/payments/pesapal/initiate/<booking_id>/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "redirect_url": "https://cybqa.pesapal.com/pesapalv3/...",
  "order_tracking_id": "abc123xyz",
  "payment_id": 123,
  "amount": "5000.00",
  "currency": "KES"
}
```

### Test Status Check Endpoint
```bash
curl -X GET https://api.aerosync.live/api/payments/pesapal/status/<payment_id>/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
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

---

## Troubleshooting

### Issue: "Authentication failed"
**Solution:** Check consumer key/secret in `.env`

### Issue: "Redirect URL not working"
**Solution:** Ensure callback URLs are publicly accessible (Cloudflare tunnel running)

### Issue: "Payment not updating"
**Solution:** 
- Check IPN can reach your server
- Verify firewall settings
- Check backend logs for errors

### Issue: "CORS error"
**Solution:** Already fixed - `*.pages.dev` added to allowed origins

---

## Success Criteria

✅ User can select Pesapal from payment options
✅ Payment modal opens with Pesapal iframe
✅ User completes payment on Pesapal
✅ System automatically detects payment completion
✅ Booking marked as paid
✅ Boarding pass becomes available for download
✅ IPN webhook receives and processes notification
✅ No manual intervention required

---

## Production Readiness

Before going live:
- [ ] Switch `PESAPAL_ENVIRONMENT=production`
- [ ] Use production credentials
- [ ] Update callback URLs to production domain
- [ ] Test with real money (small amount)
- [ ] Monitor logs for first few transactions

---

## Notes

- Pesapal sandbox uses test cards provided after registration
- Token is cached for 57 minutes to reduce API calls
- Status polling happens every 3 seconds
- IPN is automatically retried by Pesapal if it fails
- All payments are in KES by default (can be customized)
