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

  // Admin badge
  if (currentUser.email === ADMIN_EMAIL) {
    document.getElementById('admin-link').style.display  = 'inline-flex';
    document.getElementById('badge-admin').style.display = 'inline-flex';
  }

  // Verified badge
  if (currentUser.email_confirmed_at) {
    document.getElementById('badge-verified').style.display = 'inline-flex';
  }

  // Hero
  document.getElementById('avatar-initials').textContent = initials;
  document.getElementById('hero-name').textContent        = name;
  document.getElementById('hero-email').textContent       = currentUser.email;
  document.getElementById('hero-joined').textContent      =
    'Member since ' + new Date(currentUser.created_at).toLocaleDateString('en-US',
      { year: 'numeric', month: 'long', day: 'numeric' });

  // Pre-fill form — name is read-only
  document.getElementById('display-name').value  = name;
  document.getElementById('user-email').value    = currentUser.email;
  document.getElementById('phone-number').value  = meta.phone || '';

  // Load username
  loadUsername();
  loadStats();
}

// ── LOAD USERNAME ─────────────────────────────────────────────
async function loadUsername() {
  const { data } = await db
    .from('usernames')
    .select('username')
    .eq('user_id', currentUser.id)
    .single();

  if (data) {
    document.getElementById('username-input').value      = data.username;
    document.getElementById('username-status').innerHTML =
      '<span style="color:var(--green);">✓ @' + data.username + '</span>';
  }
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

// ── CHECK USERNAME AVAILABILITY ───────────────────────────────
async function checkUsername() {
  const raw      = document.getElementById('username-input').value.trim().toLowerCase();
  const statusEl = document.getElementById('username-status');

  if (!raw) { statusEl.innerHTML = ''; return; }

  if (raw.length < 3) {
    statusEl.innerHTML = '<span style="color:var(--red);">At least 3 characters</span>';
    return;
  }

  if (!/^[a-z0-9_]+$/.test(raw)) {
    statusEl.innerHTML = '<span style="color:var(--red);">Only letters, numbers and underscores</span>';
    return;
  }

  statusEl.innerHTML = '<span style="color:var(--text-muted);">Checking...</span>';

  const { data } = await db
    .from('usernames')
    .select('user_id')
    .eq('username', raw)
    .single();

  if (data && data.user_id !== currentUser.id) {
    statusEl.innerHTML = '<span style="color:var(--red);">✕ @' + raw + ' is taken</span>';
  } else if (data && data.user_id === currentUser.id) {
    statusEl.innerHTML = '<span style="color:var(--green);">✓ This is your current username</span>';
  } else {
    statusEl.innerHTML = '<span style="color:var(--green);">✓ @' + raw + ' is available!</span>';
  }
}

// ── SAVE USERNAME ─────────────────────────────────────────────
async function saveUsername() {
  const raw = document.getElementById('username-input').value.trim().toLowerCase();

  if (!raw)          { showPA('alert-username', 'Please enter a username', 'error'); return; }
  if (raw.length < 3){ showPA('alert-username', 'Username must be at least 3 characters', 'error'); return; }
  if (!/^[a-z0-9_]+$/.test(raw)) {
    showPA('alert-username', 'Only letters, numbers and underscores allowed', 'error'); return;
  }

  // Check if taken by someone else
  const { data: existing } = await db
    .from('usernames')
    .select('user_id')
    .eq('username', raw)
    .single();

  if (existing && existing.user_id !== currentUser.id) {
    showPA('alert-username', '@' + raw + ' is already taken. Choose another.', 'error'); return;
  }

  const btn = document.getElementById('btn-save-username');
  btn.disabled  = true;
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-color:rgba(0,0,0,0.2);border-top-color:#000"></div> Saving...';

  const { error } = await db
    .from('usernames')
    .upsert([{ user_id: currentUser.id, username: raw, email: currentUser.email }], { onConflict: 'user_id' });

  btn.disabled  = false;
  btn.innerHTML = '✓ Save Username';

  if (error) {
    showPA('alert-username', error.message, 'error');
  } else {
    document.getElementById('username-status').innerHTML =
      '<span style="color:var(--green);">✓ @' + raw + ' saved!</span>';
    showPA('alert-username', 'Username @' + raw + ' saved! You can now login with it.', 'success');
    showToast('Username saved!');
  }
}

// ── SAVE CONTACT DETAILS (email + phone) ──────────────────────
async function saveContact() {
  const email = document.getElementById('user-email').value.trim();
  const phone = document.getElementById('phone-number').value.trim();

  if (!email) { showPA('alert-contact', 'Please enter an email address', 'error'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showPA('alert-contact', 'Please enter a valid email address', 'error'); return;
  }

  const btn = document.getElementById('btn-save-contact');
  btn.disabled  = true;
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-color:rgba(0,0,0,0.2);border-top-color:#000"></div> Saving...';

  // Update email + phone in Supabase auth
  const updates = { data: { phone } };
  if (email !== currentUser.email) updates.email = email;

  const { error } = await db.auth.updateUser(updates);

  btn.disabled  = false;
  btn.innerHTML = '✓ Save Changes';

  if (error) {
    showPA('alert-contact', error.message, 'error');
  } else {
    if (email !== currentUser.email) {
      showPA('alert-contact', 'Confirmation email sent to ' + email + '. Please verify it.', 'success');
    } else {
      showPA('alert-contact', 'Contact details updated!', 'success');
    }
    showToast('Details saved!');
    document.getElementById('hero-email').textContent = email;
  }
}

// ── CHANGE PASSWORD ───────────────────────────────────────────
async function changePassword() {
  const newPass = document.getElementById('new-password').value;
  const confirm = document.getElementById('confirm-password').value;

  if (!newPass)            { showPA('alert-pass', 'Please enter a new password', 'error'); return; }
  if (newPass.length < 6)  { showPA('alert-pass', 'Password must be at least 6 characters', 'error'); return; }
  if (newPass !== confirm)  { showPA('alert-pass', 'Passwords do not match', 'error'); return; }

  const btn = document.getElementById('btn-save-pass');
  btn.disabled  = true;
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-color:rgba(0,0,0,0.2);border-top-color:#000"></div> Updating...';

  const { error } = await db.auth.updateUser({ password: newPass });

  btn.disabled  = false;
  btn.innerHTML = '🔒 Update Password';

  if (error) {
    showPA('alert-pass', error.message, 'error');
  } else {
    document.getElementById('new-password').value     = '';
    document.getElementById('confirm-password').value = '';
    showPA('alert-pass', 'Password updated successfully!', 'success');
    showToast('Password changed!');
  }
}

// ── SHOW/HIDE PASSWORD ────────────────────────────────────────
function togglePV(inputId, btn) {
  const input    = document.getElementById(inputId);
  const isHidden = input.type === 'password';
  input.type     = isHidden ? 'text' : 'password';
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
  setTimeout(() => el.classList.remove('show'), 5000);
}

// ── EMAIL RENDER ──────────────────────────────────────────────
(function() {
  var e = 'kibetcreations2025' + '@' + 'outlook.com';
  document.querySelectorAll('.footer-email-placeholder').forEach(function(el) {
    el.textContent = e;
    el.href = 'mailto:' + e;
  });
})();

initProfile();