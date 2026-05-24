(function () {
  'use strict';

  var cfg = window.swPredictiveSearchConfig || {};
  var routes = cfg.routes || {};
  var strings = cfg.strings || {};

  var drawer = document.getElementById('sw-search-drawer');
  var backdrop = document.querySelector('[data-search-backdrop]');
  if (!drawer) return;

  var input = drawer.querySelector('[data-predictive-search-input]');
  var form = drawer.querySelector('[data-predictive-search-form]');
  var resultsEl = drawer.querySelector('[data-predictive-search-results]');
  var clearBtn = drawer.querySelector('[data-predictive-search-clear]');
  var trigger = null;
  var debounceId = null;
  var lastQuery = '';
  var abortCtrl = null;
  var historyPushed = false;
  var closingFromPopstate = false;

  var FOCUSABLE_SEL =
    'a[href], button:not([disabled]):not([hidden]), input:not([disabled]):not([type="hidden"]), [tabindex]:not([tabindex="-1"])';
  var ITEM_SEL = '.sw-search-drawer__item a, .sw-search-drawer__view-all';

  function setTriggersExpanded(expanded) {
    var triggers = document.querySelectorAll('[data-search-trigger]');
    for (var i = 0; i < triggers.length; i++) {
      triggers[i].setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
  }

  function open() {
    if (drawer.classList.contains('is-open')) return;
    trigger = document.activeElement;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    setTriggersExpanded(true);
    if (backdrop) backdrop.classList.add('is-open');
    document.body.classList.add('is-scroll-locked');
    setTimeout(function () { if (input) input.focus(); }, 80);
    if (!historyPushed) {
      try {
        history.pushState({ swSearchDrawer: true }, '');
        historyPushed = true;
      } catch (_) {}
    }
  }

  function close() {
    if (!drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    setTriggersExpanded(false);
    if (backdrop) backdrop.classList.remove('is-open');
    document.body.classList.remove('is-scroll-locked');
    if (trigger && typeof trigger.focus === 'function') trigger.focus();
    if (historyPushed && !closingFromPopstate) {
      historyPushed = false;
      try { history.back(); } catch (_) {}
    } else {
      historyPushed = false;
    }
    closingFromPopstate = false;
  }

  window.addEventListener('popstate', function () {
    if (drawer.classList.contains('is-open')) {
      closingFromPopstate = true;
      historyPushed = false;
      close();
    }
  });

  function getFocusable() {
    var nodes = drawer.querySelectorAll(FOCUSABLE_SEL);
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.hasAttribute('hidden')) continue;
      if (el.offsetParent === null && el !== document.activeElement) continue;
      out.push(el);
    }
    return out;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderHint() {
    resultsEl.innerHTML =
      '<div class="sw-search-drawer__hint"><span class="mono">' +
      escapeHtml(strings.loading || '') + '</span></div>';
  }

  function renderEmpty(q) {
    resultsEl.innerHTML =
      '<div class="sw-search-drawer__empty"><span>' +
      escapeHtml(strings.no_results || 'No results') +
      ' &mdash; <strong>' + escapeHtml(q) + '</strong></span></div>';
  }

  function renderError() {
    resultsEl.innerHTML =
      '<div class="sw-search-drawer__error">' + escapeHtml(strings.error || 'Error') + '</div>';
  }

  function clearResults() {
    resultsEl.innerHTML =
      '<div class="sw-search-drawer__hint"><span class="mono">' +
      escapeHtml(strings.hint || '') + '</span></div>';
  }

  function productItem(p) {
    var imgUrl = p.featured_image
      ? (typeof p.featured_image === 'string' ? p.featured_image : p.featured_image.url)
      : null;
    var img = imgUrl
      ? '<img class="sw-search-drawer__item-img" src="' + escapeHtml(imgUrl) +
        '" alt="" loading="lazy" width="56" height="56">'
      : '<span class="sw-search-drawer__item-img sw-search-drawer__item-img--ph" aria-hidden="true">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 17l-5-5-9 9"/></svg>' +
        '</span>';
    var vendor = p.vendor ? '<div class="sw-search-drawer__item-vendor mono">' + escapeHtml(p.vendor) + '</div>' : '';
    var price = p.price != null
      ? '<div class="sw-search-drawer__item-price">' + escapeHtml(p.price) + '</div>'
      : '<div></div>';
    return '<li class="sw-search-drawer__item"><a href="' + escapeHtml(p.url) + '">' +
      img +
      '<div class="sw-search-drawer__item-body">' + vendor +
        '<div class="sw-search-drawer__item-title">' + escapeHtml(p.title) + '</div>' +
      '</div>' + price +
      '</a></li>';
  }

  function simpleItem(it) {
    return '<li class="sw-search-drawer__item"><a href="' + escapeHtml(it.url) + '">' +
      '<span class="sw-search-drawer__item-img sw-search-drawer__item-img--ph" aria-hidden="true">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>' +
      '</span>' +
      '<div class="sw-search-drawer__item-body">' +
        '<div class="sw-search-drawer__item-title">' + escapeHtml(it.title) + '</div>' +
      '</div><div></div></a></li>';
  }

  function group(title, items, renderer) {
    if (!items || !items.length) return '';
    var list = items.map(renderer).join('');
    return '<div class="sw-search-drawer__group">' +
      '<div class="sw-search-drawer__group-title"><span>' + escapeHtml(title) + '</span></div>' +
      '<ul class="sw-search-drawer__group-list" role="list">' + list + '</ul>' +
      '</div>';
  }

  function formatMoney(cents) {
    if (cents == null) return null;
    try {
      var locale = (document.documentElement.lang || 'en').slice(0, 2);
      var currency = (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'EUR';
      return new Intl.NumberFormat(locale, { style: 'currency', currency: currency, minimumFractionDigits: 0, maximumFractionDigits: 2 })
        .format(cents / 100);
    } catch (e) {
      return '€' + (cents / 100).toFixed(2);
    }
  }

  function normalizeProducts(arr) {
    return (arr || []).map(function (p) {
      var price = null;
      if (typeof p.price === 'string') {
        price = p.price;
      } else if (p.price && p.price.amount != null) {
        price = formatMoney(Math.round(parseFloat(p.price.amount) * 100));
      } else if (typeof p.price === 'number') {
        price = formatMoney(p.price);
      }
      return {
        title: p.title,
        vendor: p.vendor,
        url: p.url,
        price: price,
        featured_image: p.featured_image || p.image || null
      };
    });
  }

  function render(data, q) {
    var resources = (data && data.resources && data.resources.results) || {};
    var products = normalizeProducts(resources.products || []);
    var articles = (resources.articles || []).map(function (a) { return { title: a.title, url: a.url }; });
    var pages = (resources.pages || []).map(function (p) { return { title: p.title, url: p.url }; });

    if (!products.length && !articles.length && !pages.length) {
      renderEmpty(q);
      return;
    }

    var html = '';
    html += group(strings.products || 'Products', products, productItem);
    html += group(strings.articles || 'Articles', articles, simpleItem);
    html += group(strings.pages || 'Pages', pages, simpleItem);

    html += '<div class="sw-search-drawer__group">' +
      '<a class="sw-search-drawer__view-all" href="' +
      escapeHtml((routes.search || '/search') + '?q=' + encodeURIComponent(q) + '&options[prefix]=last') +
      '">' + escapeHtml(strings.view_all || 'View all results') + ' →</a></div>';

    resultsEl.innerHTML = html;
  }

  function fetchSuggest(q) {
    if (abortCtrl) abortCtrl.abort();
    abortCtrl = ('AbortController' in window) ? new AbortController() : null;
    var url = (routes.suggest || '/search/suggest.json') +
      '?q=' + encodeURIComponent(q) +
      '&resources[type]=product,article,page' +
      '&resources[limit]=6' +
      '&resources[options][unavailable_products]=last';

    fetch(url, { signal: abortCtrl ? abortCtrl.signal : undefined, headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (data) {
        if (q !== lastQuery) return;
        render(data, q);
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;
        renderError();
      });
  }

  function updateClearVisibility() {
    if (!clearBtn) return;
    if (input.value.length > 0) clearBtn.removeAttribute('hidden');
    else clearBtn.setAttribute('hidden', '');
  }

  function onInput() {
    var q = input.value.trim();
    lastQuery = q;
    updateClearVisibility();
    clearTimeout(debounceId);
    if (q.length < 2) {
      if (abortCtrl) abortCtrl.abort();
      clearResults();
      return;
    }
    renderHint();
    debounceId = setTimeout(function () { fetchSuggest(q); }, 180);
  }

  if (input) input.addEventListener('input', onInput);

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      input.value = '';
      lastQuery = '';
      updateClearVisibility();
      if (abortCtrl) abortCtrl.abort();
      clearResults();
      input.focus();
    });
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-search-trigger]')) { e.preventDefault(); open(); return; }
    if (e.target.closest('[data-search-close]')) { e.preventDefault(); close(); return; }
    if (e.target.closest('[data-search-backdrop]')) { close(); return; }
  });

  function moveItemFocus(direction) {
    var items = Array.prototype.slice.call(resultsEl.querySelectorAll(ITEM_SEL));
    if (!items.length) return false;
    var active = document.activeElement;
    var idx = items.indexOf(active);
    if (direction > 0) {
      if (idx === -1) {
        items[0].focus();
      } else if (idx < items.length - 1) {
        items[idx + 1].focus();
      } else {
        items[items.length - 1].focus();
      }
    } else {
      if (idx <= 0) {
        if (input) input.focus();
      } else {
        items[idx - 1].focus();
      }
    }
    return true;
  }

  document.addEventListener('keydown', function (e) {
    var isOpen = drawer.classList.contains('is-open');

    if (e.key === 'Escape' && isOpen) { close(); return; }

    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (isOpen) close(); else open();
      return;
    }

    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      if (moveItemFocus(1)) e.preventDefault();
      return;
    }
    if (e.key === 'ArrowUp') {
      if (moveItemFocus(-1)) e.preventDefault();
      return;
    }

    if (e.key === 'Tab') {
      var f = getFocusable();
      if (!f.length) return;
      var first = f[0];
      var last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
})();
