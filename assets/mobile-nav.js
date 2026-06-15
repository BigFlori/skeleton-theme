(function () {
  'use strict';

  var drawer = document.getElementById('sw-mobile-nav');
  var backdrop = document.querySelector('[data-mobile-nav-backdrop]');
  var trigger = document.querySelector('[data-mobile-nav-trigger]');

  if (!drawer) return;

  // Stack of open sub-panel ids (root is always the base layer, not tracked).
  var stack = [];

  function panelById(id) {
    return drawer.querySelector('[data-panel-id="' + id + '"]');
  }

  // Reset drill-down to the root level (used on open/close).
  function resetPanels() {
    drawer
      .querySelectorAll('.sw-mobile-nav__panel.is-active:not(.sw-mobile-nav__panel--root)')
      .forEach(function (p) { p.classList.remove('is-active'); });
    drawer
      .querySelectorAll('[data-panel-target][aria-expanded="true"]')
      .forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    stack = [];
  }

  function openPanel(id, openerBtn) {
    var panel = panelById(id);
    if (!panel) return;
    panel.classList.add('is-active');
    if (openerBtn) openerBtn.setAttribute('aria-expanded', 'true');
    stack.push(id);
    panel.scrollTop = 0;
    var back = panel.querySelector('[data-panel-back]');
    if (back) back.focus();
  }

  // Slide back one level (deepest active panel).
  function popPanel() {
    if (!stack.length) return;
    var id = stack.pop();
    var panel = panelById(id);
    if (panel) panel.classList.remove('is-active');
    var opener = drawer.querySelector('[data-panel-target="' + id + '"]');
    if (opener) {
      opener.setAttribute('aria-expanded', 'false');
      opener.focus();
    }
  }

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
    // Reset only after the drawer has fully slid away, so the inner
    // panels don't visibly snap back to root during the close.
    setTimeout(resetPanels, 450);
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-mobile-nav-trigger]')) { open(); return; }
    if (e.target.closest('[data-mobile-nav-close]')) { close(); return; }
    if (e.target.closest('[data-mobile-nav-backdrop]')) { close(); return; }

    var drillBtn = e.target.closest('[data-panel-target]');
    if (drillBtn && drawer.contains(drillBtn)) {
      openPanel(drillBtn.getAttribute('data-panel-target'), drillBtn);
      return;
    }

    var backBtn = e.target.closest('[data-panel-back]');
    if (backBtn && drawer.contains(backBtn)) {
      popPanel();
      return;
    }

    // Any real navigation link closes the whole drawer.
    if (e.target.closest('#sw-mobile-nav a')) { close(); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !drawer.classList.contains('is-open')) return;
    // Escape steps back one level, or closes the drawer at the root.
    if (stack.length) {
      popPanel();
    } else {
      close();
    }
  });
})();
