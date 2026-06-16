(function () {
  'use strict';

  var drawer = document.getElementById('sw-mobile-nav');
  if (!drawer) return;

  var backdrop = document.querySelector('[data-mobile-nav-backdrop]');
  var trigger = document.querySelector('[data-mobile-nav-trigger]');

  // Stack of open sub-panel ids; deepest is last. Root ("root") is the
  // implicit base and is never pushed onto the stack.
  var stack = [];

  function panelById(id) {
    return drawer.querySelector('[data-panel-id="' + id + '"]');
  }

  // Single source of truth: derive every panel's position from `stack`.
  //   • top of stack (or root when empty) → on-screen          (is-active)
  //   • ancestors of the top              → slid partly left   (is-parent)
  //   • everything else                   → parked off-screen right (default)
  // The off-screen/parent panels are marked `inert` so their content can't be
  // focused or read by assistive tech while hidden behind the active panel.
  function render() {
    var topId = stack.length ? stack[stack.length - 1] : 'root';

    drawer.querySelectorAll('.sw-mobile-nav__panel').forEach(function (panel) {
      var id = panel.getAttribute('data-panel-id');
      var isTop = id === topId;
      var inPath = id === 'root' || stack.indexOf(id) !== -1;

      // Root keeps its own resting position (translateX 0) via --root, so it
      // only ever toggles is-parent; sub-panels toggle is-active.
      panel.classList.toggle('is-active', isTop && id !== 'root');
      panel.classList.toggle('is-parent', inPath && !isTop);

      if (isTop) {
        panel.removeAttribute('inert');
      } else {
        panel.setAttribute('inert', '');
      }
    });

    drawer.querySelectorAll('[data-panel-target]').forEach(function (btn) {
      var open = stack.indexOf(btn.getAttribute('data-panel-target')) !== -1;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Drill one level deeper: the parent slides left while the target panel
  // slides in from the right and covers it.
  function openPanel(id, opener) {
    var panel = panelById(id);
    if (!panel || stack.indexOf(id) !== -1) return;
    panel.scrollTop = 0;
    stack.push(id);
    render();
    var back = panel.querySelector('[data-panel-back]');
    if (back) back.focus({ preventScroll: true });
  }

  // Step back one level: the deepest panel slides out to the right while its
  // parent slides back into place.
  function popPanel() {
    if (!stack.length) return;
    var id = stack.pop();
    render();
    var opener = drawer.querySelector('[data-panel-target="' + id + '"]');
    if (opener) opener.focus({ preventScroll: true });
  }

  // Collapse everything back to root (used on open/close).
  function resetPanels() {
    stack = [];
    render();
  }

  function open() {
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    if (backdrop) backdrop.classList.add('is-open');
    document.body.classList.add('is-scroll-locked');
    var closeBtn = drawer.querySelector('[data-mobile-nav-close]');
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  }

  function close() {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (backdrop) backdrop.classList.remove('is-open');
    document.body.classList.remove('is-scroll-locked');
    if (trigger) trigger.focus({ preventScroll: true });
    // Reset only after the drawer has fully slid away, so the inner panels
    // don't visibly snap back to root during the close.
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

  // ── Focus trap ──
  // The drawer is aria-modal, so Tab must stay inside it while open. Off-screen
  // and ancestor panels are marked `inert`, so their controls are naturally
  // excluded; we additionally filter out anything hidden or inside an inert
  // subtree, then wrap focus at the two ends.
  var FOCUSABLE = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  function getFocusable() {
    return Array.prototype.filter.call(
      drawer.querySelectorAll(FOCUSABLE),
      function (el) {
        if (el.closest('[inert]')) return false;
        // Visible (not display:none / detached)?
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      }
    );
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || !drawer.classList.contains('is-open')) return;
    var focusable = getFocusable();
    if (!focusable.length) { e.preventDefault(); return; }
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    var active = document.activeElement;

    // Focus escaped the drawer (e.g. into page chrome) — pull it back in.
    if (!drawer.contains(active)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus({ preventScroll: true });
      return;
    }
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus({ preventScroll: true });
    }
  });

  // Park every sub-panel off-screen and inert before the drawer is opened.
  render();
})();
