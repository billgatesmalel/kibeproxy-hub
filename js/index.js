// ── DASHBOARD LOGIC ───────────────────────────────────────────
let currentUserId = null;
let currentBalance = 0;

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

// ── RENEWAL LOGIC ─────────────────────────────────────────────
let currentRenewProxyId = null;
let currentRenewDays = 1;
let currentRenewPricePerDay = 100; // Default

function openRenewModal(pId, host, country, currentExp) {
  currentRenewProxyId = pId;
  currentRenewDays = 1;
  
  document.getElementById('rn-host').textContent = host;
  document.getElementById('rn-country').textContent = country;
  document.getElementById('rn-current-exp').textContent = new Date(currentExp).toLocaleString();
  document.getElementById('rn-total').textContent = `KES ${currentRenewPricePerDay}`;
  
  document.querySelectorAll('.renew-dur').forEach(b => b.classList.remove('active'));
  document.querySelector('.renew-dur').classList.add('active'); // First one
  
  document.getElementById('rn-error').style.display = 'none';
  openModal('renew');
}

function setRenewDuration(days, btn) {
  currentRenewDays = days;
  document.querySelectorAll('.renew-dur').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('rn-total').textContent = `KES ${days * currentRenewPricePerDay}`;
}

async function confirmRenewal() {
  const total = currentRenewDays * currentRenewPricePerDay;
  if (currentBalance < total) {
    document.getElementById('rn-error').textContent = 'Insufficient wallet balance.';
    document.getElementById('rn-error').style.display = 'block';
    return;
  }

  const btn = document.getElementById('rn-confirm-btn');
  btn.disabled = true;
  btn.textContent = 'Renewing...';

  try {
    // 1. Get current proxy to find its expiry
    const { data: proxy } = await db.from('proxies').select('expires_at').eq('id', currentRenewProxyId).single();
    const currentExp = new Date(proxy.expires_at);
    const newExp = new Date(currentExp.getTime() + currentRenewDays * 86400000);

    // 2. Deduct from wallet
    const newBalance = currentBalance - total;
    await db.from('wallets').upsert([{
      user_id: currentUserId,
      balance: newBalance,
      updated_at: new Date().toISOString()
    }], { onConflict: 'user_id' });

    // 3. Update proxy expiry
    await db.from('proxies').update({
      expires_at: newExp.toISOString(),
      status: 'active'
    }).eq('id', currentRenewProxyId);

    // 4. Record transaction
    await db.from('transactions').insert([{
      user_id: currentUserId,
      type: 'purchase',
      amount: total,
      description: `Proxy Renewal (${currentRenewDays} days)`,
      status: 'success',
      created_at: new Date().toISOString()
    }]);

    currentBalance = newBalance;
    updateBalanceDisplay();
    
    showToast(`Proxy renewed for ${currentRenewDays} more days!`);
    closeModal('renew');
    loadStats();
  } catch (err) {
    document.getElementById('rn-error').textContent = err.message;
    document.getElementById('rn-error').style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirm Renewal';
  }
}

function updateBalanceDisplay() {
  const pills = document.querySelectorAll('.balance-pill span, #stat-balance');
  pills.forEach(p => {
    if (p.id === 'stat-balance') p.textContent = 'KES ' + currentBalance;
    else p.textContent = 'KES ' + currentBalance;
  });
}

async function init() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = 'auth.html'; return; }

  currentUserId    = session.user.id;
  currentUserEmail = session.user.email;

  const meta = session.user.user_metadata || {};
  const name = meta.full_name || currentUserEmail.split('@')[0];
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  AppCache.set('user_meta', { name, initials });
  document.getElementById('user-name').textContent     = name;
  document.getElementById('user-initials').textContent = initials;

  if (currentUserEmail === ADMIN_EMAIL) {
    document.getElementById('admin-link').style.display = 'inline-flex';
  }

  // Handle tab switching via URL hash (e.g. #active, #emails)
  const hash = window.location.hash.substring(1);
  if (['active', 'expired', 'emails', 'transactions'].includes(hash)) {
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(`'${hash}'`));
    if (btn) switchTab(btn, hash);
  }

  loadStats();
}

// ── TAB SWITCH ────────────────────────────────────────────────
function switchTab(btn, tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['active', 'expired', 'emails', 'transactions'].forEach(t => {
    document.getElementById('panel-' + t).style.display = t === tab ? 'block' : 'none';
  });
}

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
              ${p.status === 'active' ? `<button class="renew-btn" onclick="openRenewModal('${p.id}', '${p.host}', '${p.country}', '${p.expires_at}')">Renew</button>` : ''}
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
function renderEmails(data) {
  const panel = document.getElementById('panel-emails');
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
function renderTransactions(data) {
  const panel = document.getElementById('panel-transactions');
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
    db.from('wallets').select('balance').eq('user_id', currentUserId).limit(1).single(),
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

  const currentBalance = (walletRes?.data?.balance || 0);
  updateGlobalBalance(currentBalance);

  // Referral Stats
  const refEarned = (txList || []).filter(t => t.type === 'bonus' && t.status === 'success').reduce((acc, t) => acc + t.amount, 0);
  document.getElementById('ref-earned').textContent = 'KES ' + refEarned;
  const refLink = window.location.origin + '/auth.html?ref=' + currentUserId;
  document.getElementById('ref-link-input').value = refLink;

  document.getElementById('stat-active').textContent   = active.length;
  document.getElementById('stat-expired').textContent  = expired.length;
  document.getElementById('stat-emails').textContent   = emailList.length;
  document.getElementById('stat-txns').textContent     = txList.length;

  document.getElementById('badge-active').textContent       = active.length;
  document.getElementById('badge-expired').textContent      = expired.length;
  document.getElementById('badge-emails').textContent       = emailList.length;
  document.getElementById('badge-transactions').textContent = txList.length;

  renderProxies(active,  'panel-active',  'active');
  renderProxies(expired, 'panel-expired', 'expired');
  renderEmails(emailList);
  renderTransactions(txList);
}

// ── ADD MONEY MODAL ───────────────────────────────────────────
function openAddMoney() {
  document.getElementById('modal-addmoney').classList.add('open');
  document.getElementById('am-amount').value = '';
  document.getElementById('am-phone').value  = '';
  document.getElementById('am-error').style.display  = 'none';
  document.getElementById('am-view').style.display   = 'block';
  document.getElementById('am-success').style.display = 'none';
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

    // Call STK Push API
    // Call STK Push API - Always hit the Vercel backend for now as it contains the secrets
    const apiUrl = 'https://kibeproxy-hub-app.vercel.app/api/stkpush';
    
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

    // For now, show success message - in production, wait for callback
    // The callback will update the balance when payment is confirmed
    document.getElementById('am-view').style.display    = 'none';
    document.getElementById('am-success').style.display = 'block';
    document.getElementById('am-success-amount').textContent  = 'KES ' + amount;
    document.getElementById('am-success-balance').textContent = 'Balance will update after payment confirmation';

    // Optionally, add a pending transaction
    const { error: txErr } = await db.from('transactions').insert([{
      user_id:     currentUserId,
      type:        'deposit',
      amount:      amount,
      description: 'Wallet top-up via M-Pesa (pending)',
      mpesa_phone: phone,
      status:      'pending',
      checkout_request_id: data.checkoutRequestId
    }]);

    if (txErr) console.error('Transaction log error:', txErr);

    // Reload after a delay to check for updates
    setTimeout(() => loadStats(), 10000);

  } catch (err) {
    showAmError(err.message);
    btn.disabled  = false;
    btn.innerHTML = '✓ Add Money';
  }
}

function showAmError(msg) {
  const el = document.getElementById('am-error');
  el.textContent   = msg;
  el.style.display = 'block';
}

function closeModal(id) {
  document.getElementById('modal-' + id).classList.remove('active');
}

function copyReferralLink() {
  const input = document.getElementById('ref-link-input');
  input.select();
  document.execCommand('copy');
  showToast('Referral link copied! 🚀');
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = '✓';
    setTimeout(() => btn.innerHTML = original, 1500);
  });
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

  if (!content) { showToast('Please write your feedback', 'error'); return; }

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
      content: content
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

async function init() {
  await loadStats();
  updateGlobalBalance();
}

init();