const axios = require('axios');
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const callbackData = req.body;

    console.log('M-Pesa Callback:', JSON.stringify(callbackData, null, 2));

    // Check if payment was successful
    if (callbackData.Body?.stkCallback?.ResultCode === 0) {
      const callback = callbackData.Body.stkCallback;
      const checkoutRequestId = callback.CheckoutRequestID;
      const resultDesc = callback.ResultDesc;

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
      const amount = transaction.amount;

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

      if (walletError && walletError.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Wallet query error:', walletError);
        return res.status(500).json({ error: 'Database error' });
      }

      const currentBalance = wallet ? wallet.balance : 0;
      const newBalance = currentBalance + amount;

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

      console.log(`Wallet updated for user ${userId}: ${currentBalance} -> ${newBalance}`);
    } else {
      // Payment failed or cancelled
      const checkoutRequestId = callbackData.Body?.stkCallback?.CheckoutRequestID;
      if (checkoutRequestId) {
        // Update transaction status to failed
        const { error: updateTxError } = await db
          .from('transactions')
          .update({ status: 'failed' })
          .eq('checkout_request_id', checkoutRequestId);

        if (updateTxError) {
          console.error('Failed transaction update error:', updateTxError);
        }
      }
    }

    // Always respond with success to M-Pesa
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Callback processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}