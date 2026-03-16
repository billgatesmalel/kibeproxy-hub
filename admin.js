// ── ADMIN PANEL LOGIC ─────────────────────────────────────────
let allUsers   = [];
let allProxies = [];
let allEmails  = [];

// ── AUTH + ADMIN GUARD ────────────────────────────────────────
async function initAdmin() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = 'auth.html'; return; }

  if (session.user.email !== ADMIN_EMAIL) {
    document.getElementById('access-denied').classList.add('show');
    return;
  }

  const name     = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  document.getElementById('admin-name').textContent     = name;
  document.getElementById('admin-initials').textContent = initials;
  document.getElementById('app').style.display          = 'block';

  loadAll();
}

// ── LOAD ALL DATA ─────────────────────────────────────────────
async function loadAll() {
  const [{ data: proxies }, { data: emails }] = await Promise.all([
    db.from('proxies').select('*').order('created_at', { ascending: false }),
    db.from('emails').select('*').order('created_at', { ascending: false })
  ]);

  allProxies = proxies || [];
  allEmails  = emails  || [];

  // Build user map from proxies + emails
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

  // Update stats
  document.getElementById('s-users').textContent   = allUsers.length;
  document.getElementById('s-active').textContent  = allProxies.filter(p => p.status === 'active').length;
  document.getElementById('s-expired').textContent = allProxies.filter(p => p.status === 'expired').length;
  document.getElementById('s-emails').textContent  = allEmails.length;

  renderUsers(allUsers);
  renderProxies(allProxies);
  renderEmails(allEmails);
  populateDropdowns();
}

// ── RENDER USERS ──────────────────────────────────────────────
function renderUsers(users) {
  const wrap = document.getElementById('users-wrap');
  if (!users.length) {
    wrap.innerHTML = `<table class="data-table"><tbody><tr><td class="empty-cell" colspan="5">No users found. Users appear once they have proxies or emails assigned.</td></tr></tbody></table>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>User ID</th><th>Proxies</th><th>Emails</th><th>Active</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(u => `
          <tr style="cursor:pointer;" onclick="toggleExpand('${u.id}')">
            <td class="mono">
              ${u.id.slice(0, 8)}…
              <span style="color:var(--text-muted);font-size:0.72rem;margin-left:4px;">${u.id.slice(-4)}</span>
            </td>
            <td class="mono">${u.proxies.length}</td>
            <td class="mono">${u.emails.length}</td>
            <td><span class="badge active">${u.proxies.filter(p => p.status === 'active').length} active</span></td>
            <td onclick="event.stopPropagation()">
              <button class="btn btn-outline btn-sm" onclick="openForUser('proxy','${u.id}')">+ Proxy</button>
              <button class="btn btn-outline btn-sm" style="margin-left:6px;" onclick="openForUser('email','${u.id}')">+ Email</button>
            </td>
          </tr>
          <tr id="expand-${u.id}" style="display:none;" class="expand-row">
            <td colspan="5">
              <div class="expand-inner">
                <div class="expand-tabs">
                  <button class="expand-tab active" onclick="switchExpandTab('${u.id}','proxies',this)">
                    Proxies (${u.proxies.length})
                  </button>
                  <button class="expand-tab" onclick="switchExpandTab('${u.id}','emails',this)">
                    Emails (${u.emails.length})
                  </button>
                </div>
                <div id="exp-p-${u.id}">
                  ${u.proxies.length === 0
                    ? '<p style="color:var(--text-muted);font-size:0.82rem;padding:0.5rem 0;">No proxies assigned yet.</p>'
                    : `<table class="mini-table">
                        <thead><tr><th>Host</th><th>Port</th><th>Username</th><th>Status</th><th>Expires</th><th></th></tr></thead>
                        <tbody>
                          ${u.proxies.map(p => `
                            <tr>
                              <td>${p.host || '—'}</td>
                              <td>${p.port || '—'}</td>
                              <td>${p.username || '—'}</td>
                              <td><span class="badge ${p.status}">${p.status}</span></td>
                              <td>${p.expires_at ? new Date(p.expires_at).toLocaleDateString() : '—'}</td>
                              <td><button class="btn btn-red btn-sm" onclick="deleteProxy('${p.id}')">Delete</button></td>
                            </tr>`).join('')}
                        </tbody>
                      </table>`}
                </div>
                <div id="exp-e-${u.id}" style="display:none;">
                  ${u.emails.length === 0
                    ? '<p style="color:var(--text-muted);font-size:0.82rem;padding:0.5rem 0;">No emails assigned yet.</p>'
                    : `<table class="mini-table">
                        <thead><tr><th>Email</th><th>Added</th><th></th></tr></thead>
                        <tbody>
                          ${u.emails.map(e => `
                            <tr>
                              <td>${e.email}</td>
                              <td>${new Date(e.created_at).toLocaleDateString()}</td>
                              <td><button class="btn btn-red btn-sm" onclick="deleteEmail('${e.id}')">Delete</button></td>
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

// ── RENDER PROXIES ────────────────────────────────────────────
function renderProxies(proxies) {
  const wrap = document.getElementById('proxies-wrap');
  if (!proxies.length) {
    wrap.innerHTML = `<table class="data-table"><tbody><tr><td class="empty-cell" colspan="6">No proxies found.</td></tr></tbody></table>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Host</th><th>Port</th><th>Username</th><th>Status</th><th>Expires</th><th>Action</th></tr>
      </thead>
      <tbody>
        ${proxies.map(p => `
          <tr>
            <td class="mono">${p.host || '—'}</td>
            <td class="mono">${p.port || '—'}</td>
            <td class="mono">${p.username || '—'}</td>
            <td><span class="badge ${p.status}">${p.status}</span></td>
            <td class="mono" style="font-size:0.75rem;color:var(--text-muted)">
              ${p.expires_at ? new Date(p.expires_at).toLocaleDateString() : '—'}
            </td>
            <td><button class="btn btn-red btn-sm" onclick="deleteProxy('${p.id}')">Delete</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── RENDER EMAILS ─────────────────────────────────────────────
function renderEmails(emails) {
  const wrap = document.getElementById('emails-wrap');
  if (!emails.length) {
    wrap.innerHTML = `<table class="data-table"><tbody><tr><td class="empty-cell" colspan="3">No emails found.</td></tr></tbody></table>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Email</th><th>Added</th><th>Action</th></tr>
      </thead>
      <tbody>
        ${emails.map(e => `
          <tr>
            <td class="mono">${e.email}</td>
            <td class="mono" style="font-size:0.75rem;color:var(--text-muted)">
              ${new Date(e.created_at).toLocaleDateString()}
            </td>
            <td><button class="btn btn-red btn-sm" onclick="deleteEmail('${e.id}')">Delete</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── POPULATE DROPDOWNS ────────────────────────────────────────
function populateDropdowns() {
  const opts = allUsers.length
    ? allUsers.map(u => `<option value="${u.id}">${u.id.slice(0,8)}… (${u.proxies.length}p / ${u.emails.length}e)</option>`).join('')
    : '<option value="">No users yet</option>';
  document.getElementById('ap-user').innerHTML = opts;
  document.getElementById('ae-user').innerHTML = opts;
}

// ── SECTION SWITCH ────────────────────────────────────────────
function showSection(name, btn) {
  ['users','proxies','emails'].forEach(s => {
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

// ── OPEN MODAL FOR SPECIFIC USER ──────────────────────────────
function openForUser(type, userId) {
  openModal(type);
  document.getElementById(type === 'proxy' ? 'ap-user' : 'ae-user').value = userId;
}

// ── ADD PROXY ─────────────────────────────────────────────────
async function adminAddProxy() {
  const user_id    = document.getElementById('ap-user').value;
  const host       = document.getElementById('ap-host').value.trim();
  const port       = parseInt(document.getElementById('ap-port').value);
  const username   = document.getElementById('ap-username').value.trim();
  const password   = document.getElementById('ap-password').value;
  const status     = document.getElementById('ap-status').value;
  const expires_at = document.getElementById('ap-expires').value || null;

  if (!host || !port) { showToast('Host and Port are required', 'error'); return; }

  const { error } = await db.from('proxies').insert([{ user_id, host, port, username, password, status, expires_at }]);
  if (error) { showToast('Failed: ' + error.message, 'error'); return; }

  closeModal('proxy');
  showToast('Proxy added successfully!');
  ['ap-host','ap-port','ap-username','ap-password','ap-expires'].forEach(id => document.getElementById(id).value = '');
  await loadAll();
}

// ── ADD EMAIL ─────────────────────────────────────────────────
async function adminAddEmail() {
  const user_id  = document.getElementById('ae-user').value;
  const email    = document.getElementById('ae-email').value.trim();
  const password = document.getElementById('ae-password').value;

  if (!email) { showToast('Email is required', 'error'); return; }

  const { error } = await db.from('emails').insert([{ user_id, email, password }]);
  if (error) { showToast('Failed: ' + error.message, 'error'); return; }

  closeModal('email');
  showToast('Email added successfully!');
  document.getElementById('ae-email').value    = '';
  document.getElementById('ae-password').value = '';
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
initAdmin();