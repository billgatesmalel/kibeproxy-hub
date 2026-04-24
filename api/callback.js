const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const db = createClient(supabaseUrl, supabaseKey);

const { setCorsHeaders } = require('./_cors');

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      message: 'GravityPay Callback endpoint is active. Use POST for webhook notifications.',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST for webhooks.' });
  }

  try {
    const callbackData = req.body;
    console.log('GravityPay Webhook Callback:', JSON.stringify(callbackData, null, 2));

    // Handle GravityPay Webhook format
    if (callbackData.type === 'PAYMENT_SUCCESS') {
      const checkoutRequestId = callbackData.data?.checkoutRequestId;
      const amount = callbackData.data?.amount;

      if (!checkoutRequestId) {
        return res.status(400).json({ error: 'No checkout request ID in payload' });
      }

      // Find the transaction by checkoutRequestId
      const { data: transactions, error: txError } = await db
        .from('transactions')
        .select('*')
        .eq('checkout_request_id', checkoutRequestId)
        .eq('status', 'pending');

      if (txError) {
        console.error('Transaction query error:', txError);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!transactions || transactions.length === 0) {
        console.error('No pending transaction found for checkoutRequestId:', checkoutRequestId);
        return res.status(404).json({ error: 'Transaction not found' });
      }

      const transaction = transactions[0];
      const userId = transaction.user_id;
      // Use transaction amount just to be safe, or webhook amount
      const txAmount = transaction.amount; 

      // Update transaction status to success
      const { error: updateTxError } = await db
        .from('transactions')
        .update({ status: 'success' })
        .eq('checkout_request_id', checkoutRequestId);

      if (updateTxError) {
        console.error('Transaction update error:', updateTxError);
        return res.status(500).json({ error: 'Failed to update transaction' });
      }

      // Get current wallet balance
      const { data: wallet, error: walletError } = await db
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (walletError && walletError.code !== 'PGRST116') {
        console.error('Wallet query error:', walletError);
        return res.status(500).json({ error: 'Database error' });
      }

      const currentBalance = wallet ? wallet.balance : 0;
      const newBalance = currentBalance + txAmount;

      // Update wallet balance
      const { error: upsertError } = await db
        .from('wallets')
        .upsert([{
          user_id: userId,
          balance: newBalance,
          updated_at: new Date().toISOString(),
        }], { onConflict: 'user_id' });

      if (upsertError) {
        console.error('Wallet update error:', upsertError);
        return res.status(500).json({ error: 'Failed to update wallet' });
      }

      console.log(`Wallet updated via Webhook for user ${userId}: ${currentBalance} -> ${newBalance}`);
    } else if (callbackData.type === 'PAYMENT_FAILED' || callbackData.type === 'PAYMENT_CANCELLED') {
      const checkoutRequestId = callbackData.data?.checkoutRequestId;
      if (checkoutRequestId) {
        await db
          .from('transactions')
          .update({ status: 'failed' })
          .eq('checkout_request_id', checkoutRequestId);
      }
    }

    // Always respond with success to acknowledge webhook
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}