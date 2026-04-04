/**
 * Shared utility for navigation loading feedback
 */
document.addEventListener('DOMContentLoaded', () => {
  // Add a top-level progress bar element if it doesn't exist
  if (!document.getElementById('nav-progress')) {
    const bar = document.createElement('div');
    bar.id = 'nav-progress';
    bar.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      background: var(--green);
      z-index: 9999;
      width: 0;
      transition: width 0.3s ease;
      box-shadow: 0 0 10px var(--green-dim);
      display: none;
    `;
    document.body.appendChild(bar);
  }

  // Handle all internal links
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.href && link.href.startsWith(window.location.origin) && !link.target && !link.href.includes('#')) {
      showNavLoading();
    }
  });

  // Handle forms
  document.addEventListener('submit', (e) => {
    showNavLoading();
  });
});

function showNavLoading() {
  const bar = document.getElementById('nav-progress');
  if (bar) {
    bar.style.display = 'block';
    bar.style.width = '30%';
    setTimeout(() => { bar.style.width = '70%'; }, 200);
  }
}

// Global cached data handling
const AppCache = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem('kibe_cache_' + key));
    } catch { return null; }
  },
  set(key, val) {
    localStorage.setItem('kibe_cache_' + key, JSON.stringify(val));
  }
};

// Update balance display across pages
function updateGlobalBalance(balance) {
  AppCache.set('balance', balance);
  const els = document.querySelectorAll('#nav-balance, #stat-balance');
  els.forEach(el => el.textContent = 'KES ' + balance);
}

// Show cached values immediately
(function useCache() {
  const cachedBalance = AppCache.get('balance');
  if (cachedBalance !== null) {
    document.addEventListener('DOMContentLoaded', () => {
      const els = document.querySelectorAll('#nav-balance, #stat-balance');
      els.forEach(el => el.textContent = 'KES ' + cachedBalance);
    });
  }
  
  const cachedUser = AppCache.get('user_meta');
  if (cachedUser) {
    document.addEventListener('DOMContentLoaded', () => {
      const nameEl = document.getElementById('user-name');
      const initialsEl = document.getElementById('user-initials');
      if (nameEl) nameEl.textContent = cachedUser.name;
      if (initialsEl) initialsEl.textContent = cachedUser.initials;
    });
  }
})();
