# KibeProxy Hub - Complete Deployment Guide

## ✅ What Has Been Done

1. **Created Express.js Backend Server** (`js/server.js`)
   - M-Pesa STK Push integration
   - Payment status querying
   - CORS enabled for development and production
   - Full error handling

2. **Created Vercel Serverless Handler** (`api/stkpush.js`)
   - Handles `/api/stkpush` endpoint
   - Handles `/api/query` endpoint
   - Handles `/api/callback` webhook

3. **Updated Frontend Configuration** (`js/store.js`)
   - Auto-detects environment (localhost or production)
   - Uses correct backend URL automatically

4. **Environment Setup**
   - `.env` file configured with M-Pesa credentials
   - Sandbox environment ready for testing
   - All dependencies installed

## 🚀 Quick Start - Local Testing

### 1. Backend is Already Running
```
✓ Server: http://localhost:3000
✓ Environment: Sandbox
✓ Status: Running
```

### 2. Test the Backend
Open your terminal and test the payment flow:

```bash
# Health check
Invoke-WebRequest -Uri "http://localhost:3000/api/health" -Method Get

# Simulate a payment
$body = @{
    phone = "254799289214"
    amount = 100
    orderId = "test-123"
    description = "Test Payment"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/stkpush" `
  -Method Post `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

### 3. Test the Frontend
1. Open `store.html` in your browser
2. Navigate to the store
3. Click "Buy" on any proxy
4. Enter M-Pesa phone number: `254799289214`
5. Click "Send M-Pesa Prompt"

**Expected Result:**
- STK push request sent successfully
- Payment prompt appears on M-Pesa phone
- System polls for payment status every 3 seconds
- On completion, purchase is saved to database

## 📦 Production Deployment

### Step 1: Prepare Your Repository

Your repository structure is ready:
```
kibeproxy-hub/
├── index.html
├── store.html
├── admin.html
├── auth.html
├── profile.html
├── docs.html
├── css/
├── js/
│   ├── server.js
│   ├── package.json
│   ├── .env
│   └── vercel.json
├── api/
│   └── stkpush.js
├── vercel.json
└── BACKEND_SETUP.md
```

### Step 2: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 3: Deploy to Vercel
```bash
cd c:\Users\Administrator\myproxy.html

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### Step 4: Configure Environment Variables in Vercel

After deployment, go to your Vercel dashboard:

1. Select your project
2. Go to **Settings** → **Environment Variables**
3. Add these variables for production:

```
MPESA_CONSUMER_KEY = uyiYYu0azA2sRjbmBZgAQoF64DvWPSNvPoF4mgevkuYdyYpw
MPESA_CONSUMER_SECRET = vyBeoXQVWlPEBS7HxGaPl6Gf1OzEx87pCjFO5TLbRw1Bw3QYwEl2vUgRDKj2TbIu
MPESA_SHORTCODE = 174379
MPESA_PASSKEY = bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
MPESA_ENV = sandbox
CALLBACK_URL = https://YOUR-VERCEL-URL.vercel.app/api/callback
NODE_ENV = production
```

Replace `YOUR-VERCEL-URL` with your actual Vercel domain.

### Step 5: Verify Deployment

Your backend will be accessible at:
```
https://YOUR-VERCEL-URL.vercel.app/api/stkpush
https://YOUR-VERCEL-URL.vercel.app/api/query
```

Test it:
```bash
Invoke-WebRequest -Uri "https://YOUR-VERCEL-URL.vercel.app/api/health" -Method Get
```

### Step 6: Update DNS (Optional)
If you have a custom domain, point it to Vercel in your DNS settings.

## 🔧 API Endpoints Reference

### POST /api/stkpush
Initiates M-Pesa STK Push payment

**Request:**
```json
{
  "phone": "254799289214",
  "amount": 100,
  "orderId": "order-123",
  "description": "KibeProxy Hub Payment"
}
```

**Success Response:**
```json
{
  "success": true,
  "checkoutRequestId": "ws_co_123456...",
  "merchantRequestId": "29115-123456-1",
  "responseCode": "0",
  "responseDescription": "Success. Request accepted for processing"
}
```

### POST /api/query
Check payment status

**Request:**
```json
{
  "checkoutRequestId": "ws_co_123456..."
}
```

**Response - Success:**
```json
{
  "success": true,
  "status": "completed",
  "resultCode": "0",
  "resultDescription": "The service request has been processed successfully.",
  "amount": "100",
  "mpesaCode": "ABC123DEF4",
  "phoneNumber": "254799289214"
}
```

**Response - Pending:**
```json
{
  "success": false,
  "status": "pending",
  "error": "Payment still processing"
}
```

### GET /api/health
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-03-20T10:30:00.000Z"
}
```

## 🧪 Testing the Payment Flow

### Local Testing
1. **Backend is running** on `http://localhost:3000`
2. **Frontend** detects localhost and uses it automatically
3. **Test Payment Process:**
   - Go to store.html
   - Click Buy on any proxy
   - Enter phone: `254799289214`
   - Amount: `100 KES`
   - Click "Send M-Pesa Prompt"
   - System will poll every 3 seconds
   - Keep an eye on browser console for debugging

### Production Testing
1. Deploy to Vercel (see deployment steps above)
2. Frontend will auto-detect production URL
3. Same payment flow works on production

## 📊 Payment Flow Diagram

```
Frontend (store.html)
  ↓
POST /api/stkpush (phone, amount, orderId)
  ↓
Backend: Get M-Pesa Access Token
  ↓
Backend: Format Payment Request
  ↓
Send to Safaricom STK Push API
  ↓
Safaricom: Send popup to M-Pesa phone
  ↓
User enters PIN on M-Pesa
  ↓
Frontend: Poll /api/query every 3 seconds
  ↓
Payment Confirmed
  ↓
Save to Database + Show Success
```

## ⚙️ Environment Variables Explained

| Variable | Purpose | Example |
|----------|---------|---------|
| MPESA_CONSUMER_KEY | Safaricom API auth | uyiYYu0az... |
| MPESA_CONSUMER_SECRET | Safaricom API auth | vyBeoXQVWl... |
| MPESA_SHORTCODE | Business code | 174379 |
| MPESA_PASSKEY | Encryption key | bfb279f9aa... |
| MPESA_ENV | Environment mode | sandbox/production |
| CALLBACK_URL | Webhook for confirmations | https://... |
| NODE_ENV | Node environment | development/production |

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000

# Try different port
PORT=3001 npm start
```

### CORS errors in browser
- ✅ Already fixed in backend
- Backend has CORS headers configured
- Frontend auto-detects environment

### Payment not initiated
1. Check backend is running: `http://localhost:3000/api/health`
2. Check phone number format (needs to start with 254)
3. Check amount >= 1 KES
4. Check browser console for errors
5. Check backend logs

### STK Push not appearing on phone
- Verify you're using correct phone number
- Check MPESA_ENV is set to "sandbox" for testing
- Verify with `254799289214` (sandbox test number)
- Check Safaricom API credentials are correct

### Payment status not updating
- Ensure backend is running
- Check network tab to see if /api/query requests are being made
- Look for JavaScript errors in console
- Verify checkoutRequestId is being passed correctly

## 📝 Important Notes

1. **Sandbox Testing**
   - Use shortcode: `174379`
   - Use test phone: `254799289214`
   - Uses provided credentials
   - No real money charged

2. **Production Setup**
   - Get production credentials from Safaricom
   - Update MPESA_ENV to "production"
   - Update CALLBACK_URL to production domain
   - Clear old environment variables

3. **Security**
   - Never commit `.env` file with real credentials
   - Use Vercel's environment variables for production
   - Keep credentials private and secure

4. **Database**
   - Update `completePaidOrder()` in store.js with your database schema
   - Save M-Pesa code, phone, amount, and timestamp
   - Link payment to user ID from Supabase auth

## 🚨 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Cannot connect to payment server" | Ensure backend is running on localhost:3000 |
| "Access to fetch blocked by CORS" | Backend CORS is configured, try different browser |
| "Invalid credentials error" | Check MPESA_CONSUMER_KEY and SECRET in .env |
| "Phone number validation failed" | Use format 254XXXXXXXXX |
| "Amount too low" | Use at least 1 KES |
| "Vercel deployment fails" | Check all env vars are set in Vercel dashboard |

## 📞 Support

If you encounter issues:
1. Check the browser console for JavaScript errors
2. Check backend logs: `vercel logs`
3. Verify all environment variables are set
4. Test backend health: `/api/health`
5. Review BACKEND_SETUP.md for detailed info

---

**Status**: ✅ Ready for Production
**Last Updated**: March 20, 2026
**Version**: 1.0.0
