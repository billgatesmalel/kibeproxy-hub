// ── KIBEPROXY HUB ANTI-TAMPER PROTECTION ─────────────────────
// Detects DevTools, code injection, price manipulation & more

(function() {
  'use strict';

  // ── CONFIG ──────────────────────────────────────────────────
  const VALID_PRICES   = [100, 200, 700, 1400, 3000, 25]; // KES - valid amounts
  const SUPPORT_WA     = 'https://wa.me/254724031319';
  const ALLOWED_ORIGIN = ['127.0.0.1:5500', 'kibeproxy-hub-app.vercel.app', 'localhost'];

  let warningShown = false;

  // ── SHOW TAMPER WARNING ──────────────────────────────────────
  function showTamperWarning(reason) {
    if (warningShown) return;
    warningShown = true;

    // Remove existing overlays
    const existing = document.getElementById('tamper-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'tamper-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 999999;
      background: rgba(0,0,0,0.92);
      backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Syne', sans-serif;
      padding: 1.5rem;
    `;

    overlay.innerHTML = `
      <div style="
        background: #111;
        border: 1px solid rgba(239,68,68,0.4);
        border-radius: 20px;
        padding: 2.5rem 2rem;
        max-width: 420px;
        width: 100%;
        text-align: center;
        animation: tamper-pop 0.4s cubic-bezier(0.175,0.885,0.32,1.275);
      ">
        <div style="
          width: 72px; height: 72px;
          background: rgba(239,68,68,0.12);
          border: 2px solid rgba(239,68,68,0.5);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 1.25rem;
          font-size: 2rem;
        ">🚫</div>

        <div style="font-size: 1.3rem; font-weight: 800; color: #f0f0f0; margin-bottom: 0.5rem;">
          Manipulation Detected
        </div>

        <div style="font-size: 0.82rem; color: #888; margin-bottom: 1.5rem; line-height: 1.7;">
          We detected an attempt to modify this page.<br>
          This activity has been flagged.<br><br>
          <strong style="color: #ef4444;">${reason || 'Unauthorized code modification detected.'}</strong>
        </div>

        <div style="
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px;
          padding: 12px 16px;
          margin-bottom: 1.5rem;
          font-size: 0.78rem;
          color: #fca5a5;
          text-align: left;
        ">
          ⚠️ Attempting to manipulate prices or bypass payments is a violation of our
          <strong>Terms of Service</strong> and may result in a permanent ban.
        </div>

        <div style="display:flex; gap:0.75rem; flex-direction:column;">
          <button onclick="window.location.reload()" style="
            width: 100%;
            background: #22c55e;
            color: #000;
            border: none;
            border-radius: 10px;
            padding: 12px;
            font-family: Syne, sans-serif;
            font-size: 0.9rem;
            font-weight: 700;
            cursor: pointer;
          ">🔄 Reload Page</button>

          <a href="${SUPPORT_WA}" target="_blank" style="
            display: block;
            width: 100%;
            background: transparent;
            border: 1px solid #333;
            color: #888;
            border-radius: 10px;
            padding: 11px;
            font-family: Syne, sans-serif;
            font-size: 0.82rem;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
          ">Contact Support</a>
        </div>

        <div style="margin-top:1.25rem;font-size:0.7rem;color:#444;font-family:'DM Mono',monospace;">
          Error 403 · KibeProxy Hub Security
        </div>
      </div>

      <style>
        @keyframes tamper-pop {
          from { transform: scale(0.8); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      </style>
    `;

    document.body.appendChild(overlay);

    // Disable all buttons and inputs on the page
    document.querySelectorAll('button, input, select').forEach(el => {
      if (!el.closest('#tamper-overlay')) el.disabled = true;
    });
  }

  // ── 1. DEVTOOLS DETECTION ────────────────────────────────────
  let devToolsOpen = false;

  function checkDevTools() {
    const threshold = 160;
    const widthDiff  = window.outerWidth  - window.innerWidth  > threshold;
    const heightDiff = window.outerHeight - window.innerHeight > threshold;

    if ((widthDiff || heightDiff) && !devToolsOpen) {
      devToolsOpen = true;
      showTamperWarning('Developer tools detected. Please close DevTools to continue.');
    } else if (!widthDiff && !heightDiff && devToolsOpen) {
      devToolsOpen = false;
      warningShown = false;
      const overlay = document.getElementById('tamper-overlay');
      if (overlay) overlay.remove();
      document.querySelectorAll('button, input, select').forEach(el => el.disabled = false);
    }
  }

  // Debugger trap
  const devToolsTrap = /./;
  devToolsTrap.toString = function() {
    devToolsOpen = true;
    showTamperWarning('Developer tools detected.');
    return '';
  };

  // ── 2. RIGHT-CLICK DISABLE ───────────────────────────────────
  document.addEventListener('contextmenu', e => {
    e.preventDefault();
    return false;
  });

  // ── 3. KEYBOARD SHORTCUT BLOCKING ───────────────────────────
  document.addEventListener('keydown', e => {
    // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && ['I','i','J','j','C','c'].includes(e.key)) ||
      (e.ctrlKey && ['U','u'].includes(e.key)) ||
      (e.metaKey && e.altKey && ['I','i','J','j','C','c'].includes(e.key))
    ) {
      e.preventDefault();
      e.stopPropagation();
      showTamperWarning('Keyboard shortcut blocked. Inspect tools are not allowed.');
      return false;
    }
  });

  // ── 4. PRICE INTEGRITY CHECK ─────────────────────────────────
  function checkPriceIntegrity() {
    // Watch all price-related elements
    const priceEls = document.querySelectorAll(
      '.price-val, .price-amount, #o-total, #mpesa-amount, .dur-btn.active'
    );

    priceEls.forEach(el => {
      const text   = el.textContent.replace(/[^0-9]/g, '');
      const amount = parseInt(text);

      if (amount && amount > 0 && !VALID_PRICES.some(p => amount % p === 0 || amount === p)) {
        // Check if it's a suspiciously low tampered value
        if (amount < 10) {
          showTamperWarning('Price manipulation detected. Transaction cancelled.');
        }
      }
    });
  }

  // ── 5. DOM MUTATION OBSERVER ──────────────────────────────────
  // Detect if someone injects scripts or modifies critical elements
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeName === 'SCRIPT' && node.id !== 'tamper-overlay') {
          // External script injected
          if (node.src && !node.src.includes('supabase') &&
              !node.src.includes('jsdelivr') &&
              !node.src.includes('fonts.googleapis') &&
              !node.src.includes('cloudflare')) {
            showTamperWarning('Unauthorized script injection detected.');
          }
        }
      });
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree:   true,
  });

  // ── 6. ORIGIN CHECK ───────────────────────────────────────────
  const currentHost = window.location.host;
  const isAllowed   = ALLOWED_ORIGIN.some(o => currentHost.includes(o));

  if (!isAllowed && currentHost !== '') {
    showTamperWarning('This page is being accessed from an unauthorized location.');
  }

  // ── 7. INTERVAL CHECKS ───────────────────────────────────────
  setInterval(() => {
    checkDevTools();
    checkPriceIntegrity();
  }, 1500);

  // Run once on load
  window.addEventListener('load', () => {
    checkDevTools();
    checkPriceIntegrity();
  });

  // ── 8. CONSOLE OVERRIDE (clears console) ─────────────────────
  const noop = () => {};
  // Only in production
  if (!window.location.host.includes('localhost') &&
      !window.location.host.includes('127.0.0.1')) {
    window.console.log   = noop;
    window.console.warn  = noop;
    window.console.error = noop;
    window.console.info  = noop;
    window.console.debug = noop;
    window.console.table = noop;
    window.console.dir   = noop;
  }

})();