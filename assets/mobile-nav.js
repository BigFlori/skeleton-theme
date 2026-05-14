(function () {
  'use strict';

  var drawer = document.getElementById('sw-mobile-nav');
  var backdrop = document.querySelector('[data-mobile-nav-backdrop]');
  var trigger = document.querySelector('[data-mobile-nav-trigger]');

  if (!drawer) return;

  function open() {
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    if (backdrop) backdrop.classList.add('is-open');
    document.body.classList.add('is-scroll-locked');
    var closeBtn = drawer.querySelector('[data-mobile-nav-close]');
    if (closeBtn) closeBtn.focus();
  }

  function close() {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (backdrop) backdrop.classList.remove('is-open');
    document.body.classList.remove('is-scroll-locked');
    if (trigger) trigger.focus();
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-mobile-nav-trigger]')) { open(); return; }
    if (e.target.closest('[data-mobile-nav-close]')) { close(); return; }
    if (e.target.closest('[data-mobile-nav-backdrop]')) { close(); return; }
    if (e.target.closest('#sw-mobile-nav a')) { close(); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) close();
  });
})();
