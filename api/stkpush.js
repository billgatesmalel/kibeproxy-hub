const axios = require('axios');
require('dotenv').config();

const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE || '174379';
const MPESA_PASSKEY = process.env.MPESA_PASSKEY;
const MPESA_ENV = process.env.MPESA_ENV || 'sandbox';
const CALLBACK_URL = process.env.CALLBACK_URL || 'https://kibeproxy-hub-app.vercel.app/api/callback';

const SAFARICOM_BASE_URL = MPESA_ENV === 'sandbox' 
  ? 'https://sandbox.safaricom.co.ke'
  : 'https://api.safaricom.co.ke';

const OAUTH_URL = `${SAFARICOM_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`;
const STK_PUSH_URL = `${SAFARICOM_BASE_URL}/mpesa/stkpush/v1/processrequest`;

// Store tokens in Vercel's memory (note: will reset on cold starts)
let tokenCache = { token: null, expiry: null };

async function getAccessToken() {
  const now = Date.now();
  
  if (tokenCache.token && tokenCache.expiry && now < tokenCache.expiry) {
    return tokenCache.token;
  }

  try {
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
    
    const response = await axios.get(OAUTH_URL, {
      headers: { Authorization: `Basic ${auth}` }
    });

    tokenCache.token = response.data.access_token;
    tokenCache.expiry = now + (3500 * 1000);
    
    return tokenCache.token;
  } catch (error) {
    console.error('Token Error:', error.response?.data || error.message);
    throw new Error('Failed to get access token');
  }
}

function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
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
  return Buffer.from(shortcode + passkey + timestamp).toString('base64');
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return handleStkPush(req, res);
}

async function handleStkPush(req, res) {
  try {
    const { phone, amount, orderId, description } = req.body;

    if (!phone || !amount || !orderId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    if (amount < 1) {
      return res.status(400).json({ 
        success: false, 
        error: 'Amount must be at least 1 KES' 
      });
    }

    const formattedPhone = formatPhoneNumber(phone);
    const token = await getAccessToken();
    const timestamp = generateTimestamp();
    const password = generatePassword(MPESA_SHORTCODE, MPESA_PASSKEY, timestamp);

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

    if (response.data.ResponseCode === '0') {
      return res.json({
        success: true,
        checkoutRequestId: response.data.CheckoutRequestID,
        merchantRequestId: response.data.MerchantRequestID
      });
    } else {
      return res.json({
        success: false,
        error: response.data.ResponseDescription
      });
    }

  } catch (error) {
    console.error('STK Error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: 'Payment initiation failed'
    });
  }
}

}
