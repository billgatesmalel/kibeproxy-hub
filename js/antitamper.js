// ── KIBEPROXY HUB ANTI-TAMPER PROTECTION ─────────────────────
// Admin page is fully excluded from all restrictions

(function() {
  'use strict';

  // ── ADMIN BYPASS — exit immediately on admin page ────────────
  if (window.location.pathname.includes('admin.html')) return;

  // ── CONFIG ───────────────────────────────────────────────────
  const VALID_PRICES   = [100, 200, 700, 1400, 3000, 25];
  const SUPPORT_WA     = 'https://wa.me/254724031319';
  const ALLOWED_ORIGIN = [
    '127.0.0.1', 'localhost',
    'kibeproxy-hub-app.vercel.app',
    'kibeproxy-hub', 'vercel.app'
  ];

  let warningShown = false;

  // ── ORIGIN CHECK ─────────────────────────────────────────────
  const currentHost = window.location.host;
  const isAllowed   = ALLOWED_ORIGIN.some(o => currentHost.includes(o));
  if (!isAllowed && currentHost !== '') {
    showTamperWarning('Unauthorized access location.'); return;
  }

  function showTamperWarning(reason) {
    if (warningShown) return;
    warningShown = true;
    const existing = document.getElementById('tamper-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'tamper-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.92);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;font-family:Syne,sans-serif;padding:1.5rem;';
    overlay.innerHTML = `<div style="background:#111;border:1px solid rgba(239,68,68,0.4);border-radius:20px;padding:2.5rem 2rem;max-width:420px;width:100%;text-align:center;"><div style="width:72px;height:72px;background:rgba(239,68,68,0.12);border:2px solid rgba(239,68,68,0.5);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;font-size:2rem;">🚫</div><div style="font-size:1.3rem;font-weight:800;color:#f0f0f0;margin-bottom:0.5rem;">Manipulation Detected</div><div style="font-size:0.82rem;color:#888;margin-bottom:1.5rem;line-height:1.7;">We detected an attempt to modify this page.<br>This activity has been flagged.<br><br><strong style="color:#ef4444;">${reason}</strong></div><div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:12px 16px;margin-bottom:1.5rem;font-size:0.78rem;color:#fca5a5;text-align:left;">⚠️ Attempting to manipulate prices or bypass payments is a violation of our <strong>Terms of Service</strong>.</div><div style="display:flex;gap:0.75rem;flex-direction:column;"><button onclick="window.location.reload()" style="width:100%;background:#22c55e;color:#000;border:none;border-radius:10px;padding:12px;font-family:Syne,sans-serif;font-size:0.9rem;font-weight:700;cursor:pointer;">🔄 Reload Page</button><a href="${SUPPORT_WA}" target="_blank" style="display:block;width:100%;background:transparent;border:1px solid #333;color:#888;border-radius:10px;padding:11px;font-family:Syne,sans-serif;font-size:0.82rem;font-weight:600;text-decoration:none;">Contact Support</a></div><div style="margin-top:1.25rem;font-size:0.7rem;color:#444;font-family:'DM Mono',monospace;">Error 403 · KibeProxy Hub Security</div></div>`;
    document.body.appendChild(overlay);
    document.querySelectorAll('button,input,select').forEach(el => { if (!el.closest('#tamper-overlay')) el.disabled = true; });
  }

  const IS_PROD = !window.location.host.includes('localhost') && !window.location.host.includes('127.0.0.1');
  let devToolsOpen = false;

  function checkDevTools() {
    if (!IS_PROD) return;
    const w = window.outerWidth - window.innerWidth > 160;
    const h = window.outerHeight - window.innerHeight > 160;
    if ((w || h) && !devToolsOpen) { devToolsOpen = true; showTamperWarning('Developer tools detected.'); }
    else if (!w && !h && devToolsOpen) { devToolsOpen = false; warningShown = false; const o = document.getElementById('tamper-overlay'); if (o) o.remove(); document.querySelectorAll('button,input,select').forEach(el => el.disabled = false); }
  }

  document.addEventListener('contextmenu', e => { if (IS_PROD) { e.preventDefault(); return false; } });
  document.addEventListener('keydown', e => {
    if (!IS_PROD) return;
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','i','J','j','C','c'].includes(e.key)) || (e.ctrlKey && ['U','u'].includes(e.key))) { e.preventDefault(); showTamperWarning('Keyboard shortcut blocked.'); return false; }
  });

  function checkPriceIntegrity() {
    document.querySelectorAll('.price-val,#o-total,#mpesa-amount').forEach(el => {
      const a = parseInt(el.textContent.replace(/[^0-9]/g,''));
      if (a && a < 10) showTamperWarning('Price manipulation detected.');
    });
  }

  const observer = new MutationObserver(m => { m.forEach(mut => { mut.addedNodes.forEach(n => { if (n.nodeName === 'SCRIPT' && n.src && !n.src.includes('supabase') && !n.src.includes('jsdelivr') && !n.src.includes('fonts') && !n.src.includes('cloudflare') && !n.src.includes('antitamper')) showTamperWarning('Unauthorized script injection detected.'); }); }); });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  setInterval(() => { checkDevTools(); checkPriceIntegrity(); }, 1500);
  window.addEventListener('load', () => { checkDevTools(); checkPriceIntegrity(); });

  if (IS_PROD) { const noop = () => {}; ['log','warn','error','info','debug'].forEach(k => window.console[k] = noop); }

})();