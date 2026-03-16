// ── SUPABASE CONFIG ───────────────────────────────────────────
const { createClient } = supabase;

const db = createClient(
  'https://dyhzdtvnirqwhsfmrvjo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5aHpkdHZuaXJxd2hzZm1ydmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDYyMzEsImV4cCI6MjA4OTE4MjIzMX0.eJJ1Bau5V6qJoLt0qtEJXvZPnKGWG6hj6QLF2S2bpGE'
);

// ── ADMIN EMAIL ───────────────────────────────────────────────
const ADMIN_EMAIL = 'kibetian2005@gmail.com';

// ── SHARED TOAST ──────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.className = `toast ${type} show`;
  t.innerHTML = `<span style="color:${type === 'success' ? '#22c55e' : '#ef4444'}">${type === 'success' ? '✓' : '✕'}</span> ${msg}`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── SHARED MODAL ──────────────────────────────────────────────
function openModal(type)  { document.getElementById(`modal-${type}`).classList.add('open'); }
function closeModal(type) { document.getElementById(`modal-${type}`).classList.remove('open'); }

// Close modal on outside click
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target === el) el.classList.remove('open');
    });
  });
});

// ── SHARED LOGOUT ─────────────────────────────────────────────
async function handleLogout() {
  await db.auth.signOut();
  window.location.href = 'auth.html';
}