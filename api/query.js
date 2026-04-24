const axios = require('axios');
require('dotenv').config();

const GRAVITYPAY_PUBLIC_KEY = process.env.GRAVITYPAY_PUBLIC_KEY;
const GRAVITYPAY_SECRET_KEY = process.env.GRAVITYPAY_SECRET_KEY;

const { setCorsHeaders } = require('./_cors');

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { checkoutRequestId } = req.body;
    if (!checkoutRequestId) return res.status(400).json({ success: false, error: 'Missing checkoutRequestId' });

    const response = await axios.get(
      `https://gravitypayserver.vercel.app/api/v1/stk/status/${checkoutRequestId}`,
      {
        headers: {
          'x-api-key': GRAVITYPAY_PUBLIC_KEY,
          'Authorization': `Bearer ${GRAVITYPAY_SECRET_KEY}`
        },
        // Don't throw on non-2xx
        validateStatus: () => true
      }
    );

    const data = response.data;
    console.log('GravityPay Query Response:', JSON.stringify(data));

    // Assume GravityPay returns something like { status: 'SUCCESS', data: { mpesaReceipt: '...' } }
    // Or { status: 'PENDING' } or { status: 'FAILED' }
    const status = data.status || data.data?.status || '';

    if (status === 'SUCCESS' || status === 'COMPLETED' || data.type === 'PAYMENT_SUCCESS') {
      const receipt = data.mpesaReceipt || data.data?.mpesaReceipt || 'CONFIRMED';
      return res.json({
        success: true,
        status: 'completed',
        mpesaCode: receipt
      });
    } else if (status === 'PENDING' || status === 'PROCESSING') {
      return res.json({ success: false, status: 'pending', error: 'Payment is still being processed...' });
    } else if (status === 'FAILED' || status === 'CANCELLED' || data.type === 'PAYMENT_FAILED') {
      return res.json({ 
        success: false, 
        status: 'failed', 
        error: data.message || data.error || 'Payment failed or was cancelled.'
      });
    }

    // Fallback if structure is slightly different (e.g., successful if it has mpesaReceipt)
    if (data.data && data.data.mpesaReceipt) {
      return res.json({
        success: true,
        status: 'completed',
        mpesaCode: data.data.mpesaReceipt
      });
    }

    // Default fallback to keep polling
    return res.json({ success: false, status: 'pending', error: 'Checking payment status...' });

  } catch (error) {
    console.error('Query Error:', error.response?.data || error.message);
    return res.json({ success: false, status: 'pending', error: 'Checking payment status...' });
  }
};
