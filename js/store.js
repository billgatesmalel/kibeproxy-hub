// ── STORE LOGIC ───────────────────────────────────────────────
let currentUserId    = null;
let currentUserEmail = null;
let currentBalance   = 0;
let proxyListings    = [];
let emailListings    = [];
let activeTab        = 'proxies';
let pendingOrderData = null;
let selectedPaymentMethod = 'mpesa';

// Use different backend URLs based on environment
const MPESA_API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://kibeproxy-hub-app.vercel.app';

const PROXY_PLANS = [
  { days: 1,  label: 'Daily',   price: 150,  savings: '' },
  { days: 7,  label: '7 Days',  price: 900,  savings: 'Save 15%' },
  { days: 14, label: '14 Days', price: 1600, savings: 'Save 25%' },
  { days: 30, label: 'Monthly', price: 3000, savings: 'Save 40%' },
];

const selectedPlans = {}; // Format: { country: days }

// ── AUTH GUARD ────────────────────────────────────────────────
async function initStore() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = 'auth.html'; return; }

  currentUserId    = session.user.id;
  currentUserEmail = session.user.email;
  const walletRes  = await db.from('wallets').select('balance').eq('user_id', currentUserId).single();
  currentBalance   = walletRes.data?.balance || 0;

  const balancePill = document.querySelector('.balance-pill');
  if (balancePill) balancePill.textContent = 'KES ' + currentBalance;

  const name     = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  document.getElementById('user-name').textContent     = name;
  document.getElementById('user-initials').textContent = initials;

  // Show admin link for all users
  if (session.user.email === ADMIN_EMAIL) {
    const adminLink = document.getElementById('admin-link');
    if (adminLink) adminLink.style.display = 'inline-flex';
  }

  loadListings();
}

// ── LOAD LISTINGS ─────────────────────────────────────────────
async function loadListings() {
  const [{ data: proxies }, { data: emails }, { data: userProxies }] = await Promise.all([
    db.from('proxy_listings').select('*').eq('available', true).order('created_at', { ascending: false }),
    db.from('email_listings').select('*').eq('available', true).order('created_at', { ascending: false }),
    db.from('proxies').select('listing_id').eq('user_id', currentUserId).eq('status', 'active')
  ]);

  // Filter out proxies the user already owns
  const ownedListingIds = new Set((userProxies || []).map(p => p.listing_id));
  proxyListings = (proxies || []).filter(p => !ownedListingIds.has(p.id));
  emailListings = emails  || [];

  renderTab(activeTab);
}

// ── SWITCH TAB ────────────────────────────────────────────────
function switchStoreTab(tab, btn) {
  activeTab = tab;
  document.querySelectorAll('.store-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTab(tab);
}

function renderTab(tab) {
  if (tab === 'proxies') renderProxyListings();
  else                   renderEmailListings();
}

// ── RENDER PROXY LISTINGS ─────────────────────────────────────
function renderProxyListings() {
  const grid = document.getElementById('store-grid');
  if (!proxyListings.length) {
    grid.innerHTML = `
      <div class="store-empty">
        <p>No proxies available right now.</p>
        <p style="color:var(--text-muted);font-size:0.82rem;margin-top:0.5rem;">Check back soon or contact support.</p>
      </div>`;
    return;
  }

  // Group by country
  const grouped = {};
  proxyListings.forEach(p => {
    if (!grouped[p.country]) {
      grouped[p.country] = {
        name: p.country,
        flag: p.flag || '🌍',
        items: []
      };
    }
    grouped[p.country].items.push(p);
  });

  grid.innerHTML = Object.values(grouped).map(group => {
    const country = group.name;
    if (!selectedPlans[country]) selectedPlans[country] = 1; // Default to Daily
    const plan = PROXY_PLANS.find(p => p.days === selectedPlans[country]);

    return `
    <div class="listing-card">
      <div class="card-header">
        <div class="country-flag">${group.flag}</div>
        <div class="country-info">
          <div class="country-name">${country} Proxy</div>
          <div class="country-sub">High Speed Residential</div>
        </div>
        <span class="avail-badge">● Pool: ${group.items.length}</span>
      </div>

      <div class="card-specs">
        <div class="spec-row">
          <span class="spec-label">Protocol</span>
          <span class="spec-val">HTTP / SOCKS5</span>
        </div>
        <div class="spec-row">
          <span class="spec-label">Uptime</span>
          <span class="spec-val green">99.9%</span>
        </div>
        <div class="spec-row">
          <span class="spec-label">Location</span>
          <span class="spec-val">${country}</span>
        </div>
      </div>

      <div class="duration-section">
        <div class="dur-label">Select Your Plan</div>
        <div class="dur-options" style="grid-template-columns: repeat(2, 1fr);">
          ${PROXY_PLANS.map(p => `
            <button class="dur-btn ${selectedPlans[country] === p.days ? 'active' : ''}"
              onclick="selectProxyPlan('${country}', ${p.days}, this)"
              style="padding: 12px 6px; position: relative;">
              <span class="dur-lbl" style="font-weight: 800; font-size: 0.85rem; margin-bottom: 2px;">${p.label}</span>
              <span class="dur-days" style="font-size: 0.65rem; color: var(--text-muted); font-weight: 500;">KES ${p.price}</span>
              ${p.savings ? `<span style="position: absolute; top: -5px; right: -5px; background: var(--green); color: #000; font-size: 0.55rem; padding: 2px 5px; border-radius: 4px; font-weight: 800;">${p.savings}</span>` : ''}
            </button>`).join('')}
        </div>
        
        <div class="price-row">
          <span class="price-label">Selected: ${plan.label}</span>
          <span class="price-val" id="price-${country.replace(/\s/g, '-')}">KES ${plan.price}</span>
        </div>

        <button class="buy-btn" onclick="openProxyOrder('${country}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          Get Started
        </button>
      </div>
    </div>`;
  }).join('');
}

// ── RENDER EMAIL LISTINGS ─────────────────────────────────────
// ... (email logic remains same, but I'll update it for consistency if needed)

// ── SELECT PLAN ───────────────────────────────────────────────
function selectProxyPlan(country, days, btn) {
  selectedPlans[country] = days;
  const card = btn.closest('.listing-card');
  card.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  const plan = PROXY_PLANS.find(p => p.days === days);
  const priceId = `price-${country.replace(/\s/g, '-')}`;
  document.getElementById(priceId).textContent = `KES ${plan.price}`;
}

// ── OPEN PROXY ORDER ──────────────────────────────────────────
function openProxyOrder(country) {
  // Find first available proxy for this country
  const availableProbies = proxyListings.filter(p => p.country === country);
  if (!availableProbies.length) {
    showToast('No proxies currently available for this country.', 'error');
    return;
  }
  
  const listing = avai  const btn = document.getElementById('confirm-btn');
  btn.dataset.type    = 'proxy';
  btn.dataset.id      = listing.id;
  btn.dataset.days    = days;
  btn.dataset.expires = new Date(Date.now() + days * 86400000).toISOString();

  pendingOrderData = { type: 'proxy', id: listing.id, days, expires: btn.dataset.expires };

  showOrderView();
  openModal('order');
}

// ── OPEN EMAIL ORDER ──────────────────────────────────────────
function openEmailOrder(id) {
  const listing = emailListings.find(e => e.id === id);

  document.getElementById('o-icon').textContent    = '✉️';
  document.getElementById('o-title').textContent   = 'Email Account';
  document.getElementById('o-host').textContent    = listing.email;
  document.getElementById('o-dur').textContent     = 'Lifetime';
  document.getElementById('o-price').textContent   = `KES ${listing.price}`;
  document.getElementById('o-expires').textContent = 'Never';
  document.getElementById('o-total').textContent   = `KES ${listing.price}`;

  const btn = document.getElementById('confirm-btn');
  btn.dataset.type = 'email';
  btn.dataset.id   = id;

  pendingOrderData = { type: 'email', id };

  showOrderView();
  openModal('order');
}

function showOrderView() {
  document.getElementById('order-view').style.display    = 'block';
  document.getElementById('mpesa-view').style.display    = 'none';
  document.getElementById('success-view').style.display  = 'none';
  hideOrderError();
  renderPaymentOptions();
}

function showOrderError(msg) {
  const el = document.getElementById('order-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function hideOrderError() {
  const el = document.getElementById('order-error');
  if (el) el.style.display = 'none';
}

function renderPaymentOptions() {
  const totalText = document.getElementById('o-total').textContent || '0';
  const total = parseInt(totalText.replace(/KES\s?/, '').replace(/,/g, '')) || 0;
  const methodEl = document.getElementById('o-payment-method');
  const optionsEl = document.getElementById('o-payment-options');
  selectedPaymentMethod = 'mpesa';

  if (methodEl) {
    methodEl.textContent = currentBalance >= total
      ? 'Choose payment method'
      : 'Wallet insufficient, pay with M-Pesa';
  }

  if (optionsEl) {
    if (currentBalance >= total && total > 0) {
      optionsEl.innerHTML = `
        <label style="display:flex;align-items:center;gap:8px;">
          <input type="radio" name="payment_method" value="wallet" checked onchange="onPaymentMethodChange('wallet')" />
          Use wallet balance (KES ${currentBalance})
        </label>
        <label style="display:flex;align-items:center;gap:8px;margin-top:6px;">
          <input type="radio" name="payment_method" value="mpesa" onchange="onPaymentMethodChange('mpesa')" />
          Pay with M-Pesa
        </label>
      `;
      selectedPaymentMethod = 'wallet';
    } else {
      optionsEl.innerHTML = `
        <label style="display:flex;align-items:center;gap:8px;">
          <input type="radio" name="payment_method" value="mpesa" checked onchange="onPaymentMethodChange('mpesa')" />
          Pay with M-Pesa
        </label>
      `;
      selectedPaymentMethod = 'mpesa';
    }
    onPaymentMethodChange(selectedPaymentMethod);
  }
}

function onPaymentMethodChange(method) {
  selectedPaymentMethod = method;
  const btn = document.getElementById('confirm-btn');
  if (!btn) return;
  if (method === 'wallet') btn.textContent = 'Pay from Wallet';
  else                     btn.textContent = 'Pay with M-Pesa 📱';
}

function confirmOrderPayment() {
  hideOrderError();
  if (selectedPaymentMethod === 'wallet') payWithWallet();
  else                                   goToMpesaPayment();
}

async function payWithWallet() {
  if (!pendingOrderData) return;
  const totalText = document.getElementById('o-total').textContent || '0';
  const total = parseInt(totalText.replace(/KES\s?/, '').replace(/,/g, '')) || 0;

  if (currentBalance < total) {
    showOrderError('Insufficient wallet balance.');
    return;
  }

  const btn = document.getElementById('confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }

  try {
    const newBalance = currentBalance - total;
    const { error: walletErr } = await db.from('wallets').upsert([{
      user_id: currentUserId,
      balance: newBalance,
      updated_at: new Date().toISOString(),
    }]);

    if (walletErr) throw new Error(walletErr.message);

    await db.from('transactions').insert([{
      user_id: currentUserId,
      type: 'purchase',
      amount: total,
      description: 'Store purchase (Wallet)',
      status: 'success'
    }]);

    currentBalance = newBalance;
    const balancePill = document.querySelector('.balance-pill');
    if (balancePill) balancePill.textContent = 'KES ' + currentBalance;

    await completePaidOrder('WALLET', 'N/A');
    closeModal('order');
    window.location.href = 'index.html';

  } catch (err) {
    showOrderError(err.message || 'Payment failed.');
  } finally {
    if (btn) { btn.disabled = false; onPaymentMethodChange(selectedPaymentMethod); }
  }
}

function goToMpesaPayment() {
  const total = document.getElementById('o-total').textContent;
  document.getElementById('mpesa-amount').textContent     = total;
  document.getElementById('order-view').style.display     = 'none';
  document.getElementById('mpesa-view').style.display     = 'block';
  resetMpesaForm();
}

function backToOrder() {
  document.getElementById('order-view').style.display  = 'block';
  document.getElementById('mpesa-view').style.display  = 'none';
}

async function initiateMpesaPayment() {
  const phone = document.getElementById('mpesa-phone').value.trim();
  if (!phone || phone.length < 9) { showMpesaError('Invalid phone number'); return; }

  const btn = document.getElementById('mpesa-pay-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;"></div> Sending...';

  try {
    const amount = parseInt(document.getElementById('mpesa-amount').textContent.replace(/\D/g, '')) || 100;
    const res = await fetch(MPESA_API_URL + '/api/stkpush', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, amount, orderId: Date.now().toString() })
    });
    const data = await res.json();
    if (data.success) showMpesaWaiting(data.checkoutRequestId, phone);
    else throw new Error(data.error || 'STK Push failed');
  } catch (err) {
    showMpesaError(err.message);
    btn.disabled = false; btn.innerHTML = '📱 Send M-Pesa Prompt';
  }
}

function showMpesaWaiting(checkoutId, phone) {
  document.getElementById('mpesa-form-view').style.display = 'none';
  document.getElementById('mpesa-wait-view').style.display = 'block';

  let attempts = 0;
  const poll = setInterval(async () => {
    if (++attempts > 25) { clearInterval(poll); showMpesaPending(); return; }
    try {
      const res = await fetch(MPESA_API_URL + '/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutRequestId: checkoutId })
      });
      const data = await res.json();
      if (data.success && data.status === 'completed') {
        clearInterval(poll);
        await completePaidOrder(data.mpesaCode, phone);
        showMpesaSuccess(data.mpesaCode);
      } else if (!data.success && data.status === 'failed') {
        clearInterval(poll);
        showMpesaFailed(data.error);
      }
    } catch (e) { console.error(e); }
  }, 3000);
}

function showMpesaSuccess(code) {
  document.getElementById('mpesa-wait-view').style.display = 'none';
  document.getElementById('mpesa-success-view').style.display = 'block';
  document.getElementById('mpesa-receipt').textContent = code;
}

function showMpesaFailed(reason) {
  document.getElementById('mpesa-wait-view').style.display = 'none';
  document.getElementById('mpesa-failed-view').style.display = 'block';
  document.getElementById('mpesa-fail-reason').textContent = reason;
}

function showMpesaPending() {
  document.getElementById('mpesa-wait-view').style.display = 'none';
  document.getElementById('mpesa-pending-view').style.display = 'block';
}

function resetMpesaForm() {
  document.querySelectorAll('#mpesa-view > div').forEach(div => div.style.display = 'none');
  document.getElementById('mpesa-form-view').style.display = 'block';
  const btn = document.getElementById('mpesa-pay-btn');
  btn.disabled = false; btn.innerHTML = '📱 Send M-Pesa Prompt';
}

function showMpesaError(msg) {
  const el = document.getElementById('mpesa-error');
  el.textContent = msg; el.style.display = 'block';
}

function hideMpesaError() { document.getElementById('mpesa-error').style.display = 'none'; }

async function completePaidOrder(mpesaCode, mpesaPhone) {
  if (!pendingOrderData) return;
  const { type, id, days, expires } = pendingOrderData;
  const now = new Date().toISOString();

  try {
    if (type === 'proxy') {
      const listing = proxyListings.find(p => p.id === id);
      await db.from('proxies').insert([{
        user_id: currentUserId,
        host: listing.host,
        port: listing.port,
        country: listing.country,
        status: 'active',
        expires_at: expires,
        mpesa_code: mpesaCode,
        purchased_at: now,
        listing_id: id
      }]);

      const newCount = (listing.buyer_count || 0) + 1;
      await db.from('proxy_listings').update({
        buyer_count: newCount,
        available: newCount < (listing.max_buyers || 1)
      }).eq('id', id);

    } else {
      const listing = emailListings.find(e => e.id === id);
      await db.from('emails').insert([{
        user_id: currentUserId,
        email: listing.email,
        password: listing.password,
        mpesa_code: mpesaCode,
        purchased_at: now
      }]);
      await db.from('email_listings').update({ available: false }).eq('id', id);
    }
    loadListings();
  } catch (err) { console.error('Order Error:', err); }
}

function goToDashboard() { window.location.href = 'index.html'; }

function openModal(id) { document.getElementById('modal-' + id).classList.add('active'); }
function closeModal(id) { document.getElementById('modal-' + id).classList.remove('active'); }
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 3000);
}

initStore();
,
        status:         'active',
        expires_at:     expires,
        buyer_email:    currentUserEmail,
        mpesa_phone:    phone,
        mpesa_code:     mpesaCode || '',
        payment_status: 'success',
        purchased_at:   now,
        listing_id:     id,
      }]);

      if (insertErr) throw new Error(insertErr.message);

      // Increment buyer_count, remove from store if limit reached
      const newCount  = (listing.buyer_count || 0) + 1;
      const maxBuyers = listing.max_buyers  || 1;
      await db.from('proxy_listings').update({
        buyer_count: newCount,
        available:   newCount < maxBuyers,
      }).eq('id', id);

    } else {
      const listing = emailListings.find(e => e.id === id);
      await db.from('emails').insert([{
        user_id:      currentUserId,
        email:        listing.email,
        password:     listing.password || '',
        buyer_email:  currentUserEmail,
        mpesa_phone:  phone,
        mpesa_code:   mpesaCode || '',
        payment_status: 'success',
        purchased_at: now,
      }]);
      await db.from('email_listings').update({ available: false }).eq('id', id);
    }

    pendingOrderData = null;
    loadListings();

  } catch (err) {
    console.error('Order save error:', err);
  }
}

function goToDashboard() {
  closeModal('order');
  window.location.href = 'index.html';
}

initStore();