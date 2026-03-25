const axios = require('axios');
require('dotenv').config();

const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE || '174379';
const MPESA_PASSKEY = process.env.MPESA_PASSKEY;
const MPESA_ENV = process.env.MPESA_ENV || 'sandbox';

const SAFARICOM_BASE_URL = MPESA_ENV === 'sandbox' 
  ? 'https://sandbox.safaricom.co.ke'
  : 'https://api.safaricom.co.ke';

const OAUTH_URL = `${SAFARICOM_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`;

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

const { setCorsHeaders } = require('./_cors');

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { checkoutRequestId } = req.body;
    if (!checkoutRequestId) return res.status(400).json({ success: false, error: 'Missing checkoutRequestId' });

    const token = await getAccessToken();
    const timestamp = generateTimestamp();
    const password = generatePassword(MPESA_SHORTCODE, MPESA_PASSKEY, timestamp);

    const response = await axios.post(
      `${SAFARICOM_BASE_URL}/mpesa/stkpushquery/v1/query`,
      {
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = response.data;
    if (data.ResponseCode === '0') {
      return res.json({
        success: true,
        status: 'completed',
        resultCode: data.ResultCode,
        mpesaCode: data.ResultParameter?.find(p => p.Key === 'MpesaReceiptNumber')?.Value
      });
    } else if (data.ResponseCode === '1' || data.ResponseCode === '500.001.1001') {
      return res.json({ success: false, status: 'pending', error: 'Payment processing' });
    } else {
      return res.json({ success: false, status: 'failed', error: data.ResponseDescription });
    }
  } catch (error) {
    console.error('Query Error:', error.response?.data || error.message);
    return res.status(500).json({ success: false, error: 'Query failed' });
  }
};
