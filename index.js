// ── DASHBOARD LOGIC ───────────────────────────────────────────
let currentUserId = null;

// ── AUTH GUARD ────────────────────────────────────────────────
async function initAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = 'auth.html'; return; }

  const user     = session.user;
  currentUserId  = user.id;
  const name     = user.user_metadata?.full_name || user.email.split('@')[0];
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  document.getElementById('user-name').textContent     = name;
  document.getElementById('user-initials').textContent = initials;

  // Show ADMIN badge only for admin user
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

  const addBtn = document.getElementById('add-btn');
  if (tab === 'emails') {
    addBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg> Add Email`;
    addBtn.onclick = () => openModal('email');
  } else {
    addBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg> Add Proxy`;
    addBtn.onclick = () => openModal('proxy');
  }
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
        <p class="empty-sub">${status === 'active' ? 'Add a proxy to get started' : 'Expired proxies will appear here'}</p>
      </div>`;
    return;
  }
  panel.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Host</th><th>Port</th><th>Username</th>
          <th>Status</th><th>Expires</th><th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(p => `
          <tr>
            <td class="mono">${p.host || '—'}</td>
            <td class="mono">${p.port || '—'}</td>
            <td class="mono">${p.username || '—'}</td>
            <td><span class="badge ${p.status}">${p.status}</span></td>
            <td class="mono" style="font-size:0.78rem;color:var(--text-muted)">
              ${p.expires_at ? new Date(p.expires_at).toLocaleDateString() : '—'}
            </td>
            <td><button class="delete-btn" onclick="deleteProxy('${p.id}')">Delete</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
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
        <p class="empty-sub">Add an email to get started</p>
      </div>`;
    return;
  }
  panel.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Email</th><th>Added</th><th>Action</th></tr>
      </thead>
      <tbody>
        ${data.map(e => `
          <tr>
            <td class="mono">${e.email}</td>
            <td class="mono" style="font-size:0.78rem;color:var(--text-muted)">
              ${new Date(e.created_at).toLocaleDateString()}
            </td>
            <td><button class="delete-btn" onclick="deleteEmail('${e.id}')">Delete</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── LOAD ALL DATA ─────────────────────────────────────────────
async function loadAll() {
  const [{ data: proxies }, { data: emails }] = await Promise.all([
    db.from('proxies').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }),
    db.from('emails').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false })
  ]);

  const active    = (proxies || []).filter(p => p.status === 'active');
  const expired   = (proxies || []).filter(p => p.status === 'expired');
  const emailList = emails || [];

  // Update stats
  document.getElementById('stat-active').textContent  = active.length;
  document.getElementById('stat-expired').textContent = expired.length;
  document.getElementById('stat-emails').textContent  = emailList.length;

  // Update tab badges
  document.getElementById('badge-active').textContent  = active.length;
  document.getElementById('badge-expired').textContent = expired.length;
  document.getElementById('badge-emails').textContent  = emailList.length;

  // Render panels
  renderProxies(active,  'panel-active',  'active');
  renderProxies(expired, 'panel-expired', 'expired');
  renderEmails(emailList);
}

// ── ADD PROXY ─────────────────────────────────────────────────
async function addProxy() {
  const host       = document.getElementById('p-host').value.trim();
  const port       = parseInt(document.getElementById('p-port').value);
  const username   = document.getElementById('p-user').value.trim();
  const password   = document.getElementById('p-pass').value;
  const status     = document.getElementById('p-status').value;
  const expires_at = document.getElementById('p-expires').value || null;

  if (!host || !port) { showToast('Host and Port are required', 'error'); return; }

  const { error } = await db.from('proxies').insert([{
    user_id: currentUserId, host, port, username, password, status, expires_at
  }]);

  if (error) { showToast('Failed: ' + error.message, 'error'); return; }

  closeModal('proxy');
  showToast('Proxy added successfully!');
  ['p-host','p-port','p-user','p-pass','p-expires'].forEach(id => document.getElementById(id).value = '');
  await loadAll();
}

// ── ADD EMAIL ─────────────────────────────────────────────────
async function addEmail() {
  const email    = document.getElementById('e-email').value.trim();
  const password = document.getElementById('e-pass').value;

  if (!email) { showToast('Email is required', 'error'); return; }

  const { error } = await db.from('emails').insert([{
    user_id: currentUserId, email, password
  }]);

  if (error) { showToast('Failed: ' + error.message, 'error'); return; }

  closeModal('email');
  showToast('Email added successfully!');
  document.getElementById('e-email').value = '';
  document.getElementById('e-pass').value  = '';
  await loadAll();
}

// ── DELETE PROXY ──────────────────────────────────────────────
async function deleteProxy(id) {
  if (!confirm('Delete this proxy?')) return;
  const { error } = await db.from('proxies').delete().eq('id', id);
  if (error) { showToast('Delete failed', 'error'); return; }
  showToast('Proxy deleted');
  await loadAll();
}

// ── DELETE EMAIL ──────────────────────────────────────────────
async function deleteEmail(id) {
  if (!confirm('Delete this email?')) return;
  const { error } = await db.from('emails').delete().eq('id', id);
  if (error) { showToast('Delete failed', 'error'); return; }
  showToast('Email deleted');
  await loadAll();
}

// ── START ─────────────────────────────────────────────────────
initAuth();