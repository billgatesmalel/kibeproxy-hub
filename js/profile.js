// ── PROFILE PAGE LOGIC ────────────────────────────────────────
let currentUser = null;

async function initProfile() {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { window.location.href = 'auth.html'; return; }

    currentUser = session.user;
    const meta     = currentUser.user_metadata || {};
    const name     = meta.full_name || currentUser.email.split('@')[0];
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    
    AppCache.set('user_meta', { name, initials });

    // Update navbar/hero immediately via cache (common.js does this automatically on load, but we re-verify)
    document.getElementById('user-name').textContent     = name;
    document.getElementById('user-initials').textContent = initials;

    if (currentUser.email === ADMIN_EMAIL) {
      document.getElementById('admin-link').style.display  = 'inline-flex';
      document.getElementById('badge-admin').style.display = 'inline-flex';
    }

    if (currentUser.email_confirmed_at) {
      document.getElementById('badge-verified').style.display = 'inline-flex';
    }

    document.getElementById('avatar-initials').textContent = initials;
    document.getElementById('hero-name').textContent        = name;
    document.getElementById('hero-email').textContent       = currentUser.email;

    document.getElementById('display-name').value  = name;
    document.getElementById('user-email').value    = currentUser.email;
    document.getElementById('phone-number').value  = meta.phone || '';

    // Parallel load non-critical data
    loadUsername();
    loadStats();
  } catch (err) {
    console.error('Profile init error:', err);
  } finally {
    showPage();
  }
}

// ── LOAD USERNAME ─────────────────────────────────────────────
async function loadUsername() {
  const { data } = await db
    .from('usernames')
    .select('username')
    .eq('user_id', currentUser.id)
    .single();

  if (data) {
    document.getElementById('username-input').value = data.username;
  }
}

// ── STATS ─────────────────────────────────────────────────────
async function loadStats() {
  const [{ data: proxies }, { data: emails }, { data: txns }] = await Promise.all([
    db.from('proxies').select('id,status').eq('user_id', currentUser.id),
    db.from('emails').select('id').eq('user_id', currentUser.id),
    db.from('transactions').select('amount,type,status').eq('user_id', currentUser.id)
  ]);

  const active = (proxies || []).filter(p => p.status === 'active').length;
  const emailsCount = (emails || []).length;
  const totalPurchases = (proxies || []).length + emailsCount;

  document.getElementById('stat-proxies').textContent = active;
  document.getElementById('stat-emails').textContent  = emailsCount;
  document.getElementById('stat-total').textContent   = totalPurchases;

  // Referral Stats
  const refEarned = (txns || []).filter(t => t.type === 'bonus' && t.status === 'success').reduce((acc, t) => acc + t.amount, 0);
  document.getElementById('ref-earned').textContent = 'KES ' + refEarned;
  
  const refLink = window.location.origin + '/auth.html?ref=' + currentUser.id;
  document.getElementById('ref-link-input').value = refLink;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function copyReferralLink() {
  const input = document.getElementById('ref-link-input');
  input.select();
  document.execCommand('copy');
  showToast('Referral link copied! 🚀');
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