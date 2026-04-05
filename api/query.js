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

// ── Human-readable M-Pesa error messages ──
const MPESA_ERRORS = {
  '1':    'Insufficient M-Pesa balance. Please top up your M-Pesa and try again.',
  '1032': 'Payment was cancelled by you.',
  '1037': 'Unable to reach your phone. Please check your network and try again.',
  '2001': 'Wrong M-Pesa PIN entered. Please try again.',
  '1001': 'Unable to lock subscriber. Please try again later.',
  '1019': 'Transaction expired. You took too long to enter your PIN.',
  '1025': 'An error occurred while sending the STK push.',
  '9999': 'An error occurred while processing your payment.',
  '17':   'Duplicate payment request detected. Check your M-Pesa messages.',
};

function getFriendlyError(resultCode, resultDesc) {
  const code = String(resultCode);
  return MPESA_ERRORS[code] || resultDesc || 'Payment failed. Please try again.';
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
        },
        // Don't throw on non-2xx — let us handle ALL responses manually
        validateStatus: () => true
      }
    );

    const data = response.data;
    console.log('M-Pesa Query Response:', JSON.stringify(data));

    // ── Safaricom returns errorCode when the transaction is still processing ──
    // e.g. { errorCode: "500.001.1001", errorMessage: "The transaction is being processed" }
    if (data.errorCode) {
      const errCode = String(data.errorCode);
      if (errCode.includes('1001') || errCode.includes('1002')) {
        // Still processing — tell frontend to keep polling
        return res.json({ success: false, status: 'pending', error: 'Payment is still being processed...' });
      }
      // Any other Safaricom-level error
      return res.json({ success: false, status: 'failed', error: data.errorMessage || 'M-Pesa query failed.' });
    }

    // ── ResponseCode 0 means the query completed (we got a definitive answer) ──
    if (String(data.ResponseCode) === '0') {
      const resultCode = String(data.ResultCode);
      
      if (resultCode === '0') {
        // ✅ Payment was successful
        const receipt = data.CallbackMetadata?.Item?.find(p => p.Name === 'MpesaReceiptNumber')?.Value
                     || data.ResultParameter?.find(p => p.Key === 'MpesaReceiptNumber')?.Value
                     || 'CONFIRMED';
        return res.json({
          success: true,
          status: 'completed',
          resultCode: data.ResultCode,
          mpesaCode: receipt
        });
      } else {
        // ❌ Payment failed — return a human-readable message
        const friendlyError = getFriendlyError(data.ResultCode, data.ResultDesc);
        return res.json({ 
          success: false, 
          status: 'failed', 
          resultCode: data.ResultCode,
          error: friendlyError
        });
      }
    }

    // ── Fallback for unexpected response shapes ──
    if (String(data.ResponseCode) === '1') {
      return res.json({ success: false, status: 'pending', error: 'Payment is still being processed...' });
    }

    return res.json({ success: false, status: 'failed', error: data.ResponseDescription || data.errorMessage || 'Unknown error from M-Pesa.' });

  } catch (error) {
    // ── Axios network/timeout errors ──
    const errData = error.response?.data;
    console.error('Query Error:', errData || error.message);

    // If Safaricom returned an error body, try to parse it
    if (errData) {
      const errCode = String(errData.errorCode || '');
      if (errCode.includes('1001') || errCode.includes('1002')) {
        return res.json({ success: false, status: 'pending', error: 'Payment is still being processed...' });
      }
      return res.json({ success: false, status: 'failed', error: errData.errorMessage || 'M-Pesa query error.' });
    }

    // True network failure — tell frontend to keep trying
    return res.json({ success: false, status: 'pending', error: 'Checking payment status...' });
  }
};
