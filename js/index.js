// ── DASHBOARD LOGIC ───────────────────────────────────────────
let currentUserId = null;

async function initAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = 'auth.html'; return; }

  const user     = session.user;
  currentUserId  = user.id;
  const name     = user.user_metadata?.full_name || user.email.split('@')[0];
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  document.getElementById('user-name').textContent     = name;
  document.getElementById('user-initials').textContent = initials;

  if (user.email === ADMIN_EMAIL) {
    document.getElementById('admin-link').style.display = 'inline-flex';
  }

  loadAll();
}

// ── TAB SWITCH ────────────────────────────────────────────────
function switchTab(btn, tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['active', 'expired', 'emails'].forEach(t => {
    document.getElementById('panel-' + t).style.display = t === tab ? 'block' : 'none';
  });
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
        <tr><th>Country</th><th>Host</th><th>Port</th><th>Username</th><th>Password</th><th>Status</th><th>Expires</th></tr>
      </thead>
      <tbody>
        ${data.map(p => `
          <tr>
            <td>${p.country || '—'}</td>
            <td class="mono">${p.host || '—'}</td>
            <td class="mono">${p.port || '—'}</td>
            <td class="mono">${p.username || '—'}</td>
            <td class="mono">
              <span class="pass-hidden" id="pass-${p.id}" data-pass="${(p.password||'').replace(/"/g,'&quot;')}">••••••••</span>
              <button class="show-btn" onclick="togglePass('pass-${p.id}')">Show</button>
            </td>
            <td><span class="badge ${p.status}">${p.status}</span></td>
            <td class="mono" style="font-size:0.78rem;color:var(--text-muted)">
              ${p.expires_at ? new Date(p.expires_at).toLocaleDateString() : '—'}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function togglePass(id) {
  const el = document.getElementById(id);
  if (!el) { console.warn('Element not found:', id); return; }
  const btn  = el.nextElementSibling;
  const pass = el.getAttribute('data-pass');
  if (el.textContent.includes('•')) {
    el.textContent  = (pass && pass.trim()) ? pass : '(empty)';
    btn.textContent = 'Hide';
  } else {
    el.textContent  = '••••••••';
    btn.textContent = 'Show';
  }
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
      <thead>
        <tr><th>Email</th><th>Password</th><th>Purchased</th></tr>
      </thead>
      <tbody>
        ${data.map(e => `
          <tr>
            <td class="mono">${e.email}</td>
            <td class="mono">
              <span class="pass-hidden" id="epass-${e.id}" data-pass="${(e.password||'').replace(/"/g,'&quot;')}">••••••••</span>
              <button class="show-btn" onclick="togglePass('epass-${e.id}')">Show</button>
            </td>
            <td class="mono" style="font-size:0.78rem;color:var(--text-muted)">
              ${new Date(e.created_at).toLocaleDateString()}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── LOAD ALL ──────────────────────────────────────────────────
async function loadAll() {
  const [{ data: proxies }, { data: emails }] = await Promise.all([
    db.from('proxies').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }),
    db.from('emails').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false })
  ]);

  const active    = (proxies || []).filter(p => p.status === 'active');
  const expired   = (proxies || []).filter(p => p.status === 'expired');
  const emailList = emails || [];

  document.getElementById('stat-active').textContent  = active.length;
  document.getElementById('stat-expired').textContent = expired.length;
  document.getElementById('stat-emails').textContent  = emailList.length;

  document.getElementById('badge-active').textContent  = active.length;
  document.getElementById('badge-expired').textContent = expired.length;
  document.getElementById('badge-emails').textContent  = emailList.length;

  renderProxies(active,  'panel-active',  'active');
  renderProxies(expired, 'panel-expired', 'expired');
  renderEmails(emailList);
}

initAuth();