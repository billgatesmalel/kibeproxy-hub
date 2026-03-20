# KibeProxy Hub - Backend Setup Guide

## Overview
This document explains how to set up and deploy the M-Pesa payment backend for KibeProxy Hub.

## Project Structure
```
myproxy.html/
├── js/
│   ├── server.js              # Main Express server (local development)
│   ├── package.json           # Dependencies
│   ├── .env                   # Environment variables
│   └── vercel.json            # Vercel config for /js folder
├── api/
│   └── stkpush.js            # Vercel serverless handler
└── vercel.json                # Root Vercel config
```

## Prerequisites
- Node.js 18+ installed
- npm or yarn
- Safaricom Daraja API credentials (Consumer Key, Consumer Secret, Passkey)
- Vercel account for deployment

## Local Development Setup

### 1. Install Dependencies
```bash
cd c:\Users\Administrator\myproxy.html\js
npm install
```

### 2. Environment Variables
The `.env` file is already configured with:
```
MPESA_CONSUMER_KEY=uyiYYu0azA2sRjbmBZgAQoF64DvWPSNvPoF4mgevkuYdyYpw
MPESA_CONSUMER_SECRET=vyBeoXQVWlPEBS7HxGaPl6Gf1OzEx87pCjFO5TLbRw1Bw3QYwEl2vUgRDKj2TbIu
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
MPESA_ENV=sandbox
CALLBACK_URL=https://kibeproxy-hub-app.vercel.app/api/callback
```

### 3. Run Local Server
```bash
npm start
# or for development with auto-reload
npm run dev
```

The server will start on `http://localhost:3000`

### 4. Test the Backend
```bash
# Health check
curl http://localhost:3000/api/health

# Initiate payment
curl -X POST http://localhost:3000/api/stkpush \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "254799289214",
    "amount": 100,
    "orderId": "123456",
    "description": "Test Payment"
  }'
```

## API Endpoints

### POST /api/stkpush
Initiates an M-Pesa STK push payment.

**Request:**
```json
{
  "phone": "254799289214",      // M-Pesa phone number
  "amount": 100,                // Amount in KES
  "orderId": "123456",          // Unique order ID
  "description": "Payment"      // Transaction description
}
```

**Response (Success):**
```json
{
  "success": true,
  "checkoutRequestId": "ws_co_123456789",
  "merchantRequestId": "29115-123456-1",
  "responseCode": "0",
  "responseDescription": "Success. Request accepted for processing"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Invalid phone number",
  "responseCode": "1"
}
```

### POST /api/query
Queries the status of a payment.

**Request:**
```json
{
  "checkoutRequestId": "ws_co_123456789"
}
```

**Response (Completed):**
```json
{
  "success": true,
  "status": "completed",
  "resultCode": "0",
  "mpesaCode": "ABC123DEF4"
}
```

**Response (Pending):**
```json
{
  "success": false,
  "status": "pending",
  "error": "Payment still processing"
}
```

**Response (Failed):**
```json
{
  "success": false,
  "status": "failed",
  "error": "Transaction failed"
}
```

### POST /api/callback
Webhook endpoint for Safaricom to send payment notifications.
(Automatically called by Safaricom after payment completion)

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-03-20T10:30:00.000Z"
}
```

## Deployment to Vercel

### 1. Connect Repository
```bash
cd c:\Users\Administrator\myproxy.html
vercel
```

Follow the prompts to:
- Connect to Vercel
- Select project type (select "Other")
- Set root directory to `./`

### 2. Set Environment Variables in Vercel
In Vercel dashboard:
1. Go to Settings → Environment Variables
2. Add the following:
   - `MPESA_CONSUMER_KEY`
   - `MPESA_CONSUMER_SECRET`
   - `MPESA_SHORTCODE`
   - `MPESA_PASSKEY`
   - `MPESA_ENV` (set to 'sandbox' for testing)
   - `CALLBACK_URL` (your Vercel domain + /api/callback)
   - `NODE_ENV` (set to 'production')

### 3. Deploy
```bash
vercel --prod
```

Or use git - push to your connected repository and Vercel will auto-deploy.

### 4. Update Frontend
After deployment, your backend URL will be something like:
`https://kibeproxy-hub-app.vercel.app`

The frontend (store.js) automatically detects the environment and uses:
- `http://localhost:3000` for local development
- The Vercel URL for production

## Features

### CORS Support
✅ Enabled for all origins in development
✅ Properly configured in Vercel headers

### Phone Number Formatting
- Accepts various formats: `0799289214`, `799289214`, `254799289214`, `+254799289214`
- Automatically converts to `254799289214` format required by Safaricom

### Token Management
- Access token is cached to avoid repeated authentication
- Tokens automatically expire and refresh when needed

### Error Handling
- Comprehensive error messages
- Proper HTTP status codes
- Validation of required fields

### Security
- Environment variables for sensitive credentials
- No hardcoded secrets
- HTTPS only in production
- Input validation on all endpoints

## Troubleshooting

### "CORS policy blocked"
- Ensure backend is running on correct port
- Check that frontend is using correct API URL
- Verify vercel.json has CORS headers

### "Access Token Error"
- Verify credentials in .env file
- Check Consumer Key and Secret are correct
- Ensure you're using Sandbox environment for testing

### "Invalid Phone Number"
- Ensure phone starts with 0 or 254
- Remove any spaces or special characters
- Test with: `254799289214` or `0799289214`

### "STK Push Not Showing"
- Verify amount is >= 1 KES
- Check phone number is valid M-Pesa number
- Confirm you're in sandbox environment
- Check callback URL is reachable

## Testing Credentials

For Sandbox testing:
- **Consumer Key:** uyiYYu0azA2sRjbmBZgAQoF64DvWPSNvPoF4mgevkuYdyYpw
- **Consumer Secret:** vyBeoXQVWlPEBS7HxGaPl6Gf1OzEx87pCjFO5TLbRw1Bw3QYwEl2vUgRDKj2TbIu
- **Business Shortcode:** 174379
- **Test Phone:** 254799289214

## Production Deployment

When moving to production:

1. Update `.env` MPESA_ENV to `production`
2. Get production credentials from Safaricom
3. Update CALLBACK_URL to your production domain
4. Set environment variables in Vercel production
5. Deploy with `vercel --prod`

## Support

For issues:
- Check server logs: `vercel logs`
- Test endpoints locally first
- Verify .env file has all required variables
- Check Safaricom API documentation

---

**Status:** ✅ Ready for deployment
**Last Updated:** March 20, 2026
**Version:** 1.0.0
