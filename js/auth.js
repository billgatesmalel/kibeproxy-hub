// ── AUTH PAGE LOGIC ───────────────────────────────────────────

// ── SHOW / HIDE PASSWORD ──────────────────────────────────────
function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  if (!input || !icon) return;

  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';

  // Swap eye icon
  icon.innerHTML = isHidden
    ? // eye-off (password visible)
      `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
       <line x1="1" y1="1" x2="23" y2="23"/>`
    : // eye (password hidden)
      `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
       <circle cx="12" cy="12" r="3"/>`;
}

// Redirect to dashboard if already logged in
db.auth.getSession().then(({ data }) => {
  if (data.session) window.location.href = 'index.html';
});

// ── TAB SWITCH ────────────────────────────────────────────────
function switchAuth(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('form-login').style.display  = tab === 'login'  ? 'block' : 'none';
  document.getElementById('form-signup').style.display = tab === 'signup' ? 'block' : 'none';
  hideAlert();
}

// ── ALERT ─────────────────────────────────────────────────────
function showAlert(msg, type = 'error') {
  const el = document.getElementById('alert');
  el.className = `alert ${type}`;
  el.innerHTML = `<span>${type === 'error' ? '✕' : '✓'}</span> ${msg}`;
}

function hideAlert() {
  document.getElementById('alert').className = 'alert';
}

// ── LOADING STATE ─────────────────────────────────────────────
function setLoading(btnId, loading, defaultText) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<div class="btn-spinner"></div> Please wait...'
    : defaultText;
}

// ── LOGIN ─────────────────────────────────────────────────────
async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) { showAlert('Please fill in all fields'); return; }

  setLoading('login-btn', true);
  const { error } = await db.auth.signInWithPassword({ email, password });
  setLoading('login-btn', false, 'Login to Dashboard');

  if (error) {
    showAlert(error.message);
  } else {
    // Check if user is banned
    const { data: { session } } = await db.auth.getSession();
    if (session) {
      const { data: ban } = await db.from('user_bans')
        .select('banned')
        .eq('user_id', session.user.id)
        .single();

      if (ban && ban.banned) {
        await db.auth.signOut();
        showAlert('🚫 Your account has been suspended. Contact support on WhatsApp: +254724031319');
        return;
      }
    }
    showAlert('Login successful! Redirecting...', 'success');

    // Redirect — browser sees filled autocomplete fields and prompts to save
    setTimeout(() => window.location.href = 'index.html', 800);
  }
}

// ── SIGNUP ────────────────────────────────────────────────────
async function handleSignup() {
  const name     = document.getElementById('signup-name').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm  = document.getElementById('signup-confirm').value;

  if (!name || !email || !password) { showAlert('Please fill in all fields'); return; }
  if (password.length < 6)          { showAlert('Password must be at least 6 characters'); return; }
  if (password !== confirm)          { showAlert('Passwords do not match'); return; }

  setLoading('signup-btn', true);
  const { error } = await db.auth.signUp({
    email, password,
    options: { data: { full_name: name } }
  });
  setLoading('signup-btn', false, 'Create Account');

  if (error) {
    showAlert(error.message);
  } else {
    showAlert('Account created! You can now login.', 'success');

    // Browser will offer to save password automatically due to autocomplete attributes
  }
}

// ── TRIGGER BROWSER SAVE PASSWORD PROMPT ────────────────────
// Uses autocomplete attributes — browser detects login and shows
// "Save password to Google?" automatically after redirect
function triggerSavePasswordPrompt(email, password, redirectTo) {
  // Just redirect — the browser sees the autocomplete="current-password"
  // fields that were filled and shows the save prompt on the next page
  if (redirectTo) {
    window.location.href = redirectTo;
  }
}

// ── ENTER KEY SUPPORT ─────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const loginVisible = document.getElementById('form-login').style.display !== 'none';
  if (loginVisible) handleLogin();
  else handleSignup();
});