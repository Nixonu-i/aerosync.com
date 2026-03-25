# 📧 Brevo Email Setup Guide (Optional)

**Note:** Your system currently uses Gmail OAuth for emails. Brevo is an optional FREE alternative that gives you professional branding (`noreply@aerosync.live`).

## Quick Comparison

| Feature | Gmail (Current) | Brevo (Optional) |
|---------|----------------|------------------|
| **Cost** | Free | Free (300/day) |
| **Sender** | Your personal Gmail | Professional company email |
| **Setup** | Already done | 5 minutes |
| **Limits** | Gmail daily limits | 300 emails/day |

---

## Step 1: Create Free Brevo Account (5 minutes)

1. **Go to** https://www.brevo.com/
2. Click **"Sign Up Free"**
3. Enter your details
4. Verify your email address

## Step 2: Get Your API Key (2 minutes)

1. **Login to Brevo Dashboard**
2. Click profile name → **"API & Apps"**
3. Click **"Create a New API Key"**
4. Name: `AeroSync Production`
5. Copy the API key (starts with `xkeysib-`)

## Step 3: Enable Brevo (1 minute)

Edit `/home/nixii/Documents/aerosync/aerosync-backend/.env`:

```bash
# Uncomment this line and add your API key:
BREVO_API_KEY=xkeysib-your-actual-api-key-here
```

## Step 4: Install & Activate (2 minutes)

```bash
cd /home/nixii/Documents/aerosync/aerosync-backend
pip install sendgrid-django==4.2.0 python-decouple==3.8
sudo systemctl restart aerosync
```

Check logs - you should see:
```
✅ Using Brevo email backend
```

## ✅ That's It!

Your emails now come from: `AeroSync <noreply@aerosync.live>`

---

## 🔄 Switch Back to Gmail Anytime

Just comment out the Brevo line in `.env`:

```bash
# BREVO_API_KEY=xkeysib-...
```

Restart backend and it will automatically use Gmail again.

---

**Want to test?** Register a new user or request a password reset!
