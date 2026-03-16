// ── AUTH PAGE LOGIC ───────────────────────────────────────────

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
    showAlert('Login successful! Redirecting...', 'success');
    setTimeout(() => window.location.href = 'index.html', 1000);
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
  }
}

// ── ENTER KEY SUPPORT ─────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const loginVisible = document.getElementById('form-login').style.display !== 'none';
  if (loginVisible) handleLogin();
  else handleSignup();
});