(function () {
  'use strict';

  var cfg     = window.swCollectionConfig || {};
  var strings = cfg.strings || {};

  function showMoreText(count) {
    var tpl = strings.showMore || '+ {{ count }} more';
    return tpl.replace('__COUNT__', count).replace('{{ count }}', count);
  }

  // ── Price range dual-handle slider ────────────────────────────────────────

  function buildCurrencyFormatter() {
    var currencyCfg = cfg.currency || {};
    var code   = currencyCfg.code || 'USD';
    var locale = currencyCfg.locale || undefined;
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: code });
    } catch (e) {
      return { format: function (n) { return n.toLocaleString() + ' ' + code; } };
    }
  }

  function initPriceSlider() {
    var sliders = document.querySelectorAll('[data-price-handle]');
    if (!sliders.length) return;

    var minInput = document.querySelector('[data-price-handle="min"]');
    var maxInput = document.querySelector('[data-price-handle="max"]');
    var fill     = document.getElementById('PriceRangeFill');
    var minLabel = document.getElementById('PriceMin');
    var maxLabel = document.getElementById('PriceMax');

    if (!minInput || !maxInput) return;

    var priceMin = parseFloat(minInput.min) || 0;
    var priceMax = parseFloat(maxInput.max) || 0;
    if (priceMax <= priceMin) return;

    var formatter = buildCurrencyFormatter();
    var gap = Math.max(1, Math.round((priceMax - priceMin) / 100));

    function pct(v) {
      return ((v - priceMin) / (priceMax - priceMin)) * 100;
    }

    function update() {
      var lo = parseFloat(minInput.value);
      var hi = parseFloat(maxInput.value);

      if (fill) {
        fill.style.left  = pct(lo) + '%';
        fill.style.right = (100 - pct(hi)) + '%';
      }
      if (minLabel) minLabel.textContent = formatter.format(Math.floor(lo));
      if (maxLabel) maxLabel.textContent = formatter.format(Math.ceil(hi));
    }

    minInput.addEventListener('input', function () {
      var lo = parseFloat(minInput.value);
      var hi = parseFloat(maxInput.value);
      if (lo >= hi - gap) {
        minInput.value = hi - gap;
      }
      update();
    });

    maxInput.addEventListener('input', function () {
      var lo = parseFloat(minInput.value);
      var hi = parseFloat(maxInput.value);
      if (hi <= lo + gap) {
        maxInput.value = lo + gap;
      }
      update();
    });

    minInput.addEventListener('change', function () {
      document.getElementById('CollectionFilters').submit();
    });
    maxInput.addEventListener('change', function () {
      document.getElementById('CollectionFilters').submit();
    });

    update();
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

  var toastTimer = null;

  function showToast(msg) {
    var toast = document.getElementById('sw-drawer-toast');
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.hidden = false;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toast.classList.add('sw-toast--visible');
      });
    });
    toastTimer = setTimeout(function () {
      toast.classList.remove('sw-toast--visible');
      setTimeout(function () { toast.hidden = true; }, 220);
    }, 3000);
  }

  function updateBadge(count) {
    document.querySelectorAll('[data-cart-drawer-count]').forEach(function (el) {
      el.textContent = count;
      el.hidden = count === 0;
    });
  }

  async function addToCart(variantId, productTitle) {
    try {
      var res = await fetch('/cart/add.js', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: parseInt(variantId, 10), quantity: 1 }),
      });

      if (!res.ok) {
        var err = await res.json();
        throw new Error((err && (err.description || err.message)) || strings.errorAddCart || 'Could not add to cart');
      }

      // Fetch updated cart count
      var cartRes = await fetch('/cart.js', { credentials: 'same-origin' });
      if (cartRes.ok) {
        var cart = await cartRes.json();
        updateBadge(cart.item_count);
      }

      // Dispatch event for cart-drawer.js to refresh + open the drawer
      document.dispatchEvent(new CustomEvent('cart:item-added'));

    } catch (err) {
      showToast(err.message || strings.errorGeneric || 'Something went wrong');
    }
  }

  function initAddToCart() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-atc-id]');
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      var variantId    = btn.dataset.atcId;
      var productTitle = btn.dataset.atcTitle || 'Product';

      if (!variantId) return;

      btn.disabled = true;
      btn.classList.add('is-loading');

      addToCart(variantId, productTitle).finally(function () {
        btn.disabled = false;
        btn.classList.remove('is-loading');
      });
    });
  }

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

  // ── Init ──────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    initPriceSlider();
    initFilterSections();
    initShowMore();
    initAutoSubmit();
    initAddToCart();
    initSortSubmit();
  });

})();
