// ── PROFILE PAGE LOGIC ────────────────────────────────────────
let currentUser = null;

async function initProfile() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = 'auth.html'; return; }

  currentUser = session.user;
  const meta     = currentUser.user_metadata || {};
  const name     = meta.full_name || currentUser.email.split('@')[0];
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Navbar
  document.getElementById('user-name').textContent     = name;
  document.getElementById('user-initials').textContent = initials;

  // Hero
  document.getElementById('avatar-initials').textContent = initials;
  document.getElementById('hero-name').textContent        = name;
  document.getElementById('hero-email').textContent       = currentUser.email;
  document.getElementById('hero-joined').textContent      =
    'Member since ' + new Date(currentUser.created_at).toLocaleDateString('en-US',
      { year: 'numeric', month: 'long', day: 'numeric' });

  // Admin badge
  if (currentUser.email === ADMIN_EMAIL) {
    document.getElementById('admin-link').style.display  = 'inline-flex';
    document.getElementById('badge-admin').style.display = 'inline-flex';
  }

  // Verified badge
  if (currentUser.email_confirmed_at) {
    document.getElementById('badge-verified').style.display = 'inline-flex';
  }

  // Pre-fill form
  document.getElementById('display-name').value  = name;
  document.getElementById('user-email').value    = currentUser.email;
  document.getElementById('phone-number').value  = meta.phone || '';

  loadStats();
}

// ── STATS ─────────────────────────────────────────────────────
async function loadStats() {
  const [{ data: proxies }, { data: emails }] = await Promise.all([
    db.from('proxies').select('id,status').eq('user_id', currentUser.id),
    db.from('emails').select('id').eq('user_id', currentUser.id),
  ]);

  const active = (proxies || []).filter(p => p.status === 'active').length;
  const total  = (proxies || []).length + (emails || []).length;

  document.getElementById('stat-proxies').textContent = active;
  document.getElementById('stat-emails').textContent  = (emails || []).length;
  document.getElementById('stat-total').textContent   = total;
}

// ── SAVE PROFILE ──────────────────────────────────────────────
async function saveProfile() {
  const name  = document.getElementById('display-name').value.trim();
  const phone = document.getElementById('phone-number').value.trim();

  if (!name) { showPA('alert-profile', 'Please enter your name', 'error'); return; }

  const btn = document.getElementById('btn-save-profile');
  btn.disabled  = true;
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-color:rgba(0,0,0,0.2);border-top-color:#000"></div> Saving...';

  const { error } = await db.auth.updateUser({ data: { full_name: name, phone } });

  btn.disabled  = false;
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Save Changes';

  if (error) {
    showPA('alert-profile', error.message, 'error');
  } else {
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('hero-name').textContent        = name;
    document.getElementById('avatar-initials').textContent  = initials;
    document.getElementById('user-name').textContent        = name;
    document.getElementById('user-initials').textContent    = initials;
    showPA('alert-profile', 'Profile updated successfully!', 'success');
    showToast('Profile updated!');
  }
}

// ── CHANGE PASSWORD ───────────────────────────────────────────
async function changePassword() {
  const newPass = document.getElementById('new-password').value;
  const confirm = document.getElementById('confirm-password').value;

  if (!newPass)           { showPA('alert-pass', 'Please enter a new password', 'error'); return; }
  if (newPass.length < 6) { showPA('alert-pass', 'Password must be at least 6 characters', 'error'); return; }
  if (newPass !== confirm) { showPA('alert-pass', 'Passwords do not match', 'error'); return; }

  const btn = document.getElementById('btn-save-pass');
  btn.disabled  = true;
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-color:rgba(0,0,0,0.2);border-top-color:#000"></div> Updating...';

  const { error } = await db.auth.updateUser({ password: newPass });

  btn.disabled  = false;
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Update Password';

  if (error) {
    showPA('alert-pass', error.message, 'error');
  } else {
    document.getElementById('new-password').value     = '';
    document.getElementById('confirm-password').value = '';
    showPA('alert-pass', 'Password updated successfully!', 'success');
    showToast('Password changed!');
  }
}

// ── LOGOUT ALL DEVICES ────────────────────────────────────────
async function logoutAll() {
  if (!confirm('Sign out of all devices? You will need to log in again.')) return;
  await db.auth.signOut({ scope: 'global' });
  window.location.href = 'auth.html';
}

// ── SHOW/HIDE PASSWORD ────────────────────────────────────────
function togglePV(inputId, btn) {
  const input    = document.getElementById(inputId);
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.innerHTML  = isHidden
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

// ── ALERT ─────────────────────────────────────────────────────
function showPA(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'palert ' + type + ' show';
  el.innerHTML = '<span>' + (type === 'success' ? '✓' : '✕') + '</span> ' + msg;
  setTimeout(() => el.classList.remove('show'), 4000);
}

// ── EMAIL RENDER (prevent Cloudflare encoding) ────────────────
(function() {
  var e = 'kibetcreations2025' + '@' + 'outlook.com';
  document.querySelectorAll('.footer-email-placeholder').forEach(function(el) {
    el.textContent = e;
    el.href = 'mailto:' + e;
  });
})();

initProfile();