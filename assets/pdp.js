/* Sonnwerk — PDP interactions (gallery, qty, swatches, ATC, sticky, compat) */
(function () {
  'use strict';

  function init(scope) {
    scope = scope || document;

    var cfg  = window.PDP_CONFIG;
    var i18n = window.PDP_I18N;
    if (!cfg || !i18n) return;

    var pdpForm = scope.querySelector('#pdp-form');
    if (!pdpForm) return;

    var BASE_PRICE_CENTS = cfg.basePriceCents;
    var MODULE_KWP       = cfg.moduleKwp;
    var VOC              = cfg.voc;
    var PRODUCT_TITLE    = cfg.productTitle;
    var allVariants      = cfg.variants || [];

    var ZERO_DECIMAL_CURRENCIES = {
      BIF:1, CLP:1, DJF:1, GNF:1, HUF:1, ISK:1, JPY:1, KMF:1, KRW:1, PYG:1,
      RWF:1, UGX:1, UYI:1, VND:1, VUV:1, XAF:1, XOF:1, XPF:1
    };
    var SUBUNIT_TO_UNIT = ZERO_DECIMAL_CURRENCIES[cfg.currencyCode] ? 1 : 100;
    var BASE_PRICE_MAJOR = BASE_PRICE_CENTS / SUBUNIT_TO_UNIT;

    var tierSource = 'none';
    var DISCOUNT_TIERS = [];
    /* Volume discount tier resolution — disabled until the discount app is built
    var rawTiers = [];
    if (Array.isArray(cfg.discountTiers) && cfg.discountTiers.length > 0) {
      rawTiers = cfg.discountTiers;
      tierSource = 'product';
    } else if (Array.isArray(cfg.priceBands)) {
      for (var bi = 0; bi < cfg.priceBands.length; bi++) {
        var band = cfg.priceBands[bi];
        if (!band) continue;
        var bMin = Number(band.min_price);
        var bMax = band.max_price === null || band.max_price === undefined
          ? Infinity
          : Number(band.max_price);
        if (!Number.isFinite(bMin)) continue;
        if (BASE_PRICE_MAJOR >= bMin && BASE_PRICE_MAJOR <= bMax) {
          rawTiers = Array.isArray(band.tiers) ? band.tiers : [];
          tierSource = 'band';
          break;
        }
      }
    }

    DISCOUNT_TIERS = rawTiers
      .map(function (t) {
        return {
          minQty: Number(t && t.min_qty),
          pct:    Number(t && t.discount_pct)
        };
      })
      .filter(function (t) {
        return Number.isFinite(t.minQty) && Number.isFinite(t.pct) && t.pct > 0;
      })
      .sort(function (a, b) { return a.minQty - b.minQty; });
    */

    var qty = 1;

    var CURRENCY_CODE = cfg.currencyCode || 'EUR';
    var PRICE_FRACTION_DIGITS = SUBUNIT_TO_UNIT === 1 ? 0 : 2;
    var priceFormatter;
    try {
      priceFormatter = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: CURRENCY_CODE,
        maximumFractionDigits: PRICE_FRACTION_DIGITS,
        minimumFractionDigits: 0
      });
    } catch (e) {
      priceFormatter = null;
    }
    function fmtEur(subunit) {
      var major = Number(subunit) / SUBUNIT_TO_UNIT;
      if (!Number.isFinite(major)) return '';
      if (priceFormatter) return priceFormatter.format(major);
      var rounded = SUBUNIT_TO_UNIT === 1
        ? Math.round(major).toLocaleString()
        : major.toFixed(2);
      return rounded + ' ' + CURRENCY_CODE;
    }
    function discount(n) {
      var best = 0;
      for (var i = 0; i < DISCOUNT_TIERS.length; i++) {
        var t = DISCOUNT_TIERS[i];
        if (n >= t.minQty && t.pct > best) best = t.pct;
      }
      return best / 100;
    }
    function effCents(n) {
      return Math.round(BASE_PRICE_CENTS * (1 - discount(n)));
    }
    function ti(str, vals) {
      return str.replace(/\{\{\s*(\w+)\s*\}\}/g, function (_, k) {
        return vals[k] !== undefined ? vals[k] : '';
      });
    }
    function showToast(msg) {
      var t = document.getElementById('pdp-toast');
      var m = document.getElementById('pdp-toast-msg');
      if (!t || !m) return;
      m.textContent = msg;
      t.classList.add('sw-toast--visible');
      setTimeout(function () { t.classList.remove('sw-toast--visible'); }, 2400);
    }

    // ── Tier list ──
    var tierListEl   = scope.querySelector('#pdp-tier-list');
    var tierHeadEl   = scope.querySelector('#pdp-tier-heading');
    var tierRowsEl   = scope.querySelector('#pdp-tier-rows');
    var tierSourceEl = scope.querySelector('#pdp-tier-source');
    var tierRowEls   = [];

    function renderTierList() {
      if (!tierListEl || !tierRowsEl) return;
      if (DISCOUNT_TIERS.length === 0) {
        tierListEl.style.display = 'none';
        return;
      }
      tierListEl.style.display = '';
      if (tierHeadEl && i18n.tierHeading) tierHeadEl.textContent = i18n.tierHeading;

      tierRowsEl.innerHTML = '';
      tierRowEls = DISCOUNT_TIERS.map(function (t) {
        var effUnit = Math.round(BASE_PRICE_CENTS * (1 - t.pct / 100));
        var row = document.createElement('div');
        row.className = 'pdp-buy__tier-row';
        row.dataset.tierMin = String(t.minQty);
        row.innerHTML = ti(i18n.tierRowHtml || '{{ qty }} → {{ price }}', {
          qty:   t.minQty,
          price: fmtEur(effUnit)
        });
        tierRowsEl.appendChild(row);
        return row;
      });

      if (tierSourceEl) {
        var label = tierSource === 'product'
          ? (i18n.tierSourceProduct || 'product')
          : tierSource === 'band'
            ? (i18n.tierSourceBand || 'shop band')
            : '—';
        tierSourceEl.textContent = ti(i18n.tierSourceTest || 'Source (test): {{ source }}', { source: label });
      }
    }

    function highlightActiveTier(currentQty) {
      if (tierRowEls.length === 0) return;
      var activeIdx = -1;
      for (var i = 0; i < DISCOUNT_TIERS.length; i++) {
        if (currentQty >= DISCOUNT_TIERS[i].minQty) activeIdx = i;
      }
      tierRowEls.forEach(function (row, idx) {
        row.classList.toggle('is-active', idx === activeIdx);
      });
    }

    // ── Gallery ──
    var mainImg      = scope.querySelector('#pdp-main-img');
    var galleryLabel = scope.querySelector('#pdp-gallery-label');
    var thumbButtons = scope.querySelectorAll('.pdp-gallery__thumb');
    var totalImgs    = thumbButtons.length;

    thumbButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.dataset.idx, 10);
        if (mainImg) { mainImg.src = this.dataset.src; mainImg.alt = this.dataset.alt; }
        if (galleryLabel) {
          var n   = String(idx + 1).padStart(2, '0');
          var tot = String(totalImgs).padStart(2, '0');
          galleryLabel.textContent = n + ' / ' + tot + (this.dataset.label ? ' · ' + this.dataset.label : '');
        }
        thumbButtons.forEach(function (b) { b.classList.remove('is-active'); });
        this.classList.add('is-active');
      });
    });

    // ── Quantity ──
    function updateQty(n) {
      qty = Math.max(1, n);
      var disc  = discount(qty);
      var eff   = effCents(qty);
      var total = eff * qty;
      var kwp   = (qty * MODULE_KWP).toFixed(2).replace('.', ',');

      var qtyInput = document.getElementById('pdp-qty-input');
      if (qtyInput) qtyInput.value = qty;

      document.querySelectorAll('#pdp-qty-display, #pdp-sticky-qty-display').forEach(function (el) {
        el.textContent = qty;
      });

      var label = document.getElementById('pdp-qty-label');
      if (label) {
        var tpl = qty === 1 ? i18n.qtyLabelOne : i18n.qtyLabelOther;
        label.textContent = ti(tpl, { count: qty, kwp: kwp });
      }

      var priceMain = document.getElementById('pdp-price-display');
      var priceOrig = document.getElementById('pdp-price-original');
      if (priceMain) priceMain.textContent = fmtEur(eff);
      if (priceOrig) {
        priceOrig.style.display = disc > 0 ? '' : 'none';
        priceOrig.textContent = fmtEur(BASE_PRICE_CENTS);
      }

      var atcLabel = document.getElementById('pdp-atc-label');
      if (atcLabel) atcLabel.textContent = ti(i18n.addToCart, { price: fmtEur(total) });

      var badge = document.getElementById('pdp-discount-badge');
      if (badge) {
        if (disc > 0) {
          badge.textContent = ti(i18n.discountBadge, { percent: Math.round(disc * 100) });
          badge.style.display = '';
        } else {
          badge.style.display = 'none';
        }
      }

      highlightActiveTier(qty);

      document.querySelectorAll('.pdp-buy__qty-preset').forEach(function (btn) {
        btn.classList.toggle('is-active', parseInt(btn.dataset.preset, 10) === qty);
      });

      var stickyPrice = document.getElementById('pdp-sticky-price');
      if (stickyPrice) {
        var discStr = disc > 0 ? ' <span style="color:var(--accent-deep);">–' + Math.round(disc * 100) + ' %</span>' : '';
        stickyPrice.innerHTML = qty + ' × ' + fmtEur(eff) + ' = <strong style="color:var(--ink);">' + fmtEur(total) + '</strong>' + discStr;
      }

      updateCompatibility();
    }

    var qtyDown    = scope.querySelector('#pdp-qty-down');
    var qtyUp      = scope.querySelector('#pdp-qty-up');
    var stickyDown = scope.querySelector('#pdp-sticky-qty-down');
    var stickyUp   = scope.querySelector('#pdp-sticky-qty-up');
    if (qtyDown)    qtyDown.addEventListener('click',    function () { updateQty(qty - 1); });
    if (qtyUp)      qtyUp.addEventListener('click',      function () { updateQty(qty + 1); });
    if (stickyDown) stickyDown.addEventListener('click', function () { updateQty(qty - 1); });
    if (stickyUp)   stickyUp.addEventListener('click',   function () { updateQty(qty + 1); });

    scope.querySelectorAll('.pdp-buy__qty-preset').forEach(function (btn) {
      btn.addEventListener('click', function () { updateQty(parseInt(this.dataset.preset, 10)); });
    });

    // ── Variant swatches ──
    scope.querySelectorAll('[data-pdp-swatch]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pos = parseInt(this.dataset.optionPos, 10);
        document.querySelectorAll('[data-option-pos="' + pos + '"]').forEach(function (b) { b.classList.remove('is-active'); });
        this.classList.add('is-active');

        var selected = {};
        document.querySelectorAll('[data-pdp-swatch].is-active').forEach(function (b) {
          selected[parseInt(b.dataset.optionPos, 10)] = b.dataset.value;
        });

        var match = allVariants.find(function (v) {
          return v.options.every(function (opt, i) { return opt === selected[i + 1]; });
        });
        if (match) {
          var vid = document.getElementById('pdp-variant-id');
          if (vid) vid.value = match.id;
        }
      });
    });

    // ── AJAX ATC ──
    function addToCart(variantId, quantity) {
      fetch('/cart/add.js', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: variantId, quantity: quantity })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.status) {
            showToast(i18n.errorPrefix + (data.description || ''));
          } else {
            showToast(ti(i18n.added, { count: quantity, title: PRODUCT_TITLE }));
            document.dispatchEvent(new CustomEvent('cart:item-added'));
          }
        })
        .catch(function () {
          var f = document.getElementById('pdp-form');
          if (f) f.submit();
        });
    }

    pdpForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var vid = parseInt(document.getElementById('pdp-variant-id').value, 10);
      addToCart(vid, qty);
    });

    var stickyAtc = scope.querySelector('#pdp-sticky-atc');
    if (stickyAtc) {
      stickyAtc.addEventListener('click', function () {
        var vid = parseInt(document.getElementById('pdp-variant-id').value, 10);
        addToCart(vid, qty);
      });
    }

    // ── Accordion ──
    scope.querySelectorAll('[data-accordion-trigger]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = this.closest('.pdp-accordion-item');
        var wasOpen = item.classList.contains('is-open');
        document.querySelectorAll('.pdp-accordion-item').forEach(function (i) { i.classList.remove('is-open'); });
        if (!wasOpen) item.classList.add('is-open');
      });
    });

    // ── Compatibility ──
    function updateCompatibility() {
      var sel = document.getElementById('pdp-inverter-select');
      if (!sel) return;
      var opt    = sel.options[sel.selectedIndex];
      var mppts  = parseInt(opt.dataset.mppts, 10);
      var vmax   = parseInt(opt.dataset.vmax, 10);
      var strMax = parseInt(opt.dataset.strMax, 10);
      var power  = parseInt(opt.dataset.power, 10);

      var maxPerStr     = Math.floor(vmax / VOC);
      var totalMax      = maxPerStr * mppts * strMax;
      var optimal       = Math.floor(power * 1.1 / (MODULE_KWP * 1000));
      var fits          = qty <= totalMax;
      var withinOptimal = qty <= optimal && qty >= Math.max(2, optimal - 6);

      var verdict = document.getElementById('pdp-compat-verdict');
      var icon    = document.getElementById('pdp-compat-icon');
      var title   = document.getElementById('pdp-compat-title');
      var sub     = document.getElementById('pdp-compat-sub');

      if (verdict && icon && title) {
        if (fits && withinOptimal) {
          verdict.style.background = 'var(--accent-soft)';
          icon.style.background = 'var(--accent-deep)'; icon.style.color = 'var(--accent-ink)';
          title.textContent = i18n.compatPerfect;
        } else if (fits && qty > optimal) {
          verdict.style.background = 'var(--sun-soft)';
          icon.style.background = 'var(--sun)'; icon.style.color = 'var(--ink)';
          title.textContent = i18n.compatSlightOver;
        } else if (fits) {
          verdict.style.background = 'var(--sun-soft)';
          icon.style.background = 'var(--sun)'; icon.style.color = 'var(--ink)';
          title.textContent = i18n.compatUnderLoaded;
        } else {
          verdict.style.background = 'oklch(0.92 0.06 30)';
          icon.style.background = 'oklch(0.55 0.18 30)'; icon.style.color = 'var(--ink)';
          title.textContent = i18n.compatTooMany;
        }
      }
      if (sub) {
        var kwp = (qty * MODULE_KWP).toFixed(2).replace('.', ',');
        sub.textContent = ti(i18n.compatSummary, {
          count: qty,
          power: Math.round(MODULE_KWP * 1000),
          kwp: kwp,
          inverter_kw: power / 1000,
          optimal: optimal
        });
      }

      var mpptEl  = document.getElementById('pdp-compat-mppts');
      var maxEl   = document.getElementById('pdp-compat-maxmod');
      var vocEl   = document.getElementById('pdp-compat-voc-sub');
      var totalEl = document.getElementById('pdp-compat-total');
      if (mpptEl)  mpptEl.textContent  = mppts;
      if (maxEl)   maxEl.textContent   = maxPerStr;
      if (vocEl)   vocEl.textContent   = i18n.vocLabel + ' ' + VOC + ' V';
      if (totalEl) totalEl.textContent = totalMax;
    }

    var invSelect = scope.querySelector('#pdp-inverter-select');
    if (invSelect) invSelect.addEventListener('change', updateCompatibility);

    // ── Init ──
    renderTierList();
    updateQty(1);
    onScroll();
  }

  // ── Sticky bar scroll (bound once on window) ──
  var scrollPending = false;
  function onScroll() {
    scrollPending = false;
    var stickyBar = document.getElementById('pdp-sticky-bar');
    if (!stickyBar) return;
    var buyAnchor = document.getElementById('buy-col-anchor');
    var show = buyAnchor ? buyAnchor.getBoundingClientRect().bottom < 80 : window.scrollY > 600;
    stickyBar.classList.toggle('is-visible', show);
    stickyBar.setAttribute('aria-hidden', show ? 'false' : 'true');
  }
  window.addEventListener('scroll', function () {
    if (!scrollPending) {
      scrollPending = true;
      requestAnimationFrame(onScroll);
    }
  }, { passive: true });

  init();
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
