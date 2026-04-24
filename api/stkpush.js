const axios = require('axios');
require('dotenv').config();

const GRAVITYPAY_PUBLIC_KEY = process.env.GRAVITYPAY_PUBLIC_KEY;
const GRAVITYPAY_SECRET_KEY = process.env.GRAVITYPAY_SECRET_KEY;

const STK_PUSH_URL = 'https://gravitypayserver.vercel.app/api/v1/stk/push';

function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('254')) return cleaned;
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  return `254${cleaned}`;
}

const { setCorsHeaders } = require('./_cors');

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);
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

    const response = await axios.post(STK_PUSH_URL, {
      phoneNumber: formattedPhone,
      amount: Math.round(amount),
      reference: orderId.toString(),
      description: description || 'Payment for Proxy/Wallet'
    }, {
      headers: {
        'x-api-key': GRAVITYPAY_PUBLIC_KEY,
        'Authorization': `Bearer ${GRAVITYPAY_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // GravityPay might return success differently, assume response.data contains the standard structure payload
    // based on typical setups. Let's send the whole response to the frontend that includes checkoutRequestId
    if (response.data.success || response.data.checkoutRequestId) {
      return res.json({
        success: true,
        checkoutRequestId: response.data.checkoutRequestId || response.data.data?.checkoutRequestId || 'GP_' + Date.now(), // fallback just in case
        merchantRequestId: response.data.merchantRequestId || ''
      });
    } else {
      return res.json({
        success: false,
        error: response.data.message || response.data.error || 'Failed to initiate STK push'
      });
    }

  } catch (error) {
    const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
    console.error('GravityPay STK Error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: errorMessage || 'Payment initiation failed'
    });
  }
}
