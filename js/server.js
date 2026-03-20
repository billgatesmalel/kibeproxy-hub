const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// ──────────────────────────────────────────────────
// MIDDLEWARE
// ──────────────────────────────────────────────────

// Enable CORS for all origins with credentials
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:5500', 'http://localhost:5500', 'https://kibeproxy-mpesa.vercel.app'],
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// ──────────────────────────────────────────────────
// ENVIRONMENT VARIABLES
// ──────────────────────────────────────────────────

const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE || '174379';
const MPESA_PASSKEY = process.env.MPESA_PASSKEY;
const MPESA_ENV = process.env.MPESA_ENV || 'sandbox';
const CALLBACK_URL = process.env.CALLBACK_URL || 'https://kibeproxy-mpesa.vercel.app/api/callback';

// Determine Safaricom API URLs based on environment
const SAFARICOM_BASE_URL = MPESA_ENV === 'sandbox' 
  ? 'https://sandbox.safaricom.co.ke'
  : 'https://api.safaricom.co.ke';

const OAUTH_URL = `${SAFARICOM_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`;
const STK_PUSH_URL = `${SAFARICOM_BASE_URL}/mpesa/stkpush/v1/processrequest`;
const QUERY_URL = `${SAFARICOM_BASE_URL}/mpesa/stkpushquery/v1/query`;

// ──────────────────────────────────────────────────
// CACHE FOR ACCESS TOKEN (in-memory)
// ──────────────────────────────────────────────────

let accessToken = null;
let tokenExpiry = null;

async function getAccessToken() {
  const now = Date.now();
  
  // Return cached token if still valid
  if (accessToken && tokenExpiry && now < tokenExpiry) {
    return accessToken;
  }

  try {
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
    
    const response = await axios.get(OAUTH_URL, {
      headers: {
        Authorization: `Basic ${auth}`
      }
    });

    accessToken = response.data.access_token;
    // Token expires in 3600 seconds, cache for 3500 seconds (5 min buffer)
    tokenExpiry = now + (3500 * 1000);
    
    return accessToken;
  } catch (error) {
    console.error('Error getting access token:', error.response?.data || error.message);
    throw new Error('Failed to get M-Pesa access token');
  }
}

// ──────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ──────────────────────────────────────────────────

function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove leading zero if exists
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Add +254 prefix
  return `254${cleaned}`;
}

function generateTimestamp() {
  const now = new Date();
  return now.getFullYear().toString() +
         String(now.getMonth() + 1).padStart(2, '0') +
         String(now.getDate()).padStart(2, '0') +
         String(now.getHours()).padStart(2, '0') +
         String(now.getMinutes()).padStart(2, '0') +
         String(now.getSeconds()).padStart(2, '0');
}

function generatePassword(shortcode, passkey, timestamp) {
  const crypto = require('crypto');
  const text = shortcode + passkey + timestamp;
  return Buffer.from(text).toString('base64');
}

// ──────────────────────────────────────────────────
// ROUTES
// ──────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initiate STK Push
app.post('/api/stkpush', async (req, res) => {
  try {
    const { phone, amount, orderId, description } = req.body;

    // Validation
    if (!phone || !amount || !orderId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: phone, amount, orderId' 
      });
    }

    if (amount < 1) {
      return res.status(400).json({ 
        success: false, 
        error: 'Amount must be at least 1 KES' 
      });
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(phone);

    // Get access token
    const token = await getAccessToken();

    // Generate timestamp and password
    const timestamp = generateTimestamp();
    const password = generatePassword(MPESA_SHORTCODE, MPESA_PASSKEY, timestamp);

    // Make STK Push request
    const response = await axios.post(STK_PUSH_URL, {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: CALLBACK_URL,
      AccountReference: orderId.toString(),
      TransactionDesc: description || 'Payment'
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    // Handle response
    if (response.data.ResponseCode === '0') {
      return res.json({
        success: true,
        checkoutRequestId: response.data.CheckoutRequestID,
        merchantRequestId: response.data.MerchantRequestID,
        responseCode: response.data.ResponseCode,
        responseDescription: response.data.ResponseDescription
      });
    } else {
      return res.json({
        success: false,
        error: response.data.ResponseDescription || 'STK Push failed',
        responseCode: response.data.ResponseCode
      });
    }

  } catch (error) {
    console.error('STK Push Error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: error.response?.data?.errorMessage || 'Failed to initiate payment. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Query payment status
app.post('/api/query', async (req, res) => {
  try {
    const { checkoutRequestId, merchantRequestId } = req.body;

    if (!checkoutRequestId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing checkoutRequestId' 
      });
    }

    // Get access token
    const token = await getAccessToken();

    // Generate timestamp and password
    const timestamp = generateTimestamp();
    const password = generatePassword(MPESA_SHORTCODE, MPESA_PASSKEY, timestamp);

    // Query payment status
    const response = await axios.post(QUERY_URL, {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    // Handle response
    const data = response.data;
    
    if (data.ResponseCode === '0') {
      return res.json({
        success: true,
        status: 'completed',
        resultCode: data.ResultCode,
        resultDescription: data.ResultDesc,
        amount: data.ResultParameter?.find(p => p.Key === 'Amount')?.Value,
        mpesaCode: data.ResultParameter?.find(p => p.Key === 'MpesaReceiptNumber')?.Value,
        phoneNumber: data.ResultParameter?.find(p => p.Key === 'PhoneNumber')?.Value
      });
    } else if (data.ResponseCode === '1' || data.ResponseCode === '500.001.1001') {
      // Still processing
      return res.json({
        success: false,
        status: 'pending',
        error: 'Payment still processing'
      });
    } else {
      return res.json({
        success: false,
        status: 'failed',
        error: data.ResponseDescription || 'Payment query failed'
      });
    }

  } catch (error) {
    console.error('Query Error:', error.response?.data || error.message);
    
    // If it's a timeout/processing error, return pending status
    if (error.code === 'ECONNABORTED' || error.response?.status === 500) {
      return res.json({
        success: false,
        status: 'pending',
        error: 'Payment still being processed'
      });
    }

    return res.status(500).json({
      success: false,
      status: 'error',
      error: 'Failed to query payment status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Callback endpoint for Safaricom
app.post('/api/callback', (req, res) => {
  try {
    console.log('Callback received:', JSON.stringify(req.body, null, 2));
    
    // Safaricom requires a 200 response quickly
    res.json({ status: 'ok' });

    // Process callback asynchronously
    const body = req.body;
    
    if (body.Body?.stkCallback) {
      const callback = body.Body.stkCallback;
      const checkoutRequestId = callback.CheckoutRequestID;
      const resultCode = callback.ResultCode;
      const resultDesc = callback.ResultDesc;
      
      console.log(`Payment Update - CheckoutID: ${checkoutRequestId}, Result: ${resultCode}, Desc: ${resultDesc}`);
      
      // Here you would typically update your database with the payment status
      // and notify the client via WebSocket or polling
    }

  } catch (error) {
    console.error('Callback Error:', error.message);
    res.status(500).json({ status: 'error' });
  }
});

// ──────────────────────────────────────────────────
// ERROR HANDLING
// ──────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ──────────────────────────────────────────────────
// START SERVER
// ──────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✓ M-Pesa Server running on port ${PORT}`);
  console.log(`✓ Environment: ${MPESA_ENV}`);
  console.log(`✓ Shortcode: ${MPESA_SHORTCODE}`);
  console.log(`✓ Base URL: ${SAFARICOM_BASE_URL}`);
});

module.exports = app;
