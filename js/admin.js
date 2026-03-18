// ── ADMIN LOGIC ───────────────────────────────────────────────
let allUsers      = [];
let allProxies    = [];
let allEmails     = [];
let proxyListings = [];
let emailListings = [];

// ── AUTH + ADMIN GUARD ────────────────────────────────────────
async function initAdmin() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = 'auth.html'; return; }

  // All logged-in users can access admin

  const name     = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('admin-name').textContent     = name;
  document.getElementById('admin-initials').textContent = initials;
  document.getElementById('app').style.display          = 'block';

  loadAll();
}

// ── PAYMENT STATUS BADGE ──────────────────────────────────────
function payBadge(status) {
  if (!status || status === 'success') {
    return '<span class="badge active">✓ Paid</span>';
  } else if (status === 'pending') {
    return '<span class="badge" style="background:rgba(234,179,8,0.1);color:#eab308;border:1px solid rgba(234,179,8,0.3);">⏳ Pending</span>';
  } else if (status === 'failed') {
    return '<span class="badge expired">✕ Failed</span>';
  }
  return '<span class="badge active">✓ Paid</span>';
}

// ── LOAD ALL ──────────────────────────────────────────────────
async function loadAll() {
  const [
    { data: proxies },
    { data: emails },
    { data: pListings },
    { data: eListings },
    { data: bans }
  ] = await Promise.all([
    db.from('proxies').select('*').order('purchased_at', { ascending: false }),
    db.from('emails').select('*').order('purchased_at', { ascending: false }),
    db.from('proxy_listings').select('*').order('created_at', { ascending: false }),
    db.from('email_listings').select('*').order('created_at', { ascending: false }),
    db.from('user_bans').select('*'),
  ]);

  // Build bans map
  window.bannedUsers = {};
  (bans || []).forEach(b => { if (b.banned) window.bannedUsers[b.user_id] = true; });

  allProxies    = proxies    || [];
  allEmails     = emails     || [];
  proxyListings = pListings  || [];
  emailListings = eListings  || [];

  // Build users map
  const userMap = {};
  allProxies.forEach(p => {
    if (!p.user_id) return;
    if (!userMap[p.user_id]) userMap[p.user_id] = { id: p.user_id, proxies: [], emails: [] };
    userMap[p.user_id].proxies.push(p);
  });
  allEmails.forEach(e => {
    if (!e.user_id) return;
    if (!userMap[e.user_id]) userMap[e.user_id] = { id: e.user_id, proxies: [], emails: [] };
    userMap[e.user_id].emails.push(e);
  });
  allUsers = Object.values(userMap);

  // Stats
  document.getElementById('s-users').textContent   = allUsers.length;
  document.getElementById('s-proxies').textContent = proxyListings.filter(p => p.available).length;
  document.getElementById('s-emails').textContent  = emailListings.filter(e => e.available).length;
  document.getElementById('s-sold').textContent    = allProxies.length + allEmails.length;

  renderUsers(allUsers);
  renderPurchases(allProxies, allEmails);
  renderProxyListings(proxyListings);
  renderEmailListings(emailListings);
  populateDropdowns();
}

// ── RENDER USERS ──────────────────────────────────────────────
function renderUsers(users) {
  const wrap = document.getElementById('users-wrap');
  if (!users.length) {
    wrap.innerHTML = `<table class="data-table"><tbody><tr><td class="empty-cell" colspan="4">No users have purchased anything yet.</td></tr></tbody></table>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>User ID</th><th>Proxies</th><th>Emails</th><th>Details</th></tr>
      </thead>
      <tbody>
        ${users.map(u => `
          <tr style="cursor:pointer;">
            <td class="mono" onclick="toggleExpand('${u.id}')">${u.id.slice(0,8)}…<span style="color:var(--text-muted);font-size:0.72rem;margin-left:4px;">${u.id.slice(-4)}</span></td>
            <td class="mono" onclick="toggleExpand('${u.id}')">${u.proxies.length}</td>
            <td class="mono" onclick="toggleExpand('${u.id}')">${u.emails.length}</td>
            <td onclick="toggleExpand('${u.id}')">
              <span class="badge active">${u.proxies.filter(p=>p.status==='active').length} active</span>
              ${window.bannedUsers && window.bannedUsers[u.id] ? '<span class="badge expired" style="margin-left:6px;">🚫 Banned</span>' : ''}
            </td>
            <td>
              ${window.bannedUsers && window.bannedUsers[u.id]
                ? `<button class="btn btn-green btn-sm" onclick="banUser('${u.id}', false)">✓ Unban</button>`
                : `<button class="btn btn-red btn-sm" onclick="banUser('${u.id}', true)">🚫 Ban</button>`}
            </td>
          </tr>
          <tr id="expand-${u.id}" style="display:none;" class="expand-row">
            <td colspan="4">
              <div class="expand-inner">
                <div class="expand-tabs">
                  <button class="expand-tab active" onclick="switchExpandTab('${u.id}','proxies',this)">Proxies (${u.proxies.length})</button>
                  <button class="expand-tab" onclick="switchExpandTab('${u.id}','emails',this)">Emails (${u.emails.length})</button>
                </div>

                <div id="exp-p-${u.id}">
                  ${u.proxies.length === 0
                    ? '<p style="color:var(--text-muted);font-size:0.82rem;">No proxies purchased.</p>'
                    : `<table class="mini-table">
                        <thead>
                          <tr>
                            <th>Buyer Email</th>
                            <th>M-Pesa Phone</th>
                            <th>M-Pesa Code</th>
                            <th>Payment</th>
                            <th>Country</th>
                            <th>Status</th>
                            <th>Purchased At</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          ${u.proxies.map(p => `
                            <tr>
                              <td style="color:var(--green)">${p.buyer_email || '—'}</td>
                              <td>${p.mpesa_phone || '—'}</td>
                              <td style="color:var(--yellow);font-weight:700">${p.mpesa_code || '—'}</td>
                              <td>${payBadge(p.payment_status)}</td>
                              <td>${p.country || '—'}</td>
                              <td><span class="badge ${p.status}">${p.status}</span></td>
                              <td style="color:var(--text-muted);font-size:0.72rem">${new Date(p.purchased_at || p.created_at).toLocaleString()}</td>
                              <td><button class="btn btn-red btn-sm" onclick="deleteUserProxy('${p.id}')">Remove</button></td>
                            </tr>`).join('')}
                        </tbody>
                      </table>`}
                </div>

                <div id="exp-e-${u.id}" style="display:none;">
                  ${u.emails.length === 0
                    ? '<p style="color:var(--text-muted);font-size:0.82rem;">No emails purchased.</p>'
                    : `<table class="mini-table">
                        <thead>
                          <tr>
                            <th>Buyer Email</th>
                            <th>M-Pesa Phone</th>
                            <th>M-Pesa Code</th>
                            <th>Payment</th>
                            <th>Email Account</th>
                            <th>Purchased At</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          ${u.emails.map(e => `
                            <tr>
                              <td style="color:var(--green)">${e.buyer_email || '—'}</td>
                              <td>${e.mpesa_phone || '—'}</td>
                              <td style="color:var(--yellow);font-weight:700">${e.mpesa_code || '—'}</td>
                              <td>${payBadge(e.payment_status)}</td>
                              <td>${e.email}</td>
                              <td style="color:var(--text-muted);font-size:0.72rem">${new Date(e.purchased_at || e.created_at).toLocaleString()}</td>
                              <td><button class="btn btn-red btn-sm" onclick="deleteUserEmail('${e.id}')">Remove</button></td>
                            </tr>`).join('')}
                        </tbody>
                      </table>`}
                </div>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── RENDER ALL PURCHASES ──────────────────────────────────────
function renderPurchases(proxies, emails) {
  const wrap = document.getElementById('purchases-wrap');
  if (!wrap) return;

  const all = [
    ...proxies.map(p => ({ ...p, _type: 'Proxy' })),
    ...emails.map(e => ({ ...e, _type: 'Email' }))
  ].sort((a, b) => new Date(b.purchased_at || b.created_at) - new Date(a.purchased_at || a.created_at));

  if (!all.length) {
    wrap.innerHTML = `<table class="data-table"><tbody><tr><td class="empty-cell" colspan="7">No purchases yet.</td></tr></tbody></table>`;
    return;
  }

  wrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Buyer Email</th>
          <th>Type</th>
          <th>Item</th>
          <th>M-Pesa Phone</th>
          <th>M-Pesa Code</th>
          <th>Payment</th>
          <th>Purchased At</th>
        </tr>
      </thead>
      <tbody>
        ${all.map(p => `
          <tr>
            <td style="color:var(--green);font-family:'DM Mono',monospace;font-size:0.8rem">${p.buyer_email || '—'}</td>
            <td>
              <span class="badge ${p._type === 'Proxy' ? 'active' : ''}"
                style="${p._type === 'Email' ? 'background:var(--yellow-glow);color:var(--yellow);border:1px solid rgba(234,179,8,0.3)' : ''}">
                ${p._type}
              </span>
            </td>
            <td class="mono">${p._type === 'Proxy' ? (p.country || p.host || '—') : (p.email || '—')}</td>
            <td class="mono">${p.mpesa_phone || '—'}</td>
            <td style="color:var(--yellow);font-family:'DM Mono',monospace;font-weight:700">${p.mpesa_code || '—'}</td>
            <td>${payBadge(p.payment_status)}</td>
            <td class="mono" style="font-size:0.75rem;color:var(--text-muted)">${new Date(p.purchased_at || p.created_at).toLocaleString()}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── RENDER PROXY LISTINGS ─────────────────────────────────────
function renderProxyListings(listings) {
  const wrap = document.getElementById('proxy-listings-wrap');
  if (!listings.length) {
    wrap.innerHTML = `<table class="data-table"><tbody><tr><td class="empty-cell" colspan="7">No proxy listings yet.</td></tr></tbody></table>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Country</th><th>Host</th><th>Port</th><th>Price/Day</th><th>Slots</th><th>Status</th><th>Added</th><th>Action</th></tr></thead>
      <tbody>
        ${listings.map(p => `
          <tr>
            <td>${p.flag || ''} ${p.country}</td>
            <td class="mono">${p.host}</td>
            <td class="mono">${p.port}</td>
            <td class="mono" style="color:var(--green)">KES ${p.price_per_day}</td>
            <td class="mono" style="color:${((p.max_buyers||1)-(p.buyer_count||0))<=1?'var(--red)':'var(--green)'}">
              ${p.buyer_count||0}/${p.max_buyers||1} sold
            </td>
            <td><span class="badge ${p.available ? 'active' : 'expired'}">${p.available ? 'Available' : 'Sold Out'}</span></td>
            <td class="mono" style="font-size:0.75rem;color:var(--text-muted)">${new Date(p.created_at).toLocaleDateString()}</td>
            <td>${p.available ? `<button class="btn btn-red btn-sm" onclick="removeProxyListing('${p.id}')">Remove</button>` : '<span style="color:var(--text-muted);font-size:0.78rem;">Sold</span>'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── RENDER EMAIL LISTINGS ─────────────────────────────────────
function renderEmailListings(listings) {
  const wrap = document.getElementById('email-listings-wrap');
  if (!listings.length) {
    wrap.innerHTML = `<table class="data-table"><tbody><tr><td class="empty-cell" colspan="5">No email listings yet.</td></tr></tbody></table>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Email</th><th>Price</th><th>Status</th><th>Added</th><th>Action</th></tr></thead>
      <tbody>
        ${listings.map(e => `
          <tr>
            <td class="mono">${e.email}</td>
            <td class="mono" style="color:var(--green)">KES ${e.price}</td>
            <td><span class="badge ${e.available ? 'active' : 'expired'}">${e.available ? 'Available' : 'Sold'}</span></td>
            <td class="mono" style="font-size:0.75rem;color:var(--text-muted)">${new Date(e.created_at).toLocaleDateString()}</td>
            <td>${e.available ? `<button class="btn btn-red btn-sm" onclick="removeEmailListing('${e.id}')">Remove</button>` : '<span style="color:var(--text-muted);font-size:0.78rem;">Sold</span>'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── POPULATE DROPDOWNS ────────────────────────────────────────
function populateDropdowns() {}

// ── SECTION SWITCH ────────────────────────────────────────────
function showSection(name, btn) {
  ['users', 'purchases', 'proxy-listings', 'email-listings'].forEach(s => {
    document.getElementById(`section-${s}`).style.display = s === name ? 'block' : 'none';
  });
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// ── EXPAND ROW ────────────────────────────────────────────────
function toggleExpand(userId) {
  const row = document.getElementById(`expand-${userId}`);
  row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}

function switchExpandTab(userId, tab, btn) {
  document.querySelectorAll(`#expand-${userId} .expand-tab`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`exp-p-${userId}`).style.display = tab === 'proxies' ? 'block' : 'none';
  document.getElementById(`exp-e-${userId}`).style.display = tab === 'emails'  ? 'block' : 'none';
}

// ── SEARCH ────────────────────────────────────────────────────
function filterUsers() {
  const q = document.getElementById('user-search').value.toLowerCase();
  renderUsers(allUsers.filter(u => u.id.toLowerCase().includes(q)));
}

// ── COUNTRY FLAG MAP ──────────────────────────────────────────
const countryFlagMap = {
  'philippines': '🇵🇭',
  'india': '🇮🇳',
  'australia': '🇦🇺',
  'canada': '🇨🇦',
  'usa': '🇺🇸',
  'united states': '🇺🇸',
  'new zealand': '🇳🇿',
  'uk': '🇬🇧',
  'united kingdom': '🇬🇧',
  'france': '🇫🇷',
  'germany': '🇩🇪',
  'japan': '🇯🇵',
  'china': '🇨🇳',
  'brazil': '🇧🇷',
  'mexico': '🇲🇽',
  'singapore': '🇸🇬',
  'south korea': '🇰🇷',
  'thailand': '🇹🇭',
  'vietnam': '🇻🇳',
  'indonesia': '🇮🇩',
  'malaysia': '🇲🇾',
  'south africa': '🇿🇦',
  'egypt': '🇪🇬',
  'nigeria': '🇳🇬',
  'kenya': '🇰🇪',
  'russia': '🇷🇺',
  'ukraine': '🇺🇦',
  'poland': '🇵🇱',
  'netherlands': '🇳🇱',
  'spain': '🇪🇸',
  'italy': '🇮🇹',
  'greece': '🇬🇷',
  'turkey': '🇹🇷',
  'israel': '🇮🇱',
  'uae': '🇦🇪',
  'united arab emirates': '🇦🇪',
  'saudi arabia': '🇸🇦',
  'pakistan': '🇵🇰',
  'bangladesh': '🇧🇩',
  'sri lanka': '🇱🇰',
  'hong kong': '🇭🇰',
  'taiwan': '🇹🇼',
  'philippines': '🇵🇭',
  'argentina': '🇦🇷',
  'chile': '🇨🇱',
  'colombia': '🇨🇴',
  'peru': '🇵🇪'
};

// ── AUTO-DETECT FLAG FROM COUNTRY ─────────────────────────────
function getCountryFlag(countryName) {
  if (!countryName) return '';
  const normalized = countryName.toLowerCase().trim();
  return countryFlagMap[normalized] || '';
}

// ── UPDATE FLAG WHEN COUNTRY SELECTED ─────────────────────────
function updateFlagFromCountry() {
  const country = document.getElementById('pl-country').value;
  const flag = getCountryFlag(country);
  document.getElementById('pl-flag').value = flag;
}

// ── ADD PROXY LISTING ─────────���───────────────────────────────
async function addProxyListing() {
  const country       = document.getElementById('pl-country').value.trim();
  let flag            = document.getElementById('pl-flag').value.trim();
  const host          = document.getElementById('pl-host').value.trim();
  const port          = parseInt(document.getElementById('pl-port').value);
  const username      = document.getElementById('pl-username').value.trim();
  const password      = document.getElementById('pl-password').value;
  const price_per_day = parseInt(document.getElementById('pl-price').value) || 100;
  const maxEl = document.getElementById('pl-max-buyers');
  const max_buyers = maxEl ? (parseInt(maxEl.value) || 1) : 1;

  if (!country || !host || !port) { showToast('Country, Host and Port are required', 'error'); return; }

  // Auto-detect flag if not provided
  if (!flag) {
    flag = getCountryFlag(country);
    if (flag) {
      document.getElementById('pl-flag').value = flag;
    }
  }

  const { error } = await db.from('proxy_listings').insert([{
    country, flag, host, port, username, password, price_per_day,
    max_buyers, buyer_count: 0, available: true
  }]);

  if (error) { showToast('Failed: ' + error.message, 'error'); return; }

  showToast('Proxy listing added! Users can now buy it.');
  ['pl-country','pl-flag','pl-host','pl-port','pl-username','pl-password'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pl-price').value = '100';
  await loadAll();
}

// ── ADD EMAIL LISTING ─────────────────────────────────────────
async function addEmailListing() {
  const email    = document.getElementById('el-email').value.trim();
  const password = document.getElementById('el-password').value;
  const price    = parseInt(document.getElementById('el-price').value) || 25;

  if (!email) { showToast('Email is required', 'error'); return; }

  const { error } = await db.from('email_listings').insert([{
    email, password, price, available: true
  }]);

  if (error) { showToast('Failed: ' + error.message, 'error'); return; }

  showToast('Email listing added! Users can now buy it.');
  document.getElementById('el-email').value    = '';
  document.getElementById('el-password').value = '';
  document.getElementById('el-price').value    = '25';
  await loadAll();
}

// ── REMOVE LISTINGS ───────────────────────────────────────────
async function removeProxyListing(id) {
  if (!confirm('Remove this proxy listing?')) return;
  await db.from('proxy_listings').delete().eq('id', id);
  showToast('Proxy listing removed');
  await loadAll();
}

async function removeEmailListing(id) {
  if (!confirm('Remove this email listing?')) return;
  await db.from('email_listings').delete().eq('id', id);
  showToast('Email listing removed');
  await loadAll();
}

// ── DELETE USER ITEMS ─────────────────────────────────────────
async function deleteUserProxy(id) {
  if (!confirm('Remove this proxy from user?')) return;
  await db.from('proxies').delete().eq('id', id);
  showToast('Proxy removed');
  await loadAll();
}

async function deleteUserEmail(id) {
  if (!confirm('Remove this email from user?')) return;
  await db.from('emails').delete().eq('id', id);
  showToast('Email removed');
  await loadAll();
}

// ── BAN / UNBAN USER ─────────────────────────────────────────
async function banUser(userId, ban) {
  const action = ban ? 'ban' : 'unban';
  if (!confirm('Are you sure you want to ' + action + ' this user?')) return;

  const { error } = await db
    .from('user_bans')
    .upsert([{ user_id: userId, banned: ban, updated_at: new Date().toISOString() }],
            { onConflict: 'user_id' });

  if (error) { showToast('Failed: ' + error.message, 'error'); return; }
  showToast('User ' + action + 'ned successfully.');
  await loadAll();
}

initAdmin();