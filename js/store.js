// ── STORE LOGIC ───────────────────────────────────────────────

const PRICE_PER_DAY = 100; // KES per day

const COUNTRIES = [
  {
    id: 'philippines',
    name: 'Philippines',
    flag: '🇵🇭',
    region: 'Southeast Asia',
    type: 'Residential',
    speed: 'Up to 100 Mbps',
    uptime: '99.5%',
    protocols: 'HTTP / SOCKS5',
  },
  {
    id: 'india',
    name: 'India',
    flag: '🇮🇳',
    region: 'South Asia',
    type: 'Residential',
    speed: 'Up to 50 Mbps',
    uptime: '99.2%',
    protocols: 'HTTP / SOCKS5',
  },
  {
    id: 'australia',
    name: 'Australia',
    flag: '🇦🇺',
    region: 'Oceania',
    type: 'Datacenter',
    speed: 'Up to 200 Mbps',
    uptime: '99.9%',
    protocols: 'HTTP / SOCKS5',
  },
  {
    id: 'canada',
    name: 'Canada',
    flag: '🇨🇦',
    region: 'North America',
    type: 'Datacenter',
    speed: 'Up to 200 Mbps',
    uptime: '99.9%',
    protocols: 'HTTP / SOCKS5',
  },
  {
    id: 'usa',
    name: 'United States',
    flag: '🇺🇸',
    region: 'North America',
    type: 'Residential',
    speed: 'Up to 150 Mbps',
    uptime: '99.8%',
    protocols: 'HTTP / SOCKS5',
  },
];

// Duration options in days
const DURATIONS = [
  { days: 1,  label: 'day' },
  { days: 7,  label: 'days' },
  { days: 14, label: 'days' },
  { days: 30, label: 'days' },
];

// Track selected duration per country
const selectedDays = {};
COUNTRIES.forEach(c => selectedDays[c.id] = 1);

let currentUserId = null;
let activeFilter  = 'all';

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

  renderCountries(COUNTRIES);
}

// ── FILTER ────────────────────────────────────────────────────
function filterCountry(id) {
  activeFilter = id;

  // Update filter buttons
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  event.target.closest('.filter-btn').classList.add('active');

  const filtered = id === 'all' ? COUNTRIES : COUNTRIES.filter(c => c.id === id);
  renderCountries(filtered);
}

// ── RENDER COUNTRY CARDS ──────────────────────────────────────
function renderCountries(list) {
  const grid = document.getElementById('country-grid');
  grid.innerHTML = list.map(c => `
    <div class="country-card" id="card-${c.id}">
      <div class="card-header">
        <div class="country-flag">${c.flag}</div>
        <div class="country-info">
          <div class="country-name">${c.name}</div>
          <div class="country-region">${c.region}</div>
        </div>
        <span class="availability-badge available">Available</span>
      </div>

      <div class="card-body">
        <div class="spec-row">
          <span class="spec-label">Proxy Type</span>
          <span class="spec-value">${c.type}</span>
        </div>
        <div class="spec-row">
          <span class="spec-label">Speed</span>
          <span class="spec-value">${c.speed}</span>
        </div>
        <div class="spec-row">
          <span class="spec-label">Uptime</span>
          <span class="spec-value green">${c.uptime}</span>
        </div>
        <div class="spec-row">
          <span class="spec-label">Protocols</span>
          <span class="spec-value">${c.protocols}</span>
        </div>
        <div class="spec-row">
          <span class="spec-label">Price</span>
          <span class="spec-value green">KES ${PRICE_PER_DAY} / day</span>
        </div>
      </div>

      <div class="duration-picker">
        <div class="duration-label">Select Duration</div>
        <div class="duration-options">
          ${DURATIONS.map(d => `
            <button
              class="duration-opt ${selectedDays[c.id] === d.days ? 'active' : ''}"
              onclick="selectDuration('${c.id}', ${d.days}, this)">
              <span class="days">${d.days}</span>
              <span class="label">${d.label}</span>
            </button>`).join('')}
        </div>

        <div class="price-display">
          <span class="price-label">Total Cost</span>
          <span class="price-amount" id="price-${c.id}">
            KES ${PRICE_PER_DAY * selectedDays[c.id]}
          </span>
        </div>

        <button class="buy-btn" onclick="openOrder('${c.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          Buy ${c.name} Proxy
        </button>
      </div>
    </div>`).join('');
}

// ── SELECT DURATION ───────────────────────────────────────────
function selectDuration(countryId, days, btn) {
  selectedDays[countryId] = days;

  // Update active button
  const card = document.getElementById(`card-${countryId}`);
  card.querySelectorAll('.duration-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Update price display
  document.getElementById(`price-${countryId}`).textContent =
    `KES ${PRICE_PER_DAY * days}`;
}

// ── OPEN ORDER MODAL ──────────────────────────────────────────
function openOrder(countryId) {
  const country  = COUNTRIES.find(c => c.id === countryId);
  const days     = selectedDays[countryId];
  const total    = PRICE_PER_DAY * days;
  const expires  = new Date(Date.now() + days * 86400000).toLocaleDateString();

  document.getElementById('order-flag').textContent    = country.flag;
  document.getElementById('order-country').textContent = country.name;
  document.getElementById('order-days').textContent    = `${days} day${days > 1 ? 's' : ''}`;
  document.getElementById('order-price').textContent   = `KES ${PRICE_PER_DAY}/day`;
  document.getElementById('order-expires').textContent = expires;
  document.getElementById('order-total').textContent   = `KES ${total}`;

  // Store for confirmation
  document.getElementById('confirm-btn').dataset.country  = countryId;
  document.getElementById('confirm-btn').dataset.days     = days;
  document.getElementById('confirm-btn').dataset.total    = total;
  document.getElementById('confirm-btn').dataset.expires  = new Date(Date.now() + days * 86400000).toISOString();
  document.getElementById('confirm-btn').dataset.name     = country.name;
  document.getElementById('confirm-btn').dataset.flag     = country.flag;

  // Reset to order view
  document.getElementById('order-view').style.display   = 'block';
  document.getElementById('success-view').style.display = 'none';

  openModal('order');
}

// ── CONFIRM ORDER ─────────────────────────────────────────────
async function confirmOrder() {
  const btn       = document.getElementById('confirm-btn');
  const countryId = btn.dataset.country;
  const days      = parseInt(btn.dataset.days);
  const expires   = btn.dataset.expires;
  const name      = btn.dataset.name;

  btn.disabled    = true;
  btn.innerHTML   = '<div class="spinner" style="border-top-color:#000;border-color:rgba(0,0,0,0.2)"></div> Processing...';

  // Create a placeholder proxy entry in the database
  const { error } = await db.from('proxies').insert([{
    user_id:    currentUserId,
    host:       `${countryId}.kibeproxy.net`,
    port:       8080,
    username:   'user_' + currentUserId.slice(0, 6),
    password:   Math.random().toString(36).slice(2, 10),
    status:     'active',
    expires_at: expires,
  }]);

  btn.disabled  = false;
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg> Confirm & Buy`;

  if (error) {
    showToast('Order failed: ' + error.message, 'error');
    return;
  }

  // Show success view
  document.getElementById('success-country').textContent = name;
  document.getElementById('success-days').textContent    = `${days} day${days > 1 ? 's' : ''}`;
  document.getElementById('order-view').style.display    = 'none';
  document.getElementById('success-view').style.display  = 'block';
}

// ── GO TO DASHBOARD ───────────────────────────────────────────
function goToDashboard() {
  closeModal('order');
  window.location.href = 'index.html';
}

// ── START ─────────────────────────────────────────────────────
initStore();