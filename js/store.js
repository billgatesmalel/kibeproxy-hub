// ── STORE LOGIC ───────────────────────────────────────────────
let currentUserId    = null;
let currentUserEmail = null;
let currentBalance   = 0;
let proxyListings    = [];
let emailListings    = [];
let activeTab        = 'proxies';
let pendingOrderData = null;
let selectedPaymentMethod = 'mpesa';

// Use live backend for STK Pushes as it contains the credentials
const MPESA_API_URL = 'https://kibeproxy-hub-app.vercel.app';

const PROXY_PLANS = [
  { days: 1,  label: 'Daily' },
  { days: 7,  label: '7 Days' },
  { days: 14, label: '14 Days' },
  { days: 30, label: 'Monthly' },
];

let currentDuration = 1;
const selectedPlans = {}; // Not used anymore in fixed mode

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
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: proxies }, { data: emails }, { data: userProxies }] = await Promise.all([
    db.from('proxy_listings')
      .select('*')
      .eq('available', true)
      .gt('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false }),
    db.from('email_listings')
      .select('*')
      .eq('available', true)
      .gt('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false }),
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
// ── SET DURATION ──────────────────────────────────────────────
function setStoreDuration(days, btn) {
  currentDuration = days;
  document.querySelectorAll('.dur-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderProxyListings();
}

// ── RENDER PROXY LISTINGS ─────────────────────────────────────
function renderProxyListings() {
  const grid = document.getElementById('store-grid');
  const filterWrap = document.getElementById('duration-filter-wrap');
  
  if (activeTab === 'proxies') filterWrap.style.display = 'block';
  else                         filterWrap.style.display = 'none';

  const filtered = proxyListings.filter(p => (p.duration_days || 1) === currentDuration);

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="store-empty">
        <p>No ${currentDuration}-day proxies available right now.</p>
        <p style="color:var(--text-muted);font-size:0.82rem;margin-top:0.5rem;">Try a different duration or check back soon.</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div class="listing-card">
      <div class="card-header">
        <div class="country-flag">${p.flag || '🌍'}</div>
        <div class="country-info">
          <div class="country-name">${p.country} Proxy</div>
          <div class="country-sub">${currentDuration === 1 ? 'Daily Offer' : currentDuration + ' Days Plan'}</div>
        </div>
        <span class="avail-badge">● Available</span>
      </div>
      <div class="card-specs">
        <div class="spec-row">
          <span class="spec-label">Duration</span>
          <span class="spec-val">${currentDuration} Day${currentDuration > 1 ? 's' : ''}</span>
        </div>
        <div class="spec-row">
          <span class="spec-label">Host</span>
          <span class="spec-val mono locked">🔒 Hidden</span>
        </div>
      </div>
      <div class="duration-section">
        <div class="price-row">
          <span class="price-label">Total Price</span>
          <span class="price-val">KES ${p.price_per_day}</span>
        </div>
        <button class="buy-btn" onclick="openProxyOrder('${p.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          Buy Now
        </button>
      </div>
    </div>`).join('');
}

// ── RENDER EMAIL LISTINGS ─────────────────────────────────────
function renderEmailListings() {
  const grid = document.getElementById('store-grid');
  if (!emailListings.length) {
    grid.innerHTML = `
      <div class="store-empty">
        <p>No emails available right now.</p>
        <p style="color:var(--text-muted);font-size:0.82rem;margin-top:0.5rem;">Check back soon or contact support.</p>
      </div>`;
    return;
  }

  grid.innerHTML = emailListings.map(e => `
    <div class="listing-card email-card">
      <div class="card-header">
        <div class="country-flag">✉️</div>
        <div class="country-info">
          <div class="country-name">Email Account</div>
          <div class="country-sub">Premium Email</div>
        </div>
        <span class="avail-badge">● Available</span>
      </div>
      <div class="card-specs">
        <div class="spec-row">
          <span class="spec-label">Email</span>
          <span class="spec-val mono locked">🔒 Hidden until purchased</span>
        </div>
        <div class="spec-row">
          <span class="spec-label">Access</span>
          <span class="spec-val mono">Full Access</span>
        </div>
        <div class="spec-row">
          <span class="spec-label">Price</span>
          <span class="spec-val green">KES ${e.price} one-time</span>
        </div>
      </div>
      <div class="duration-section">
        <div class="price-row">
          <span class="price-label">Total</span>
          <span class="price-val">KES ${e.price}</span>
        </div>
        <button class="buy-btn" onclick="openEmailOrder('${e.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          Buy Email
        </button>
      </div>
    </div>`).join('');
}

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
function openProxyOrder(id) {
  const listing = proxyListings.find(p => p.id === id);
  if (!listing) return;

  const days    = listing.duration_days || 1;
  const total   = listing.price_per_day;
  const expires = new Date(Date.now() + days * 86400000).toLocaleDateString();

  document.getElementById('o-icon').textContent    = listing.flag || '🌍';
  document.getElementById('o-title').textContent   = `${listing.country} ${days}-Day Proxy`;
  document.getElementById('o-host').textContent    = listing.host;
  document.getElementById('o-dur').textContent     = `${days} Days`;
  document.getElementById('o-price').textContent   = `KES ${total}`;
  document.getElementById('o-expires').textContent = expires;
  document.getElementById('o-total').textContent   = `KES ${total}`;

  const btn = document.getElementById('confirm-btn');
  btn.dataset.type    = 'proxy';
  btn.dataset.id      = listing.id;
  btn.dataset.days    = days;
  btn.dataset.expires = new Date(Date.now() + days * 86400000).toISOString();

  pendingOrderData = { type: 'proxy', id: listing.id, days, expires: btn.dataset.expires, total };

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

  pendingOrderData = { type: 'email', id, total: listing.price };

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
  const total = pendingOrderData?.total || 0;
  const methodEl = document.getElementById('o-payment-method');
  const optionsEl = document.getElementById('o-payment-options');
  selectedPaymentMethod = 'mpesa'; // Default to mpesa

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
  const total = pendingOrderData.total;

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
    }], { onConflict: 'user_id' });

    if (walletErr) throw new Error(walletErr.message);

    await db.from('transactions').insert([{
      user_id: currentUserId,
      type: 'purchase',
      amount: total,
      description: 'Store purchase using wallet',
      mpesa_phone: null,
      status: 'success',
      created_at: new Date().toISOString(),
    }]);

    currentBalance = newBalance;
    const balancePill = document.querySelector('.balance-pill');
    if (balancePill) balancePill.textContent = 'KES ' + currentBalance;

    await completePaidOrder('WALLET', 'N/A');
    closeModal('order');
    window.location.href = 'index.html';

  } catch (err) {
    showOrderError(err.message || 'Wallet payment failed.');
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
    const amount = pendingOrderData.total;
    const orderId = 'ORD' + Date.now().toString().slice(-9);
    const res = await fetch(MPESA_API_URL + '/api/stkpush', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, amount, orderId, description: 'Store Purchase' })
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
  document.getElementById('mpesa-form-view').style.display = 'none';
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

async function completePaidOrder(mpesaCode, phone) {
  if (!pendingOrderData) return;
  const { type, id, days, expires, total } = pendingOrderData;
  const now = new Date().toISOString();

  try {
    // Record transaction
    await db.from('transactions').insert([{
      user_id:      currentUserId,
      type:         'purchase',
      amount:       total,
      description:  `Store purchase (${type === 'proxy' ? 'Proxy' : 'Email'})`,
      mpesa_phone:  phone === 'N/A' ? null : phone,
      status:       'success',
      created_at:   now,
    }]);

    if (type === 'proxy') {
      const listing = proxyListings.find(p => p.id === id);
      const { error: insertErr } = await db.from('proxies').insert([{
        user_id:        currentUserId,
        host:           listing.host,
        port:           listing.port,
        country:        listing.country,
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