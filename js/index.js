let currentUserId = null;
let currentBalance = 0;
let pollingInterval = null;

// Global data for filtering
let allProxies = [];
let allEmails = [];
let allTransactions = [];

function toggleSupport(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const menu = document.getElementById('support-menu');
  const btn = e.currentTarget;
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  
  menu.style.top = (rect.bottom + window.scrollY + 10) + 'px';
  menu.style.left = (rect.left + window.scrollX + rect.width / 2) + 'px';
  
  const isOpen = menu.classList.toggle('open');
  
  const closeMenu = (event) => {
    if (!menu.contains(event.target) && !btn.contains(event.target)) {
      menu.classList.remove('open');
      document.removeEventListener('click', closeMenu);
    }
  };
  
  if (isOpen) {
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
  }
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 3000);
}

function copyToClipboard(text, btn) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    setTimeout(() => {
      btn.innerHTML = originalHTML;
    }, 1500);
    showToast('Copied to clipboard!');
  }).catch(err => {
    console.error('Copy failed:', err);
    showToast('Failed to copy', 'error');
  });
}

// ── RENEWAL REDIRECT (User now buys new proxy instead of renewing) ───────
function openRenewModal() {
  window.location.href = 'store.html';
}

function updateBalanceDisplay() {
  const pills = document.querySelectorAll('.balance-pill span, #stat-balance, #nav-balance, #wallet-amount');
  pills.forEach(p => {
    p.textContent = 'KES ' + currentBalance;
  });
}

// ── TAB SWITCH ────────────────────────────────────────────────
// (tab logic removed from dashboard as request)

// ── PAYMENT STATUS BADGE ──────────────────────────────────────
function paymentBadge(status) {
  if (!status || status === 'success') {
    return '<span style="display:inline-flex;align-items:center;gap:4px;background:var(--green-glow);color:var(--green);border:1px solid var(--green-dim);padding:2px 8px;border-radius:20px;font-size:0.7rem;font-family:DM Mono,monospace;font-weight:600;">✓ Paid</span>';
  } else if (status === 'pending') {
    return '<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(234,179,8,0.1);color:#eab308;border:1px solid rgba(234,179,8,0.3);padding:2px 8px;border-radius:20px;font-size:0.7rem;font-family:DM Mono,monospace;font-weight:600;">⏳ Pending</span>';
  }
  return '<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);padding:2px 8px;border-radius:20px;font-size:0.7rem;font-family:DM Mono,monospace;font-weight:600;">✕ Failed</span>';
}

// ── RENDER PROXIES ────────────────────────────────────────────
function renderProxies(data, panelId, status) {
  const panel = document.getElementById(panelId);
  if (!data || data.length === 0) {
    panel.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 64 64" fill="none">
          <path d="M32 8L56 20V44L32 56L8 44V20L32 8Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M8 20L32 32L56 20" stroke="currentColor" stroke-width="1.5"/>
          <path d="M32 32V56" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        <p class="empty-title">No ${status} proxies</p>
        <p class="empty-sub">${status === 'active' ? 'Visit the store to buy a proxy' : 'Expired proxies will appear here'}</p>
        ${status === 'active' ? '<a href="store.html" class="buy-link-btn">🛒 Go to Store</a>' : ''}
      </div>`;
    return;
  }
  panel.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Country</th><th>Host</th><th>Port</th><th>Username</th><th>Password</th><th>Status</th><th>Payment</th><th>Expires</th></tr>
      </thead>
      <tbody>
        ${data.map(p => `
          <tr>
            <td>${p.country || '—'}</td>
            <td class="mono">
              ${p.host || '—'}
              ${p.host ? `<button class="copy-btn" onclick="copyToClipboard('${p.host}', this)" title="Copy Host">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>` : ''}
            </td>
            <td class="mono">
              ${p.port || '—'}
              ${p.port ? `<button class="copy-btn" onclick="copyToClipboard('${p.port}', this)" title="Copy Port">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>` : ''}
            </td>
            <td class="mono">
              ${p.username || '—'}
              ${p.username ? `<button class="copy-btn" onclick="copyToClipboard('${p.username}', this)" title="Copy Username">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>` : ''}
            </td>
            <td class="mono">
              <span class="pass-hidden" id="pass-${p.id}" data-pass="${(p.password||'').replace(/"/g,'&quot;')}">••••••••</span>
              <button class="show-btn" onclick="togglePass('pass-${p.id}')">Show</button>
              <button class="copy-btn" onclick="copyToClipboard(document.getElementById('pass-${p.id}').getAttribute('data-pass'), this)" title="Copy Password">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </td>
            <td>
              <span class="badge ${p.status} ${p.status === 'active' && (new Date(p.expires_at) - new Date()) < 86400000 ? 'pulse' : ''}">
                ${p.status}
              </span>
              ${(p.status === 'active' || p.status === 'expired') ? `<button class="renew-btn" onclick="openRenewModal()" style="background:var(--blue-glow);color:var(--blue);border-color:rgba(59,130,246,0.3)">Buy More</button>` : ''}
            </td>
            <td>${paymentBadge(p.payment_status)}</td>
            <td class="mono" style="font-size:0.78rem;color:var(--text-muted)">
              ${p.expires_at ? new Date(p.expires_at).toLocaleString() : '—'}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function togglePass(id) {
  const el  = document.getElementById(id);
  if (!el) return;
  const btn  = el.nextElementSibling;
  const pass = el.getAttribute('data-pass');
  if (el.textContent.includes('•')) { el.textContent = pass || '(empty)'; btn.textContent = 'Hide'; }
  else                               { el.textContent = '••••••••'; btn.textContent = 'Show'; }
}

// ── RENDER EMAILS ─────────────────────────────────────────────
function renderEmails(data, panelId = 'panel-emails') {
  const panel = document.getElementById(panelId);
  if (!data || data.length === 0) {
    panel.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 64 64" fill="none">
          <rect x="8" y="16" width="48" height="32" rx="4" stroke="currentColor" stroke-width="2"/>
          <path d="M8 22L32 38L56 22" stroke="currentColor" stroke-width="2"/>
        </svg>
        <p class="empty-title">No emails</p>
        <p class="empty-sub">Visit the store to buy an email</p>
        <a href="store.html" class="buy-link-btn">🛒 Go to Store</a>
      </div>`;
    return;
  }
  panel.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Email</th><th>Password</th><th>Payment</th><th style="display:none;">Purchased</th></tr></thead>
      <tbody>
        ${data.map(e => `
          <tr>
            <td class="mono">
              ${e.email}
              <button class="copy-btn" onclick="copyToClipboard('${e.email}', this)" title="Copy Email">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </td>
            <td class="mono">
              <span class="pass-hidden" id="epass-${e.id}" data-pass="${(e.password||'').replace(/"/g,'&quot;')}">••••••••</span>
              <button class="show-btn" onclick="togglePass('epass-${e.id}')">Show</button>
              <button class="copy-btn" onclick="copyToClipboard(document.getElementById('epass-${e.id}').getAttribute('data-pass'), this)" title="Copy Password">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </td>
            <td>${paymentBadge(e.payment_status)}</td>
            <td class="mono" style="font-size:0.78rem;color:var(--text-muted);display:none;">
              ${new Date(e.purchased_at || e.created_at).toLocaleDateString()}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── RENDER TRANSACTIONS ───────────────────────────────────────
function renderTransactions(data, panelId = 'panel-transactions') {
  const panel = document.getElementById(panelId);
  if (!data || data.length === 0) {
    panel.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 64 64" fill="none">
          <path d="M32 8v48M8 32h48" stroke="currentColor" stroke-width="2"/>
          <rect x="12" y="12" width="40" height="40" rx="4" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        <p class="empty-title">No transactions yet</p>
        <p class="empty-sub">Add money to your wallet to get started</p>
      </div>`;
    return;
  }
  panel.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Description</th>
          <th>M-Pesa Number</th>
          <th>Amount</th>
          <th>Status</th>
          <th style="display:none;">Date & Time</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(t => `
          <tr>
            <td>
              <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:0.72rem;font-weight:600;font-family:DM Mono,monospace;
                ${t.type === 'deposit'
                  ? 'background:var(--green-glow);color:var(--green);border:1px solid var(--green-dim);'
                  : 'background:var(--blue-glow);color:var(--blue);border:1px solid rgba(59,130,246,0.3);'}">
                ${t.type === 'deposit' ? '↓ Deposit' : '↑ Purchase'}
              </span>
            </td>
            <td style="font-size:0.82rem;color:var(--text-secondary);">${t.description || '—'}</td>
            <td class="mono">${t.mpesa_phone || '—'}</td>
            <td class="mono" style="color:${t.type === 'deposit' ? 'var(--green)' : 'var(--red)'};font-weight:600;">
              ${t.type === 'deposit' ? '+' : '-'}KES ${t.amount}
            </td>
            <td>${paymentBadge(t.status)}</td>
            <td class="mono" style="font-size:0.75rem;color:var(--text-muted);display:none;">
              ${new Date(t.created_at).toLocaleString()}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── LOAD STATS ────────────────────────────────────────────────
async function loadStats() {
  const [
    { data: proxies },
    { data: emails },
    walletRes,
    { data: txns }
  ] = await Promise.all([
    db.from('proxies').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }),
    db.from('emails').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }),
    db.from('wallets').select('balance').eq('user_id', currentUserId).limit(1).maybeSingle(),
    db.from('transactions').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }),
  ]);

  // Filter proxies: only show the latest one per listing_id, hide older duplicates
  const uniqueProxies = [];
  const seenListings = new Set();
  
  if (proxies) {
    for (const proxy of proxies.sort((a, b) => new Date(b.purchased_at) - new Date(a.purchased_at))) {
      if (!seenListings.has(proxy.listing_id)) {
        uniqueProxies.push(proxy);
        seenListings.add(proxy.listing_id);
      }
    }
  }

  const active    = (uniqueProxies || []).filter(p => p.status === 'active');
  const expired   = (uniqueProxies || []).filter(p => p.status === 'expired');
  const emailList = emails || [];
  const txList    = txns  || [];

  currentBalance = (walletRes?.data?.balance || 0);
  updateBalanceDisplay();

  allProxies = uniqueProxies || [];
  allEmails = emailList;
  allTransactions = txList;

  if (document.getElementById('stat-active'))  document.getElementById('stat-active').textContent   = active.length;
  if (document.getElementById('stat-expired')) document.getElementById('stat-expired').textContent  = expired.length;
  if (document.getElementById('stat-emails'))  document.getElementById('stat-emails').textContent   = emailList.length;
  if (document.getElementById('stat-txns'))    document.getElementById('stat-txns').textContent     = txList.length;

  // Render on index only if elements exist (other pages will handle their own)
  if (document.getElementById('panel-active')) renderProxies(active,  'panel-active',  'active');
  if (document.getElementById('panel-expired')) renderProxies(expired, 'panel-expired', 'expired');
  if (document.getElementById('emails-list')) renderEmails(emailList, 'emails-list');
  if (document.getElementById('transactions-list')) renderTransactions(txList, 'transactions-list');
  // Legacy support for index.html if it still uses panel- names
  if (document.getElementById('emails-panel')) renderEmails(emailList, 'emails-panel');
  if (document.getElementById('transactions-panel')) renderTransactions(txList, 'transactions-panel');
}

// ── ADD MONEY MODAL ───────────────────────────────────────────
let lastOpenTime = 0;
async function openAddMoney() {
  const now = Date.now();
  if (now - lastOpenTime < 500) return; // Debounce multiple clicks
  lastOpenTime = now;

  try {
    const modal = document.getElementById('modal-addmoney');
    if (!modal) throw new Error('Add money modal not found');
    
    // Reset views inside modal
    const amt = document.getElementById('am-amount');
    const phone = document.getElementById('am-phone');
    const err = document.getElementById('am-error');
    const view = document.getElementById('am-view');
    const success = document.getElementById('am-success');
    
    if (amt) amt.value = '';
    if (phone) phone.value = '';
    if (err) err.style.display = 'none';
    if (view) view.style.display = 'block';
    if (success) success.style.display = 'none';
    
    modal.classList.add('open');
    
    // Focus the amount input
    setTimeout(() => { if (amt) amt.focus(); }, 150);
    console.log('Add money modal opened');
  } catch (err) {
    console.error('openAddMoney error:', err);
    // Fallback: if modal isn't present (likely an older cached page), offer a quick top-up prompt
    try {
      const quick = confirm('Add Money UI not available on this page. Would you like to try a quick top-up via M-Pesa prompt?');
      if (!quick) {
        alert('Unable to open Add Money modal. Please try again or contact support.');
        return;
      }
      const amtRaw = prompt('Enter amount (KES)', '500');
      if (!amtRaw) { alert('Top-up cancelled'); return; }
      const amt = parseInt(amtRaw.replace(/[^0-9]/g,''), 10);
      if (!amt || amt < 1) { alert('Invalid amount'); return; }
      const phoneRaw = prompt('Enter M-Pesa phone (e.g. 254712345678)', '2547');
      if (!phoneRaw) { alert('Top-up cancelled'); return; }
      const phone = phoneRaw.replace(/\D/g,'');
      if (phone.length < 9) { alert('Invalid phone number'); return; }

      const orderId = 'WL' + Date.now().toString().slice(-10);
      const apiUrl = '/api/stkpush';
      const resp = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone, amount: amt, orderId: orderId, description: 'Wallet Top-up (quick)' })
      });
      const data = await resp.json();
      if (data && data.success) {
        alert('M-Pesa prompt sent. Check your phone to complete the payment.');
      } else {
        console.error('STK push failed', data);
        alert('Failed to initiate M-Pesa prompt: ' + (data?.error || 'Unknown error'));
      }
    } catch (err2) {
      console.error('Fallback top-up failed', err2);
      alert('Unable to open Add Money modal. Please try again or contact support.');
    }
  }
}

async function confirmAddMoney() {
  const amountRaw = document.getElementById('am-amount').value.trim();
  const phone     = document.getElementById('am-phone').value.trim();

  const amount = parseInt(amountRaw);

  if (!amount || amount < 1) { showAmError('Please enter a valid amount'); return; }
  if (!phone)                 { showAmError('Please enter your M-Pesa number'); return; }

  const btn = document.getElementById('am-btn');
  btn.disabled  = true;
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-color:rgba(0,0,0,0.2);border-top-color:#000"></div> Processing...';

  try {
    // Generate unique order ID - MUST be short for AccountReference (max 20 chars)
    const orderId = 'WL' + Date.now().toString().slice(-10);

    const apiUrl = '/api/stkpush';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: phone,
        amount: amount,
        orderId: orderId,
        description: 'Wallet Top-up'
      })
    });

    const data = await response.json();

    if (!data.success) {
      console.error('STK API Error:', data);
      throw new Error(data.error || 'STK Push failed at server');
    }

    // Log a pending transaction (only use columns that exist in the table)
    const pendingDesc = `Wallet top-up via M-Pesa (KES ${amount})`;
    const { error: txErr } = await db.from('transactions').insert([{
      user_id:     currentUserId,
      type:        'deposit',
      amount:      amount,
      description: pendingDesc,
      status:      'pending',
      checkout_request_id: data.checkoutRequestId,
      created_at:  new Date().toISOString()
    }]);

    if (txErr) console.error('Transaction log error:', txErr);

    // Provide visual feedback that we are waiting for the user's PIN
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-color:rgba(0,0,0,0.2);border-top-color:#000"></div> Waiting for PIN...';

    // Begin dynamic polling
    pollAddMoneyStatus(data.checkoutRequestId, amount, pendingDesc);

  } catch (err) {
    showAmError(err.message);
    btn.disabled  = false;
    btn.innerHTML = '✓ Add Money';
  }
}

async function pollAddMoneyStatus(checkoutId, amount, pendingDesc) {
  const btn = document.getElementById('am-btn');
  const errorEl = document.getElementById('am-error');
  let attempts = 0;
  
  // Show a live "checking" status
  errorEl.style.display = 'block';
  errorEl.style.color = '#eab308';  // Yellow for pending
  errorEl.textContent = '⏳ Waiting for you to enter your M-Pesa PIN...';
  
  const poll = setInterval(async () => {
    if (++attempts > 30) { 
      clearInterval(poll); 
      showAmError('⏰ Payment request timed out. If you entered your PIN, your balance will update automatically once M-Pesa confirms.');
      btn.disabled = false; btn.innerHTML = '✓ Add Money';
      return; 
    }
    
    // Update progress text
    if (attempts <= 5) {
      errorEl.textContent = '⏳ Waiting for you to enter your M-Pesa PIN...';
    } else {
      errorEl.textContent = `⏳ Checking payment status... (${attempts}/30)`;
    }
    
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutRequestId: checkoutId })
      });
      const data = await res.json();
      
      if (data.success && data.status === 'completed') {
        clearInterval(poll);
        
        // ✅ SUCCESS — Update the transaction record atomically
        const { data: updatedTxs } = await db.from('transactions').update({ 
          status: 'success', 
          description: `Wallet top-up via M-Pesa (KES ${amount}) ✓`
        }).eq('user_id', currentUserId)
         .eq('description', pendingDesc)
         .eq('status', 'pending')
         .select();
        
        // Ensure atomic wallet funding if frontend beats the webhook
        if (updatedTxs && updatedTxs.length > 0) {
          const { data: curWallet } = await db.from('wallets')
            .select('balance')
            .eq('user_id', currentUserId)
            .maybeSingle();
            
          const newBal = (curWallet?.balance || 0) + amount;
          await db.from('wallets').upsert([{ 
             user_id: currentUserId, 
             balance: newBal, 
             updated_at: new Date().toISOString() 
          }], { onConflict: 'user_id' });
          
          currentBalance = newBal;
        } else {
          // Webhook processed it, fetch latest balance
          const { data: curWallet } = await db.from('wallets')
            .select('balance')
            .eq('user_id', currentUserId)
            .maybeSingle();
          if (curWallet) currentBalance = curWallet.balance;
        }
        
        updateBalanceDisplay();
        
        // Show success view
        document.getElementById('am-view').style.display    = 'none';
        document.getElementById('am-success').style.display = 'block';
        document.getElementById('am-success-amount').textContent  = 'KES ' + amount;
        document.getElementById('am-success-balance').textContent = 'New Balance: KES ' + (currentBalance || '—');
        
        showToast(`KES ${amount} added to your wallet! 🎉`);
        loadStats(); 
        maybeShowRatingPrompt();
        
      } else if (!data.success && data.status === 'failed') {
        clearInterval(poll);
        
        // ❌ FAILED — Show the specific reason
        showAmError('❌ ' + (data.error || 'Payment failed. Please try again.'));
        btn.disabled = false; btn.innerHTML = '✓ Add Money';
        
        // Mark the pending transaction as failed
        await db.from('transactions').update({ 
          status: 'failed', 
          description: `Top-up failed: ${data.error || 'Cancelled'}`
        }).eq('user_id', currentUserId)
         .eq('description', pendingDesc)
         .eq('status', 'pending');
        
        loadStats();
      }
      // If status is 'pending', the interval continues polling
      
    } catch (e) { 
      console.error('Poll error:', e); 
    }
  }, 3000);
}

function showAmError(msg) {
  const el = document.getElementById('am-error');
  el.textContent   = msg;
  el.style.color   = '#ef4444';  // Red for errors
  el.style.display = 'block';
}



function copyReferralLink() {
  const input = document.getElementById('ref-link-input');
  input.select();
  document.execCommand('copy');
  showToast('Referral link copied! 🚀');
}

// ── FEEDBACK LOGIC ────────────────────────────────────────────
let feedbackEditingId = null;

async function openFeedbackModal() {
  const btn = document.getElementById('submit-feedback-btn');
  btn.textContent = 'Checking...';
  btn.disabled = true;

  // Check if user already has a review to allow editing it
  const { data, error } = await db.from('feedbacks')
    .select('*')
    .eq('user_id', currentUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  btn.disabled = false;
  
  if (data) {
    feedbackEditingId = data.id;
    document.getElementById('feedback-content').value = data.content;
    document.getElementById('rating-val').value = data.rating;
    document.querySelector('#modal-feedback .modal-title').textContent = 'Update Your Feedback';
    btn.textContent = 'Update Review';
  } else {
    feedbackEditingId = null;
    document.getElementById('feedback-content').value = '';
    document.getElementById('rating-val').value = '5';
    document.querySelector('#modal-feedback .modal-title').textContent = 'Share Your Experience';
    btn.textContent = 'Submit Review';
  }

  // Sync star UI
  const rating = parseInt(document.getElementById('rating-val').value);
  const stars = document.querySelectorAll('#star-input-wrap span');
  stars.forEach(s => {
    s.style.color = parseInt(s.getAttribute('data-val')) <= rating ? '#eab308' : '#333';
  });

  openModal('feedback');
  initStarRating();
}

function initStarRating() {
  const stars = document.querySelectorAll('#star-input-wrap span');
  const input = document.getElementById('rating-val');
  if (!stars.length) return;

  stars.forEach(s => {
    s.onclick = () => {
      const val = parseInt(s.getAttribute('data-val'));
      input.value = val;
      updateStars(val);
    };
    s.onmouseover = () => updateStars(parseInt(s.getAttribute('data-val')));
    s.onmouseout = () => updateStars(parseInt(input.value));
  });

  function updateStars(val) {
    stars.forEach(s => {
      s.style.color = parseInt(s.getAttribute('data-val')) <= val ? '#eab308' : '#333';
    });
  }
  updateStars(parseInt(input.value));
}

async function submitFeedback() {
  const content = document.getElementById('feedback-content').value.trim();
  const rating = parseInt(document.getElementById('rating-val').value);
  const name = document.getElementById('user-name').textContent;



  const btn = document.getElementById('submit-feedback-btn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Processing...';

  let res;
  if (feedbackEditingId) {
    res = await db.from('feedbacks').update({
      rating: rating,
      content: content,
      created_at: new Date().toISOString()
    }).eq('id', feedbackEditingId);
  } else {
    res = await db.from('feedbacks').insert([{
      user_id: currentUserId,
      user_name: name,
      rating: rating,
      content: content || `Rated ${rating} star${rating !== 1 ? 's' : ''}`
    }]);
  }

  btn.disabled = false;
  btn.textContent = originalText;

  if (res.error) {
    showToast(res.error.message, 'error');
  } else {
    showToast(feedbackEditingId ? 'Feedback updated!' : 'Feedback submitted! Thank you.');
    closeModal('feedback');
    document.getElementById('feedback-content').value = '';
    feedbackEditingId = null;
  }
}
// ── POST-TRANSACTION RATING ───────────────────────────────────
function initRateStars() {
  const stars = document.querySelectorAll('#rate-star-wrap span');
  const input = document.getElementById('rate-val');
  if (!stars.length) return;

  stars.forEach(s => {
    s.addEventListener('click', () => {
      const val = parseInt(s.getAttribute('data-val'));
      input.value = val;
      updateRateStars(val);
    });
    s.addEventListener('mouseover', () => updateRateStars(parseInt(s.getAttribute('data-val'))));
    s.addEventListener('mouseout', () => updateRateStars(parseInt(input.value)));
  });

  function updateRateStars(val) {
    stars.forEach(s => {
      s.classList.toggle('selected', parseInt(s.getAttribute('data-val')) <= val);
    });
  }
  updateRateStars(parseInt(input.value));
}

async function maybeShowRatingPrompt() {
  if (!currentUserId) return;

  try {
    // Check if user already left a rating via the dashboard prompt
    const { data: existing } = await db.from('feedbacks')
      .select('id')
      .eq('user_id', currentUserId)
      .limit(1);

    if (existing && existing.length > 0) return; // Already rated, don't bother

    // Check how many successful transactions the user has
    const { data: txns, error } = await db.from('transactions')
      .select('id')
      .eq('user_id', currentUserId)
      .eq('status', 'success')
      .limit(2);

    if (error || !txns) return;

    // Only prompt on the FIRST successful transaction (count === 1)
    if (txns.length === 1) {
      setTimeout(() => openModal('rate'), 1500);
    }
  } catch (e) {
    console.error('Rating prompt check error:', e);
  }
}

function skipRating() {
  closeModal('rate');
}

// ── SEARCH HANDLERS ───────────────────────────────────────────
function handleProxySearch(query) {
  const q = query.toLowerCase().trim();
  const filtered = allProxies.filter(p => 
    (p.country || '').toLowerCase().includes(q) ||
    (p.host || '').toLowerCase().includes(q) ||
    (p.port || '').toString().includes(q)
  );

  const active = filtered.filter(p => p.status === 'active');
  const expired = filtered.filter(p => p.status === 'expired');

  if (document.getElementById('panel-active')) renderProxies(active, 'panel-active', 'active');
  if (document.getElementById('panel-expired')) renderProxies(expired, 'panel-expired', 'expired');
}

function handleEmailSearch(query) {
  const q = query.toLowerCase().trim();
  const filtered = allEmails.filter(e => 
    (e.email || '').toLowerCase().includes(q)
  );
  if (document.getElementById('emails-list')) renderEmails(filtered, 'emails-list');
}

function handleTxnSearch(query) {
  const q = query.toLowerCase().trim();
  const filtered = allTransactions.filter(t => 
    (t.description || '').toLowerCase().includes(q) ||
    (t.mpesa_phone || '').toLowerCase().includes(q) ||
    (t.amount || '').toString().includes(q)
  );
  if (document.getElementById('transactions-list')) renderTransactions(filtered, 'transactions-list');
}

// ── BAN HANDLING ──────────────────────────────────────────────
async function checkBanStatus() {
  if (!currentUserId) return;
  
  try {
    const { data: banData, error } = await db.from('user_bans')
      .select('banned, reason')
      .eq('user_id', currentUserId)
      .maybeSingle();

    if (banData && banData.banned) {
      showBanOverlay(banData.reason || 'Term violation or suspicious activity.');
    }
  } catch (err) {
    console.error('Ban check failed:', err);
  }
}

function showBanOverlay(reason) {
  // Create overlay element
  const overlay = document.createElement('div');
  overlay.className = 'ban-overlay';
  overlay.innerHTML = `
    <div class="ban-modal">
      <div class="ban-icon">🚫</div>
      <h2 class="ban-title">Account Suspended</h2>
      <p class="ban-reason">Your access to KibeProxy Hub has been restricted.</p>
      <div class="ban-detail"><strong>Reason:</strong> ${reason}</div>
      <p class="ban-contact">If you believe this is a mistake, contact support at kibetcreations2025@outlook.com</p>
      <button class="ban-btn" onclick="handleLogout()">Sign Out</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden'; // Prevent scrolling
  
  // Disable all buttons on the page
  document.querySelectorAll('button:not(.ban-btn), a').forEach(el => {
    el.style.pointerEvents = 'none';
    el.style.filter = 'grayscale(1) opacity(0.5)';
  });
}

async function submitRating() {
  const rating = parseInt(document.getElementById('rate-val').value);
  const content = document.getElementById('rate-content').value.trim();

  const btn = document.getElementById('rate-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    const userName = document.getElementById('user-name')?.textContent || currentUserEmail.split('@')[0];

    const { error } = await db.from('feedbacks').insert([{
      user_id: currentUserId,
      user_name: userName,
      rating: rating,
      content: content || `Rated ${rating} star${rating !== 1 ? 's' : ''}`
    }]);

    if (error) throw error;

    showToast('Thank you for your rating! 🎉');
    closeModal('rate');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Rating';
  }
}

async function init() {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session || !session.user) { window.location.href = 'auth.html'; return; }

    currentUserId    = session.user.id;
    currentUserEmail = session.user.email;

    const meta = session.user.user_metadata || {};
    const name = meta.full_name || currentUserEmail.split('@')[0];
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    AppCache.set('user_meta', { name, initials });
    if (document.getElementById('user-name')) document.getElementById('user-name').textContent = name;
    if (document.getElementById('user-initials')) document.getElementById('user-initials').textContent = initials;

    if (currentUserEmail === ADMIN_EMAIL) {
      const al = document.getElementById('admin-link');
      if (al) al.style.display = 'inline-flex';
    }

    // Handle tab switching via URL hash
    const hash = window.location.hash.substring(1);
    if (hash && ['active', 'expired', 'emails', 'transactions'].includes(hash)) {
      const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick')?.includes(`'${hash}'`));
      if (btn) switchTab(btn, hash);
    }

    initRateStars();
    loadStats();
    checkBanStatus();
  } catch (err) {
    console.error('Init error:', err);
  } finally {
    showPage();
  }
}

init();