(function () {
  'use strict';

  if (window.swCollectionInited) return;
  window.swCollectionInited = true;

  var cfg     = window.swCollectionConfig || {};
  var strings = cfg.strings || {};

  function showMoreText(count) {
    var tpl = strings.showMore || '+ {{ count }} more';
    return tpl.replace('__COUNT__', count).replace('{{ count }}', count);
  }

  // ── Filter section accordion ───────────────────────────────────────────────

  function initFilterSections() {
    document.querySelectorAll('[data-section-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key  = btn.dataset.sectionToggle;
        var body = document.querySelector('[data-section-body="' + key + '"]');
        var expanded = btn.getAttribute('aria-expanded') !== 'false';

        btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        var chevron = btn.querySelector('.coll-filter-section__chevron');
        if (chevron) chevron.style.transform = expanded ? 'rotate(-90deg)' : 'rotate(0deg)';

        if (body) {
          body.hidden = expanded;
        }
      });
    });
  }

  // ── Brand show more / less ────────────────────────────────────────────────

  function initShowMore() {
    document.querySelectorAll('[data-show-more]').forEach(function (btn) {
      var key      = btn.dataset.showMore;
      var list     = document.querySelector('[data-check-list="' + key + '"]');
      var overflow = list ? list.querySelectorAll('.coll-check-overflow') : [];
      var expanded = false;

      if (!overflow.length) { btn.hidden = true; return; }

      var moreCount = overflow.length;
      btn.textContent = showMoreText(moreCount);

      btn.addEventListener('click', function () {
        expanded = !expanded;
        overflow.forEach(function (el) { el.hidden = !expanded; });
        btn.textContent = expanded ? (strings.showLess || 'Show less') : showMoreText(moreCount);
      });
    });
  }

  // ── Auto-submit on checkbox / toggle change ───────────────────────────────

  function initAutoSubmit() {
    var form = document.getElementById('CollectionFilters');
    if (!form) return;

    form.querySelectorAll('.coll-check-input').forEach(function (cb) {
      cb.addEventListener('change', function () { form.submit(); });
    });

    form.querySelectorAll('.coll-toggle-input').forEach(function (toggle) {
      toggle.addEventListener('change', function () { form.submit(); });
    });
  }

  // ── Add-to-cart ───────────────────────────────────────────────────────────
  // The [data-atc-id] click handler now lives in the globally-loaded
  // assets/cart-atc.js (so product cards work on every page, incl. the PDP
  // recently-viewed carousel). Nothing to wire up here.

  // ── Sort select submit ────────────────────────────────────────────────────

  function initSortSubmit() {
    var sortSel = document.querySelector('.coll-sort-select');
    if (!sortSel) return;
    // The select has form="CollectionFilters" so its value is included on every submission.
    // Submit the form when sort changes.
    sortSel.addEventListener('change', function () {
      document.getElementById('CollectionFilters').submit();
    });
  }

  // ── Mobile filters drawer ─────────────────────────────────────────────────

  function initFiltersDrawer() {
    var drawer   = document.getElementById('CollectionFilters');
    var backdrop = document.querySelector('[data-filters-backdrop]');
    var trigger  = document.querySelector('[data-filters-trigger]');
    if (!drawer || !trigger) return;

    function open() {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
      if (backdrop) backdrop.classList.add('is-open');
      document.body.classList.add('is-scroll-locked');
      var closeBtn = drawer.querySelector('[data-filters-close]');
      if (closeBtn) closeBtn.focus();
    }

    function close() {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      trigger.setAttribute('aria-expanded', 'false');
      if (backdrop) backdrop.classList.remove('is-open');
      document.body.classList.remove('is-scroll-locked');
      trigger.focus();
    }

    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-filters-trigger]')) { e.preventDefault(); open(); return; }
      if (e.target.closest('[data-filters-close]')) { e.preventDefault(); close(); return; }
      if (e.target.closest('[data-filters-backdrop]')) { close(); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) close();
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    initFilterSections();
    initShowMore();
    initAutoSubmit();
    initSortSubmit();
    initFiltersDrawer();
  });

})();
