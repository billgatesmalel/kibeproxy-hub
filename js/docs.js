// ── DOCS PAGE JS ─────────────────────────────────────────────

// FAQ toggle
function toggleFaq(el) {
  el.classList.toggle('open');
}

// Support dropdown
function toggleSupport(e) {
  e.preventDefault();
  var menu = document.getElementById('support-menu');
  if (menu) menu.classList.toggle('open');
}

document.addEventListener('click', function(e) {
  var menu = document.getElementById('support-menu');
  if (menu && !e.target.closest('.support-dropdown')) {
    menu.classList.remove('open');
  }
});

// Highlight active nav link on scroll
var sections = document.querySelectorAll('.doc-sec');
var navLinks  = document.querySelectorAll('.docs-nav-link');

window.addEventListener('scroll', function() {
  var current = '';
  sections.forEach(function(s) {
    if (window.scrollY >= s.offsetTop - 120) current = s.id;
  });
  navLinks.forEach(function(l) {
    l.classList.toggle('active', l.getAttribute('href') === '#' + current);
  });
});

// Render email safely (prevent Cloudflare encoding)
(function() {
  var e = 'kibetcreations2025' + '@' + 'outlook.com';
  document.querySelectorAll('.footer-email-placeholder').forEach(function(el) {
    el.textContent = e;
    el.href = 'mailto:' + e;
  });
  var sp = document.getElementById('footer-email');
  if (sp) sp.textContent = ' ' + e;
})();