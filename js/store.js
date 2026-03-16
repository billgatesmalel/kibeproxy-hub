// ── STORE LOGIC ───────────────────────────────────────────────
let currentUserId = null;
let proxyListings = [];
let emailListings = [];
let activeTab     = 'proxies';

// Duration options
const DURATIONS = [
  { days: 1,  label: 'day'  },
  { days: 7,  label: 'days' },
  { days: 14, label: 'days' },
  { days: 30, label: 'days' },
];

const selectedDays = {};

// ── AUTH GUARD ────────────────────────────────────────────────
async function initStore() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = 'auth.html'; return; }

  currentUserId = session.user.id;
  const name     = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  document.getElementById('user-name').textContent     = name;
  document.getElementById('user-initials').textContent = initials;

  if (session.user.email === ADMIN_EMAIL) {
    document.getElementById('admin-link').style.display = 'inline-flex';
  }

  loadListings();
}

// ── LOAD LISTINGS ─────────────────────────────────────────────
async function loadListings() {
  const [{ data: proxies }, { data: emails }] = await Promise.all([
    db.from('proxy_listings').select('*').eq('available', true).order('created_at', { ascending: false }),
    db.from('email_listings').select('*').eq('available', true).order('created_at', { ascending: false })
  ]);

  proxyListings = proxies || [];
  emailListings = emails  || [];

  // Init selected days
  proxyListings.forEach(p => { if (!selectedDays[p.id]) selectedDays[p.id] = 1; });

  renderTab(activeTab);
}

// ── SWITCH TAB ────────────────────────────────────────────────
function switchStoreTab(tab, btn) {
  activeTab = tab;
  document.querySelectorAll('.store-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTab(tab);
}

// ── RENDER TAB ────────────────────────────────────────────────
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

  grid.innerHTML = proxyListings.map(p => `
    <div class="listing-card">
      <div class="card-header">
        <div class="country-flag">${p.flag || '🌍'}</div>
        <div class="country-info">
          <div class="country-name">${p.country}</div>
          <div class="country-sub">Residential Proxy</div>
        </div>
        <span class="avail-badge">● Available</span>
      </div>

      <div class="card-specs">
        <div class="spec-row">
          <span class="spec-label">Host</span>
          <span class="spec-val mono">${p.host}</span>
        </div>
        <div class="spec-row">
          <span class="spec-label">Port</span>
          <span class="spec-val mono">${p.port}</span>
        </div>
        <div class="spec-row">
          <span class="spec-label">Protocol</span>
          <span class="spec-val mono">HTTP / SOCKS5</span>
        </div>
        <div class="spec-row">
          <span class="spec-label">Price</span>
          <span class="spec-val green">KES ${p.price_per_day}/day</span>
        </div>
      </div>

      <div class="duration-section">
        <div class="dur-label">Select Duration</div>
        <div class="dur-options">
          ${DURATIONS.map(d => `
            <button class="dur-btn ${selectedDays[p.id] === d.days ? 'active' : ''}"
              onclick="selectDur('${p.id}', ${d.days}, this)">
              <span class="dur-days">${d.days}</span>
              <span class="dur-lbl">${d.label}</span>
            </button>`).join('')}
        </div>
        <div class="price-row">
          <span class="price-label">Total</span>
          <span class="price-val" id="price-${p.id}">KES ${p.price_per_day * (selectedDays[p.id] || 1)}</span>
        </div>
        <button class="buy-btn" onclick="openProxyOrder('${p.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          Buy Proxy
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
          <div class="country-name">${e.email}</div>
          <div class="country-sub">Premium Email Account</div>
        </div>
        <span class="avail-badge">● Available</span>
      </div>

      <div class="card-specs">
        <div class="spec-row">
          <span class="spec-label">Type</span>
          <span class="spec-val mono">Email Account</span>
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

// ── DURATION SELECT ───────────────────────────────────────────
function selectDur(id, days, btn) {
  selectedDays[id] = days;
  const card = btn.closest('.listing-card');
  card.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const listing = proxyListings.find(p => p.id === id);
  document.getElementById(`price-${id}`).textContent = `KES ${listing.price_per_day * days}`;
}

// ── OPEN PROXY ORDER ──────────────────────────────────────────
function openProxyOrder(id) {
  const listing = proxyListings.find(p => p.id === id);
  const days    = selectedDays[id] || 1;
  const total   = listing.price_per_day * days;
  const expires = new Date(Date.now() + days * 86400000).toLocaleDateString();

  document.getElementById('o-icon').textContent    = listing.flag || '🌍';
  document.getElementById('o-title').textContent   = `${listing.country} Proxy`;
  document.getElementById('o-host').textContent    = listing.host;
  document.getElementById('o-dur').textContent     = `${days} day${days > 1 ? 's' : ''}`;
  document.getElementById('o-price').textContent   = `KES ${listing.price_per_day}/day`;
  document.getElementById('o-expires').textContent = expires;
  document.getElementById('o-total').textContent   = `KES ${total}`;

  const btn = document.getElementById('confirm-btn');
  btn.dataset.type    = 'proxy';
  btn.dataset.id      = id;
  btn.dataset.days    = days;
  btn.dataset.expires = new Date(Date.now() + days * 86400000).toISOString();

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

  showOrderView();
  openModal('order');
}

function showOrderView() {
  document.getElementById('order-view').style.display   = 'block';
  document.getElementById('success-view').style.display = 'none';
}

// ── CONFIRM ORDER ─────────────────────────────────────────────
async function confirmOrder() {
  const btn  = document.getElementById('confirm-btn');
  const type = btn.dataset.type;
  const id   = btn.dataset.id;

  btn.disabled  = true;
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-color:rgba(0,0,0,0.2);border-top-color:#000"></div> Processing...';

  let error = null;

  if (type === 'proxy') {
    const listing = proxyListings.find(p => p.id === id);
    const days    = parseInt(btn.dataset.days);
    const expires = btn.dataset.expires;

    const res = await db.from('proxies').insert([{
      user_id:    currentUserId,
      country:    listing.country,
      host:       listing.host,
      port:       listing.port,
      username:   listing.username,
      password:   listing.password,
      status:     'active',
      expires_at: expires,
    }]);
    error = res.error;

    // Mark listing as unavailable
    if (!error) {
      await db.from('proxy_listings').update({ available: false }).eq('id', id);
    }

  } else {
    const listing = emailListings.find(e => e.id === id);

    const res = await db.from('emails').insert([{
      user_id:  currentUserId,
      email:    listing.email,
      password: listing.password,
    }]);
    error = res.error;

    if (!error) {
      await db.from('email_listings').update({ available: false }).eq('id', id);
    }
  }

  btn.disabled  = false;
  btn.innerHTML = '✓ Confirm & Buy';

  if (error) { showToast('Order failed: ' + error.message, 'error'); return; }

  document.getElementById('order-view').style.display   = 'none';
  document.getElementById('success-view').style.display = 'block';

  // Refresh listings
  loadListings();
}

function goToDashboard() {
  closeModal('order');
  window.location.href = 'index.html';
}

initStore();