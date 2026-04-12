// ── ADMIN LOGIC ───────────────────────────────────────────────
let allUsers      = [];
let allProxies    = [];
let allEmails     = [];
let proxyListings = [];
let emailListings = [];

// ── AUTH + ADMIN GUARD ────────────────────────────────────────
async function initAdmin() {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { window.location.href = 'auth.html'; return; }

    const name     = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('admin-name').textContent     = name;
    document.getElementById('admin-initials').textContent = initials;
    document.getElementById('app').style.display          = 'block';

    loadAll();
    loadFeedbackMgmt();
  } catch (err) {
    console.error('Admin init error:', err);
  } finally {
    showPage();
  }
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
  try {
    // Use map to handle potential missing tables gracefully
    const tables = [
      db.from('proxies').select('*').order('purchased_at', { ascending: false }),
      db.from('emails').select('*').order('purchased_at', { ascending: false }),
      db.from('proxy_listings').select('*').order('created_at', { ascending: false }),
      db.from('email_listings').select('*').order('created_at', { ascending: false }),
      db.from('user_bans').select('*'),
      db.from('transactions').select('*').eq('status', 'success'),
      db.from('feedbacks').select('id'),
      db.from('usernames').select('*'),
      db.from('wallets').select('*')
    ];

    const results = await Promise.all(tables.map(p => Promise.resolve(p).catch(e => {
        console.error("Table load error:", e);
        return { data: [], error: e };
    })));
    
    const proxies       = results[0].data || [];
    const emails        = results[1].data || [];
    const pListings     = results[2].data || [];
    const eListings     = results[3].data || [];
    const bans          = results[4].data || [];
    const txns          = results[5].data || [];
    const feedbacks     = results[6].data || [];
    const userProfiles  = results[7].data || [];
    const wallets       = results[8].data || [];

    // Build bans map
    window.bannedUsers = {};
    bans.forEach(b => { if (b.banned) window.bannedUsers[b.user_id] = true; });

    allProxies    = proxies;
    allEmails     = emails;
    proxyListings = pListings;
    emailListings = eListings;

    // Build users map
    const userMap = {};
    
    // 1. Start with known profiles (usernames table)
    userProfiles.forEach(u => {
      userMap[u.user_id] = { id: u.user_id, email: u.email, username: u.username, balance: 0, proxies: [], emails: [] };
    });

    // 1b. Add wallet balances
    wallets.forEach(w => {
      if (userMap[w.user_id]) userMap[w.user_id].balance = w.balance;
      else userMap[w.user_id] = { id: w.user_id, email: '—', username: '—', balance: w.balance, proxies: [], emails: [] };
    });

    // 2. Add proxies and emails, filling in missing user entries
    allProxies.forEach(p => {
      if (!p.user_id) return;
      if (!userMap[p.user_id]) userMap[p.user_id] = { id: p.user_id, email: p.buyer_email || '—', username: '—', balance: 0, proxies: [], emails: [] };
      userMap[p.user_id].proxies.push(p);
    });
    allEmails.forEach(e => {
      if (!e.user_id) return;
      if (!userMap[e.user_id]) userMap[e.user_id] = { id: e.user_id, email: e.buyer_email || '—', username: '—', balance: 0, proxies: [], emails: [] };
      userMap[e.user_id].emails.push(e);
    });
    
    allUsers = Object.values(userMap);

    // Stats
    const usersCount   = allUsers.length;
    const proxiesCount = proxyListings.filter(p => p.available).length;
    const emailsCount  = emailListings.filter(e => e.available).length;

    document.getElementById('s-users').textContent   = usersCount;
    document.getElementById('s-proxies').textContent = proxiesCount;
    document.getElementById('s-emails').textContent  = emailsCount;
    document.getElementById('s-sold').textContent    = allProxies.length + allEmails.length;

    renderUsers(allUsers);
    renderPurchases(allProxies, allEmails);
    renderProxyListings(proxyListings);
    renderEmailListings(emailListings);
    window.allTransactions = txns;
    updateChartTimeframe('7d'); 
    populateDropdowns();
  } catch (err) {
    console.error("loadAll Error:", err);
    showToast("Dashboard Error: " + err.message, "error");
    // Ensure spinners are removed even on error
    ['users-wrap', 'purchases-wrap', 'proxy-listings-wrap', 'email-listings-wrap'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.querySelector('.loading')) el.innerHTML = '<div class="error">Failed to load data.</div>';
    });
  }
}

// ── RENDER USERS ──────────────────────────────────────────────
function renderUsers(users) {
  const wrap = document.getElementById('users-wrap');
  if (!users.length) {
    wrap.innerHTML = `<table class="data-table"><tbody><tr><td class="empty-cell" colspan="7">No users found.</td></tr></tbody></table>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>User ID</th><th>Email</th><th>Username</th><th>Balance</th><th>Proxies</th><th>Emails</th><th>Status</th><th>Actions</th></tr>
      </thead>
      <tbody>
        ${users.map(u => `
          <tr style="cursor:pointer;">
            <td class="mono" onclick="toggleExpand('${u.id}')">${u.id.slice(0,8)}…</td>
            <td onclick="toggleExpand('${u.id}')" style="color:var(--green);font-size:0.85rem;">${u.email || '—'}</td>
            <td onclick="toggleExpand('${u.id}')" style="color:var(--yellow);font-weight:600;">@${u.username || '—'}</td>
            <td class="mono" onclick="toggleExpand('${u.id}')" style="color:var(--green);font-weight:700;">
              KES ${u.balance || 0}
              <button class="btn btn-sm" style="background:var(--border-light);color:var(--text-muted);margin-left:5px;padding:2px 6px;" onclick="event.stopPropagation(); editBalance('${u.id}', '${u.email || '—'}', ${u.balance || 0})" title="Edit Balance">✎</button>
            </td>
            <td class="mono" onclick="toggleExpand('${u.id}')">${u.proxies.length}</td>
            <td class="mono" onclick="toggleExpand('${u.id}')">${u.emails.length}</td>
            <td onclick="toggleExpand('${u.id}')">
              <span class="badge active">${u.proxies.filter(p=>p.status==='active').length} active</span>
              ${window.bannedUsers && window.bannedUsers[u.id] ? '<span class="badge expired" style="margin-left:6px;">🚫 Banned</span>' : ''}
            </td>
            <td>
              <div style="display:flex;gap:5px;">
                ${window.bannedUsers && window.bannedUsers[u.id]
                  ? `<button class="btn btn-green btn-sm" onclick="banUser('${u.id}', false)">✓ Unban</button>`
                  : `<button class="btn btn-red btn-sm" onclick="banUser('${u.id}', true)">🚫 Ban</button>`}
              </div>
            </td>
          </tr>
          <tr id="expand-${u.id}" style="display:none;" class="expand-row">
            <td colspan="7">
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
                               <td style="color:var(--text-muted);font-size:0.72rem;display:none;">${new Date(p.purchased_at || p.created_at).toLocaleString()}</td>
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
                            <th style="display:none;">Purchased At</th>
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
                               <td style="color:var(--text-muted);font-size:0.72rem;display:none;">${new Date(e.purchased_at || e.created_at).toLocaleString()}</td>
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
      <thead><tr><th>Country</th><th>Host</th><th>Duration</th><th>Price</th><th>Slots</th><th>Expires At</th><th>Status</th><th>Added</th><th>Action</th></tr></thead>
      <tbody>
        ${listings.map(p => {
          const createdAt = new Date(p.created_at);
          const durationDays = p.duration_days || 1;
          const expiresAt = new Date(createdAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
          const isExpired = new Date() > expiresAt;
          
          const statusText = isExpired ? 'Expired' : (p.available ? 'Available' : 'Sold Out');
          const statusClass = (isExpired || !p.available) ? 'expired' : 'active';
          
          return `
          <tr>
            <td>${p.flag || ''} ${p.country}</td>
            <td class="mono">${p.host}</td>
            <td class="mono" style="color:var(--yellow)">${p.duration_days || 1} Days</td>
            <td class="mono" style="color:var(--green)">KES ${p.price_per_day}</td>
            <td class="mono">${Math.max(0, (p.max_buyers || 1) - (p.buyer_count || 0))} / ${p.max_buyers || 1}</td>
            <td class="mono" style="font-size:0.75rem;">${expiresAt.toLocaleString()}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td class="mono" style="font-size:0.75rem;color:var(--text-muted)">${new Date(p.created_at).toLocaleDateString()}</td>
            <td><button class="btn btn-red btn-sm" onclick="removeProxyListing('${p.id}')">Remove</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

// ── RENDER REVENUE CHART ──────────────────────────────────────
function updateChartTimeframe(tf) {
  // Update UI
  document.querySelectorAll('.tf-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.toLowerCase() === tf.toLowerCase());
  });

  const now = new Date();
  let labels = [];
  let dataPoints = {};
  let title = "";
  let formatLabel = (d) => d.toLocaleDateString();

  if (tf === '1h') {
    title = "Earnings over the last 60 minutes";
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 5 * 60000);
      const key = d.getHours() + ":" + String(Math.floor(d.getMinutes() / 5) * 5).padStart(2, '0');
      labels.push(key);
      dataPoints[key] = 0;
    }
    formatLabel = (date) => date.getHours() + ":" + String(Math.floor(date.getMinutes() / 5) * 5).padStart(2, '0');
  } 
  else if (tf === '24h') {
    title = "Earnings over the last 24 hours";
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600000);
      const key = d.getHours() + ":00";
      labels.push(key);
      dataPoints[key] = 0;
    }
    formatLabel = (date) => date.getHours() + ":00";
  }
  else if (tf === '7d' || tf === '30d') {
    const days = tf === '7d' ? 7 : 30;
    title = `Earnings over the last ${days} days`;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      labels.push(key);
      dataPoints[key] = 0;
    }
    formatLabel = (date) => date.toISOString().split('T')[0];
  }
  else if (tf === '1y') {
    title = "Earnings over the last 12 months";
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0');
      labels.push(key);
      dataPoints[key] = 0;
    }
    formatLabel = (date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, '0');
  }

  document.getElementById('analytics-sub').textContent = title;

  // Process data
  (window.allTransactions || []).forEach(t => {
    const tDate = new Date(t.created_at);
    const key = formatLabel(tDate);
    if (dataPoints[key] !== undefined) {
      dataPoints[key] += t.amount;
    }
  });

  renderRevenueChart(labels, labels.map(l => dataPoints[l]), tf);
}

function renderRevenueChart(labels, chartData, tf) {
  const ctx = document.getElementById('revenueChart');
  if (!ctx) return;

  if (window.myChart) window.myChart.destroy();

  let displayLabels = labels;
  if (tf === '30d') {
    // Sparse labels for 30d to prevent crowding
    displayLabels = labels.map((l, i) => (i % 5 === 0 || i === labels.length - 1) ? l : '');
  }

  window.myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: displayLabels,
      datasets: [{
        label: 'Revenue (KES)',
        data: chartData,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#22c55e',
        pointRadius: tf === '30d' ? 2 : 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => labels[items[0].dataIndex] // Show original label in tooltip
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8', font: { size: 10 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 0 }
        }
      }
    }
  });
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
            <td><button class="btn btn-red btn-sm" onclick="removeEmailListing('${e.id}')">Remove</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── POPULATE DROPDOWNS ────────────────────────────────────────
function populateDropdowns() {}

// ── SECTION SWITCH ────────────────────────────────────────────
function showSection(name, btn) {
  const sections = ['users', 'purchases', 'proxy-listings', 'email-listings', 'feedback-mgmt', 'analytics'];
  sections.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    if (el) el.style.display = s === name ? 'block' : 'none';
  });

  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
  
  if (btn) {
    btn.classList.add('active');
  } else {
    // If no button passed (e.g. from stat card), find by onclick
    const targetBtn = Array.from(document.querySelectorAll('.sidebar-btn')).find(b => b.getAttribute('onclick').includes(`'${name}'`));
    if (targetBtn) targetBtn.classList.add('active');
  }
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
  const q = document.getElementById('user-search').value.toLowerCase().trim();
  renderUsers(allUsers.filter(u => 
    u.id.toLowerCase().includes(q) || 
    (u.email && u.email.toLowerCase().includes(q)) ||
    (u.username && u.username.toLowerCase().includes(q))
  ));
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

// ── ADD PROXY LISTING ─────────────────────────────────────────
async function addProxyListing() {
  const country       = document.getElementById('pl-country').value.trim();
  let flag            = document.getElementById('pl-flag').value.trim();
  const host          = document.getElementById('pl-host').value.trim();
  const port          = parseInt(document.getElementById('pl-port').value);
  const username      = document.getElementById('pl-username').value.trim();
  const password      = document.getElementById('pl-password').value;
  const price_per_day = parseInt(document.getElementById('pl-price').value) || 100;
  const duration_days = parseInt(document.getElementById('pl-duration').value) || 1;
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
    duration_days, max_buyers, buyer_count: 0, available: true
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

// ── FEEDBACK MANAGEMENT ───────────────────────────────────────
async function loadFeedbackMgmt() {
  const wrap = document.getElementById('feedback-wrap');
  if (!wrap) return;
  
  const { data, error } = await db.from('feedbacks').select('*').order('created_at', { ascending: false });

  if (error) { wrap.innerHTML = `<div class="error">${error.message}</div>`; return; }

  if (!data || !data.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);font-size:0.85rem;">No feedback yet.</div>';
    return;
  }

  wrap.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1.5rem;">
      ${data.map(f => `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.5rem;">
          <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;align-items:center;">
            <strong style="font-size:1.05rem;color:var(--green)">${f.user_name || 'Anonymous'}</strong>
            <span style="font-family:DM Mono,monospace;font-size:0.72rem;color:var(--text-muted);">${new Date(f.created_at).toLocaleString()}</span>
          </div>
          <div style="color:#eab308;margin-bottom:0.75rem;font-size:0.8rem;">${'★'.repeat(f.rating)}${'☆'.repeat(5-f.rating)}</div>
          <p style="color:var(--text-secondary);line-height:1.5;margin-bottom:1.25rem;font-size:0.9rem;">${f.content || '(No content)'}</p>
          
          <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border-light);border-radius:10px;padding:1.25rem;">
            <label class="form-label" style="font-size:0.65rem;color:var(--text-muted);margin-bottom:8px;display:block;">OFFICIAL REPLY</label>
            <textarea id="reply-${f.id}" class="form-input" style="height:70px;margin-bottom:1rem;resize:none;font-size:0.85rem;" placeholder="Write your reply...">${f.admin_reply || ''}</textarea>
            <div style="display:flex;justify-content:space-between;align-items:center;">
               <div style="display:flex;gap:10px;align-items:center;">
                 <span style="font-size:0.72rem;color:var(--text-muted);display:flex;align-items:center;gap:4px;">👍 ${f.helpful_count || 0}</span>
                 <span style="font-size:0.72rem;color:var(--text-muted);display:flex;align-items:center;gap:4px;">👎 ${f.not_helpful_count || 0}</span>
               </div>
               <button class="btn btn-green btn-sm" onclick="submitReply('${f.id}')" style="padding:6px 15px;">💾 Save Reply</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function submitReply(id) {
  const replyInput = document.getElementById('reply-' + id);
  const btn = event.target;
  const originalText = btn.textContent;
  
  const reply = replyInput.value.trim();
  
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const { error } = await db.from('feedbacks').update({ admin_reply: reply }).eq('id', id);

  btn.disabled = false;
  btn.textContent = originalText;

  if (error) { 
    showToast(error.message, 'error'); 
  } else {
    showToast('Reply saved successfully!');
    loadFeedbackMgmt();
  }
}


// ── BALANCE EDITING ───────────────────────────────────────────
let currentEditingUserId = null;

function editBalance(userId, email, balance) {
  currentEditingUserId = userId;
  document.getElementById('eb-email').value = email;
  document.getElementById('eb-current').value = balance;
  document.getElementById('eb-amount').value = balance;
  openModal('balance');
}

async function saveUserBalance() {
  const amount = parseFloat(document.getElementById('eb-amount').value);
  if (isNaN(amount)) { showToast('Invalid amount', 'error'); return; }

  const btn = document.getElementById('eb-save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const { error } = await db.from('wallets').upsert([{
      user_id: currentEditingUserId,
      balance: amount,
      updated_at: new Date().toISOString()
    }], { onConflict: 'user_id' });

    if (error) throw error;

    // Record transaction
    await db.from('transactions').insert([{
      user_id: currentEditingUserId,
      type: 'deposit',
      amount: amount,
      description: 'Admin balance adjustment',
      status: 'success',
      created_at: new Date().toISOString()
    }]);

    showToast('Balance updated successfully!');
    closeModal('balance');
    await loadAll();
  } catch (err) {
    showToast('Failed to update balance: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Balance';
  }
}

// ── SHOW TOAST ────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 3000);
}

initAdmin();