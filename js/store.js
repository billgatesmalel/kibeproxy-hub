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
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { window.location.href = 'auth.html'; return; }

    currentUserId    = session.user.id;
    currentUserEmail = session.user.email;

    const [walletRes] = await Promise.all([
      db.from('wallets').select('balance').eq('user_id', currentUserId).maybeSingle()
    ]);

    currentBalance = walletRes?.data?.balance || 0;
    updateGlobalBalance(currentBalance);

    const name     = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    
    AppCache.set('user_meta', { name, initials });

    document.getElementById('user-name').textContent     = name;
    document.getElementById('user-initials').textContent = initials;

    if (session.user.email === ADMIN_EMAIL) {
      const adminLink = document.getElementById('admin-link');
      if (adminLink) adminLink.style.display = 'inline-flex';
    }

    loadListings();
  } catch (err) {
    console.error('Store init error:', err);
  } finally {
    showPage();
  }
}

// ── LOAD LISTINGS ─────────────────────────────────────────────
async function loadListings() {
  const [{ data: proxies }, { data: emails }, { data: userProxies }] = await Promise.all([
    db.from('proxy_listings')
      .select('*')
      .eq('available', true)
      .order('created_at', { ascending: false }),
    db.from('email_listings')
      .select('*')
      .eq('available', true)
      .order('created_at', { ascending: false }),
    db.from('proxies').select('listing_id').eq('user_id', currentUserId).eq('status', 'active')
  ]);

  // Filter out proxies the user already owns
  const ownedListingIds = new Set((userProxies || []).map(p => p.listing_id));
  
  // Proxies expire after their duration_days since created_at
  const now = new Date();
  proxyListings = (proxies || []).filter(p => {
    if (ownedListingIds.has(p.id)) return false;
    const createdAt = new Date(p.created_at);
    const durationDays = p.duration_days || 1;
    const expiresAt = new Date(createdAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
    return now < expiresAt;
  });

  emailListings = emails || [];

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
  const unitPrice = listing.price_per_day;
  const expires = new Date(Date.now() + days * 86400000).toLocaleDateString();

  document.getElementById('o-icon').textContent    = listing.flag || '🌍';
  document.getElementById('o-title').textContent   = `${listing.country} ${days}-Day Proxy`;
  document.getElementById('o-price').textContent   = `KES ${unitPrice}`;
  document.getElementById('o-expires').textContent = expires;
  
  // Reset quantity selector
  const qtyInput = document.getElementById('o-qty');
  if (qtyInput) {
    qtyInput.value = 1;
    qtyInput.max = listing.max_buyers - (listing.buyer_count || 0);
  }
  
  const btn = document.getElementById('confirm-btn');
  btn.dataset.type    = 'proxy';
  btn.dataset.id      = listing.id;
  btn.dataset.days    = days;
  btn.dataset.expires = new Date(Date.now() + days * 86400000).toISOString();

  updateOrderQuantity(1);
  showOrderView();
  openModal('order');
}

function updateOrderQuantity(q) {
  const qty = parseInt(q) || 1;
  const listingId = pendingOrderData?.id || document.getElementById('confirm-btn').dataset.id;
  const listing = proxyListings.find(p => p.id === listingId);
  if (!listing) return;

  const unitPrice = listing.price_per_day;
  let subtotal = unitPrice * qty;
  let discount = 0;
  let discountRate = 0;

  if (qty >= 10)      discountRate = 0.10;
  else if (qty >= 5)  discountRate = 0.05;

  discount = Math.floor(subtotal * discountRate);
  const total = subtotal - discount;

  // Update UI
  document.getElementById('o-qty-display').textContent = qty;
  const discountRow = document.getElementById('o-discount-row');
  const discountTag = document.getElementById('o-discount-tag');
  
  if (discount > 0) {
    discountRow.style.display = 'flex';
    discountTag.style.display = 'block';
    discountTag.textContent = `🔥 ${discountRate * 100}% Bulk Discount!`;
    document.getElementById('o-discount-amt').textContent = `- KES ${discount}`;
  } else {
    discountRow.style.display = 'none';
    discountTag.style.display = 'none';
  }

  document.getElementById('o-total').textContent = `KES ${total}`;
  
  // Update pending data
  if (pendingOrderData) {
    pendingOrderData.qty = qty;
    pendingOrderData.total = total;
  } else {
    // Initial load from openProxyOrder
    pendingOrderData = { 
      type: 'proxy', 
      id: listing.id, 
      days: listing.duration_days || 1, 
      expires: new Date(Date.now() + (listing.duration_days || 1) * 86400000).toISOString(),
      qty, 
      total 
    };
  }
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

  if (methodEl) {
    methodEl.textContent = 'Choose payment method';
  }

  if (optionsEl) {
    const isInsufficient = currentBalance < total;
    optionsEl.innerHTML = `
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;">
        <input type="radio" name="payment_method" value="wallet" ${!isInsufficient ? 'checked' : ''} onchange="onPaymentMethodChange('wallet')" />
        <span>Use wallet balance (KES ${currentBalance}) ${isInsufficient ? '<span style="color:#ef4444;font-size:0.7rem;font-weight:700;margin-left:4px;">(Insufficient)</span>' : ''}</span>
      </label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="radio" name="payment_method" value="mpesa" ${isInsufficient ? 'checked' : ''} onchange="onPaymentMethodChange('mpesa')" />
        <span>Pay with M-Pesa</span>
      </label>
    `;
    selectedPaymentMethod = isInsufficient ? 'mpesa' : 'wallet';
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
    showOrderError('Insufficient wallet balance. Please pay with M-Pesa instead.');
    // Automatically switch to mpesa in the UI
    const mpesaRadio = document.querySelector('input[name="payment_method"][value="mpesa"]');
    if (mpesaRadio) {
      mpesaRadio.checked = true;
      onPaymentMethodChange('mpesa');
    }
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

async function handleReferralReward() {
  try {
    const { data: { user } } = await db.auth.getUser();
    const referredBy = user?.user_metadata?.referred_by;
    if (!referredBy) return;

    // Check if this is the user's first purchase
    const { count } = await db.from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUserId)
      .eq('status', 'success');

    if (count > 1) return; // Not the first successful one (current one + previous)
    // Actually, count will be 1 if this is the first success we just inserted.

    // Add KES 10 to referrer wallet
    const { data: wallet } = await db.from('wallets').select('balance').eq('user_id', referredBy).maybeSingle();
    const currentRefBalance = wallet?.balance || 0;
    const newRefBalance = currentRefBalance + 10;

    await db.from('wallets').upsert([{
      user_id: referredBy,
      balance: newRefBalance,
      updated_at: new Date().toISOString()
    }], { onConflict: 'user_id' });

    // Record referral transaction for referrer
    await db.from('transactions').insert([{
      user_id: referredBy,
      type: 'bonus',
      amount: 10,
      description: `Referral Bonus (from ${currentUserEmail})`,
      status: 'success',
      created_at: new Date().toISOString()
    }]);

    console.log('Referral bonus paid to:', referredBy);
  } catch (err) {
    console.error('Referral reward error:', err);
  }
}

async function completePaidOrder(mpesaCode, phone) {
  if (!pendingOrderData) return;
  const { type, id, days, expires, total, qty } = pendingOrderData;
  const now = new Date().toISOString();

  try {
    // Record transaction
    await db.from('transactions').insert([{
      user_id:      currentUserId,
      type:         'purchase',
      amount:       total,
      description:  `Store purchase (${type === 'proxy' ? 'Proxy x'+(qty||1) : 'Email'})`,
      mpesa_phone:  phone === 'N/A' ? null : phone,
      status:       'success',
      created_at:   now,
    }]);

    // Reward referrer if eligible
    await handleReferralReward();

    if (type === 'proxy') {
      const listing = proxyListings.find(p => p.id === id);
      const count = qty || 1;
      
      const insertRows = [];
      for (let i = 0; i < count; i++) {
        insertRows.push({
          user_id:        currentUserId,
          host:           listing.host,
          port:           listing.port,
          username:       listing.username || '',
          password:       listing.password || '',
          country:        listing.country,
          status:         'active',
          expires_at:     expires,
          buyer_email:    currentUserEmail,
          mpesa_phone:    phone,
          mpesa_code:     mpesaCode || '',
          payment_status: 'success',
          purchased_at:   now,
          listing_id:     id,
        });
      }

      const { error: insertErr } = await db.from('proxies').insert(insertRows);
      if (insertErr) throw new Error(insertErr.message);

      // Increment buyer_count, remove from store if limit reached
      const newCount  = (listing.buyer_count || 0) + count;
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
  window.location.href = 'index.html#active';
}

initStore();