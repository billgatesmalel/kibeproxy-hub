// ── KibeProxy Hub M-Pesa STK Push API ─────────────────────────
require('dotenv').config();
const express = require('express');
const axios   = require('axios');
const cors    = require('cors');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

// ── CONFIG ────────────────────────────────────────────────────
const {
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE,
  MPESA_PASSKEY,
  MPESA_PHONE,
  CALLBACK_URL,
  MPESA_ENV
} = process.env;

const IS_SANDBOX = MPESA_ENV === 'sandbox';

const BASE_URL = IS_SANDBOX
  ? 'https://sandbox.safaricom.co.ke'
  : 'https://api.safaricom.co.ke';

// In-memory store for payment status (use a DB in production)
const payments = {};

// ── HELPERS ───────────────────────────────────────────────────

// Get OAuth Token
async function getToken() {
  const credentials = Buffer.from(
    `${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  const res = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${credentials}` } }
  );
  return res.data.access_token;
}

// Generate Timestamp
function getTimestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return (
    now.getFullYear() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

// Generate Password
function getPassword(timestamp) {
  const str = `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`;
  return Buffer.from(str).toString('base64');
}

// Format Phone Number (ensure 254XXXXXXXXX format)
function formatPhone(phone) {
  phone = String(phone).replace(/\s/g, '');
  if (phone.startsWith('0'))   return '254' + phone.slice(1);
  if (phone.startsWith('+'))   return phone.slice(1);
  if (!phone.startsWith('254')) return '254' + phone;
  return phone;
}

// ── ROUTES ────────────────────────────────────────────────────

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'KibeProxy M-Pesa API is running ✅', env: MPESA_ENV });
});

// ── STK PUSH ──────────────────────────────────────────────────
app.post('/api/stkpush', async (req, res) => {
  try {
    const { phone, amount, orderId, description } = req.body;

    if (!phone || !amount || !orderId) {
      return res.status(400).json({ error: 'phone, amount and orderId are required' });
    }

    const formattedPhone = formatPhone(phone);
    const timestamp      = getTimestamp();
    const password       = getPassword(timestamp);
    const token          = await getToken();

    const payload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   'CustomerPayBillOnline',
      Amount:            Math.ceil(amount),
      PartyA:            formattedPhone,
      PartyB:            MPESA_SHORTCODE,
      PhoneNumber:       formattedPhone,
      CallBackURL:       CALLBACK_URL,
      AccountReference:  `KibeProxy-${orderId}`,
      TransactionDesc:   description || 'KibeProxy Hub Payment',
    };

    const response = await axios.post(
      `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const { CheckoutRequestID, ResponseCode, CustomerMessage } = response.data;

    // Store payment as pending
    payments[CheckoutRequestID] = {
      orderId,
      phone: formattedPhone,
      amount,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    res.json({
      success:           true,
      checkoutRequestId: CheckoutRequestID,
      responseCode:      ResponseCode,
      message:           CustomerMessage,
    });

  } catch (err) {
    console.error('STK Push error:', err.response?.data || err.message);
    res.status(500).json({
      error:   'STK Push failed',
      details: err.response?.data || err.message,
    });
  }
});

// ── CALLBACK (Safaricom calls this after user pays) ────────────
app.post('/api/callback', (req, res) => {
  try {
    const body     = req.body;
    const stk      = body?.Body?.stkCallback;
    const checkId  = stk?.CheckoutRequestID;
    const code     = stk?.ResultCode;

    console.log('M-Pesa Callback received:', JSON.stringify(body, null, 2));

    if (checkId && payments[checkId]) {
      if (code === 0) {
        // Payment successful
        const meta = stk.CallbackMetadata?.Item || [];
        const get  = name => meta.find(i => i.Name === name)?.Value;

        payments[checkId] = {
          ...payments[checkId],
          status:      'success',
          mpesaCode:   get('MpesaReceiptNumber'),
          amount:      get('Amount'),
          phone:       get('PhoneNumber'),
          completedAt: new Date().toISOString(),
        };
      } else {
        // Payment failed/cancelled
        payments[checkId] = {
          ...payments[checkId],
          status:    'failed',
          reason:    stk?.ResultDesc,
          failedAt:  new Date().toISOString(),
        };
      }
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  } catch (err) {
    console.error('Callback error:', err.message);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

// ── CHECK PAYMENT STATUS ──────────────────────────────────────
app.get('/api/status/:checkoutRequestId', (req, res) => {
  const { checkoutRequestId } = req.params;
  const payment = payments[checkoutRequestId];

  if (!payment) {
    return res.json({ status: 'not_found' });
  }

  res.json(payment);
});

// ── QUERY STK STATUS (from Safaricom directly) ────────────────
app.post('/api/query', async (req, res) => {
  try {
    const { checkoutRequestId } = req.body;
    const timestamp = getTimestamp();
    const password  = getPassword(timestamp);
    const token     = await getToken();

    const response = await axios.post(
      `${BASE_URL}/mpesa/stkpushquery/v1/query`,
      {
        BusinessShortCode: MPESA_SHORTCODE,
        Password:          password,
        Timestamp:         timestamp,
        CheckoutRequestID: checkoutRequestId,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const { ResultCode, ResultDesc } = response.data;

    // Update local status
    if (payments[checkoutRequestId]) {
      payments[checkoutRequestId].status =
        ResultCode === '0' ? 'success' : 'failed';
    }

    res.json({
      resultCode: ResultCode,
      resultDesc: ResultDesc,
      status: ResultCode === '0' ? 'success' : 'failed',
    });

  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// ── START SERVER ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ KibeProxy M-Pesa API running on port ${PORT}`);
  console.log(`📱 Environment: ${MPESA_ENV}`);
});

module.exports = app;