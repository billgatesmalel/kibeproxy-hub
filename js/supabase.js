// ── SUPABASE CONFIG ───────────────────────────────────────────
const { createClient } = supabase;

const db = createClient(
  'https://dyhzdtvnirqwhsfmrvjo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5aHpkdHZuaXJxd2hzZm1ydmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDYyMzEsImV4cCI6MjA4OTE4MjIzMX0.eJJ1Bau5V6qJoLt0qtEJXvZPnKGWG6hj6QLF2S2bpGE'
);

const ADMIN_EMAIL = 'kibetian2005@gmail.com';

// ── TOAST ─────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.className = `toast ${type} show`;
  t.innerHTML = `<span style="color:${type === 'success' ? '#22c55e' : '#ef4444'}">${type === 'success' ? '✓' : '✕'}</span> ${msg}`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── MODAL ─────────────────────────────────────────────────────
function openModal(type) {
  const el = document.getElementById('modal-' + type);
  if (el) el.classList.add('open');
}

function closeModal(type) {
  const el = document.getElementById('modal-' + type);
  if (el) el.classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target === el) el.classList.remove('open');
    });
  });
});

// ── LOGOUT ────────────────────────────────────────────────────
async function handleLogout() {
  await db.auth.signOut();
  window.location.href = 'auth.html';
}

// ── SUPPORT DROPDOWN ──────────────────────────────────────────
function toggleSupport(e) {
  e.preventDefault();
  const menu = document.getElementById('support-menu');
  const other = document.getElementById('community-menu');
  if (other) other.classList.remove('open');
  if (menu) menu.classList.toggle('open');
}

function toggleCommunity(e) {
  e.preventDefault();
  const menu = document.getElementById('community-menu');
  const other = document.getElementById('support-menu');
  if (other) other.classList.remove('open');
  if (menu) menu.classList.toggle('open');
}

document.addEventListener('click', e => {
  const sm = document.getElementById('support-menu');
  const cm = document.getElementById('community-menu');
  if (sm && !e.target.closest('.support-dropdown') && !e.target.closest('.action-card')) sm.classList.remove('open');
  if (cm && !e.target.closest('.support-dropdown') && !e.target.closest('.action-card')) cm.classList.remove('open');
});