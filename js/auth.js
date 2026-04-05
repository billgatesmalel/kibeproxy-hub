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

// ── REFERRAL CAPTURE ──────────────────────────────────────────
let referralCode = new URLSearchParams(window.location.search).get('ref');
if (referralCode) localStorage.setItem('kibeproxy_ref', referralCode);
else referralCode = localStorage.getItem('kibeproxy_ref');

// Check if already logged in... done in init()

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

// ── LOGIN (supports email OR username) ────────────────────────
async function handleLogin() {
  let identifier = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!identifier || !password) { showAlert('Please fill in all fields'); return; }

  setLoading('login-btn', true);

  // If identifier starts with @ or has no @, treat as username
  let email = identifier;
  if (!identifier.includes('@')) {
    const username = identifier.replace(/^@/, '').toLowerCase();
    const { data: uRow } = await db
      .from('usernames')
      .select('user_id')
      .eq('username', username)
      .maybeSingle();

    if (!uRow) {
      setLoading('login-btn', false, 'Login to Dashboard');
      showAlert('No account found with username @' + username);
      return;
    }

    // Get email from auth using user_id via proxies/emails table
    // We store email in user metadata — use admin lookup via magic workaround:
    // Actually fetch email from usernames join: store email in usernames table
    const { data: emailRow } = await db
      .from('usernames')
      .select('email')
      .eq('username', username)
      .maybeSingle();

    if (emailRow && emailRow.email) {
      email = emailRow.email;
    } else {
      setLoading('login-btn', false, 'Login to Dashboard');
      showAlert('Username found but email not linked. Please login with your email instead.');
      return;
    }
  }

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
        .maybeSingle();

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
  const usernameEl = document.getElementById('signup-username');
  const emailEl    = document.getElementById('signup-email');
  const passwordEl = document.getElementById('signup-password');
  const confirmEl  = document.getElementById('signup-confirm');

  const name     = nameEl     ? nameEl.value.trim()         : '';
  const username = usernameEl ? usernameEl.value.trim().toLowerCase().replace(/^@/, '') : '';
  const email    = emailEl    ? emailEl.value.trim()        : '';
  const password = passwordEl ? passwordEl.value            : '';
  const confirm  = confirmEl  ? confirmEl.value             : '';

  if (!name)     { showAlert('Please enter your full name'); return; }
  if (!username) { showAlert('Please choose a username'); return; }
  if (username.length < 3) { showAlert('Username must be at least 3 characters'); return; }
  if (!email)    { showAlert('Please enter your email address'); return; }
  if (!password) { showAlert('Please enter a password'); return; }
  if (password.length < 6) { showAlert('Password must be at least 6 characters'); return; }
  if (confirm && password !== confirm) { showAlert('Passwords do not match'); return; }

  setLoading('signup-btn', true);

  // 1. Check if username exists
  const { data: existingUser } = await db.from('usernames').select('username').eq('username', username).maybeSingle();
  if (existingUser) {
    setLoading('signup-btn', false, 'Create Account');
    showAlert('Username @' + username + ' is already taken. Please choose another.');
    return;
  }
  
  const signupOptions = {
    email, password,
    options: { data: { full_name: name, username: username } }
  };

  if (referralCode) {
    signupOptions.options.data.referred_by = referralCode;
  }

  const { data, error } = await db.auth.signUp(signupOptions);

  if (error) {
    setLoading('signup-btn', false, 'Create Account');
    showAlert(error.message);
  } else {
    const user = data.user;
    if (user) {
      // 2. Save to usernames table
      await db.from('usernames').insert([{
        user_id: user.id,
        username: username,
        email: email
      }]);

      // 3. Create initial wallet if needed (Supabase trigger might do this, but being safe)
      await db.from('wallets').insert([{ user_id: user.id, balance: 0 }], { onConflict: 'user_id' });
    }

    setLoading('signup-btn', false, 'Create Account');
    
    let session = data.session;
    if (!session) {
      const { data: { session: s2 } } = await db.auth.getSession();
      session = s2;
    }

    if (session) {
      showAlert('Account created! Welcome to KibeProxy.', 'success');
      setTimeout(() => window.location.href = 'index.html', 1000);
    } else {
      showAlert('Account created! Sign in with your new credentials.', 'success');
      const { error: loginErr } = await db.auth.signInWithPassword({ email, password });
      if (!loginErr) {
        setTimeout(() => window.location.href = 'index.html', 800);
      } else {
        showAlert('Account created! Please check your email to verify.', 'success');
      }
    }
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

// ── INIT ──────────────────────────────────────────────────────
async function initAuth() {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
      // User is logged in - show logged-in UI
      const loggedInEl = document.getElementById('logged-in');
      const emailEl = document.getElementById('current-user-email');
      const tabsEl = document.querySelector('.auth-tabs');
      const loginEl = document.getElementById('form-login');
      const signupEl = document.getElementById('form-signup');

      if (loggedInEl) loggedInEl.style.display = 'block';
      if (emailEl) emailEl.textContent = session.user.email;
      if (tabsEl) tabsEl.style.display = 'none';
      if (loginEl) loginEl.style.display = 'none';
      if (signupEl) signupEl.style.display = 'none';

      // Auto-redirect to dashboard if coming from non-store page
      const params = new URLSearchParams(window.location.search);
      if (!params.get('next')) {
        setTimeout(() => window.location.href = 'index.html', 1500);
      }
    }
  } catch (err) {
    console.error('Auth init error:', err);
  } finally {
    showPage();
  }
}

initAuth();