(function () {
  'use strict';

  var cfg = window.swDrawerConfig;
  var drawerEl = document.getElementById('sw-cart-drawer');
  var backdropEl = document.querySelector('[data-cart-drawer-backdrop]');
  var toastEl = document.getElementById('sw-drawer-toast');
  var toastTimer;
  var mutating = false;
  var cartDirty = false;

  if (!drawerEl || !cfg) return;

  // ── Open / close ──────────────────────────────────────────────────────────

  function openDrawer() {
    drawerEl.classList.add('is-open');
    drawerEl.setAttribute('aria-hidden', 'false');
    if (backdropEl) backdropEl.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    var closeBtn = drawerEl.querySelector('[data-cart-drawer-close]');
    if (closeBtn) closeBtn.focus();
  }

  function closeDrawer() {
    drawerEl.classList.remove('is-open');
    drawerEl.setAttribute('aria-hidden', 'true');
    if (backdropEl) backdropEl.classList.remove('is-open');
    document.body.style.overflow = '';
    var trigger = document.querySelector('[data-cart-drawer-trigger]');
    if (trigger) trigger.focus();
  }

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg) {
    if (!toastEl) return;
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.hidden = false;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toastEl.classList.add('sw-toast--visible');
      });
    });
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('sw-toast--visible');
      setTimeout(function () { toastEl.hidden = true; }, 220);
    }, 4500);
  }

  // ── formatMoney ───────────────────────────────────────────────────────────

  function formatMoney(cents) {
    var fmt = cfg.moneyFormat;
    var re = /\{\{\s*(\w+)\s*\}\}/;
    function d(v, def) { return v === undefined ? def : v; }
    function delimit(n, prec, th, dec) {
      prec = d(prec, 2); th = d(th, ','); dec = d(dec, '.');
      n = (n / 100).toFixed(prec);
      var p = n.split('.');
      p[0] = p[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + th);
      return p[0] + (p[1] ? dec + p[1] : '');
    }
    var m = fmt.match(re);
    if (!m) return fmt;
    var val;
    switch (m[1]) {
      case 'amount':                                    val = delimit(cents, 2);           break;
      case 'amount_no_decimals':                        val = delimit(cents, 0);           break;
      case 'amount_with_comma_separator':               val = delimit(cents, 2, '.', ','); break;
      case 'amount_no_decimals_with_comma_separator':   val = delimit(cents, 0, '.', ','); break;
      case 'amount_with_space_separator':               val = delimit(cents, 2, ' ', '.'); break;
      case 'amount_no_decimals_with_space_separator':   val = delimit(cents, 0, ' ');      break;
      default:                                          val = delimit(cents, 2);
    }
    return fmt.replace(re, val);
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────

  function updateHeaderBadge(count) {
    var badge = document.querySelector('[data-cart-drawer-count]');
    if (!badge) return;
    badge.textContent = count;
    badge.hidden = (count === 0);
    var link = document.querySelector('[data-cart-drawer-trigger]');
    if (link) link.setAttribute('aria-label', cfg.strings.cartLabel + ' (' + count + ')');
  }

  function updateDrawerTitle(count) {
    var el = drawerEl.querySelector('[data-drawer-title]');
    if (!el) return;
    if (count === 0) {
      el.innerHTML = cfg.strings.titleEmpty;
    } else {
      el.innerHTML = count + ' ' + cfg.strings.items;
    }
  }

  function updateMeter(totalPrice) {
    var threshold = cfg.threshold;
    if (!threshold) return;
    var reached = totalPrice >= threshold;
    var pct = Math.min(100, Math.round((totalPrice / threshold) * 100));

    var card = drawerEl.querySelector('[data-drawer-meter-card]');
    var text = drawerEl.querySelector('[data-drawer-meter-text]');
    var fill = drawerEl.querySelector('[data-drawer-meter-fill]');
    var track = drawerEl.querySelector('[data-drawer-meter-track]');
    var icon = drawerEl.querySelector('[data-drawer-meter-icon]');

    if (card) card.classList.toggle('sw-cart-drawer__meter--done', reached);
    if (fill) fill.style.width = pct + '%';
    if (track) track.setAttribute('aria-valuenow', pct);

    if (icon) {
      icon.classList.toggle('sw-cart-drawer__meter-icon--done', reached);
      if (reached) {
        icon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      } else {
        icon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';
      }
    }

    if (text) {
      if (reached) {
        text.innerHTML = cfg.strings.shippingFree;
      } else {
        var rem = threshold - totalPrice;
        text.innerHTML = cfg.strings.shippingProgress.replace('__REMAINING__', formatMoney(rem));
      }
    }
  }

  function updateDrawerTotals(cart) {
    updateDrawerTitle(cart.item_count);
    updateHeaderBadge(cart.item_count);
    updateMeter(cart.total_price);
    var subtotalEl = drawerEl.querySelector('[data-drawer-subtotal]');
    if (subtotalEl) subtotalEl.textContent = formatMoney(cart.total_price);
  }

  function toggleEmptyState(isEmpty) {
    var emptyEl = drawerEl.querySelector('[data-drawer-empty]');
    var meterWrap = drawerEl.querySelector('[data-drawer-meter-wrap]');
    var itemsWrap = drawerEl.querySelector('[data-drawer-items-wrap]');
    var footer = drawerEl.querySelector('[data-drawer-footer]');
    if (emptyEl) emptyEl.hidden = !isEmpty;
    if (meterWrap) meterWrap.hidden = isEmpty;
    if (itemsWrap) itemsWrap.hidden = isEmpty;
    if (footer) footer.hidden = isEmpty;
  }

  function setLineLoading(lineIndex, on) {
    var el = drawerEl.querySelector('[data-drawer-line="' + lineIndex + '"]');
    if (el) el.classList.toggle('sw-cart-drawer__line--loading', on);
  }

  function getLineQty(lineIndex) {
    var el = drawerEl.querySelector('[data-drawer-qty-val="' + lineIndex + '"]');
    return el ? (parseInt(el.textContent, 10) || 1) : 1;
  }

  function reindexLines(removedIndex) {
    var i = removedIndex + 1;
    while (true) {
      var el = drawerEl.querySelector('[data-drawer-line="' + i + '"]');
      if (!el) break;
      var n = i - 1;
      el.dataset.drawerLine = n;
      var dec = el.querySelector('[data-drawer-dec]');       if (dec) dec.dataset.drawerDec = n;
      var inc = el.querySelector('[data-drawer-inc]');       if (inc) inc.dataset.drawerInc = n;
      var rem = el.querySelector('[data-drawer-remove]');    if (rem) rem.dataset.drawerRemove = n;
      var qty = el.querySelector('[data-drawer-qty-val]');   if (qty) qty.dataset.drawerQtyVal = n;
      var tot = el.querySelector('[data-drawer-line-total]');if (tot) tot.dataset.drawerLineTotal = n;
      var ech = el.querySelector('[data-drawer-line-each]'); if (ech) ech.dataset.drawerLineEach = n;
      i++;
    }
  }

  // ── Cart AJAX ─────────────────────────────────────────────────────────────

  async function changeQty(lineIndex, newQty) {
    if (mutating) return;
    mutating = true;
    setLineLoading(lineIndex, true);

    try {
      var res = await fetch('/cart/change.js', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: 'line=' + lineIndex + '&quantity=' + newQty
      });

      if (!res.ok) {
        var errData = null;
        try { errData = await res.json(); } catch (_) {}
        throw new Error((errData && (errData.description || errData.message)) || cfg.strings.errorGeneric);
      }

      var cart = await res.json();

      if (newQty === 0) {
        var lineEl = drawerEl.querySelector('[data-drawer-line="' + lineIndex + '"]');
        if (lineEl) lineEl.remove();
        reindexLines(lineIndex);

        if (cart.item_count === 0) {
          toggleEmptyState(true);
          updateDrawerTitle(0);
          updateHeaderBadge(0);
          updateMeter(0);
        } else {
          updateDrawerTotals(cart);
        }
      } else {
        var item = cart.items[lineIndex - 1];
        var qtyEl = drawerEl.querySelector('[data-drawer-qty-val="' + lineIndex + '"]');
        if (qtyEl) qtyEl.textContent = item ? item.quantity : newQty;

        if (item) {
          var totalEl = drawerEl.querySelector('[data-drawer-line-total="' + lineIndex + '"]');
          if (totalEl) totalEl.textContent = formatMoney(item.line_price);

          var eachEl = drawerEl.querySelector('[data-drawer-line-each="' + lineIndex + '"]');
          if (eachEl) {
            if (item.quantity > 1) {
              eachEl.textContent = item.quantity + ' × ' + formatMoney(item.price);
              eachEl.hidden = false;
            } else {
              eachEl.hidden = true;
            }
          }
        }
        updateDrawerTotals(cart);
        setLineLoading(lineIndex, false);
      }
    } catch (err) {
      console.error('[sw-drawer]', err.message);
      setLineLoading(lineIndex, false);
      showToast(err.message || cfg.strings.errorGeneric);
    } finally {
      mutating = false;
    }
  }

  // ── Refresh drawer via Section Rendering API ──────────────────────────────
  // Used after adding an upsell item (new line appears) or external add-to-cart.

  async function refreshDrawerContent() {
    try {
      var localeRoot = (cfg.rootUrl || '/').replace(/\/+$/, '');
      var res = await fetch(localeRoot + '?sections=cart-drawer', { credentials: 'same-origin' });
      if (!res.ok) return;
      var data = await res.json();
      if (!data['cart-drawer']) return;

      var parser = new DOMParser();
      var doc = parser.parseFromString(data['cart-drawer'], 'text/html');
      var newDrawer = doc.getElementById('sw-cart-drawer');
      if (!newDrawer) return;

      // Replace inner content only — preserves is-open class and aria state on the aside
      drawerEl.innerHTML = newDrawer.innerHTML;

      updateHeaderBadge(parseInt(newDrawer.dataset.itemCount, 10) || 0);
    } catch (err) {
      console.error('[sw-drawer] refresh failed:', err);
    }
  }

  // ── Upsell add ────────────────────────────────────────────────────────────

  async function addUpsell(variantId, btn) {
    btn.disabled = true;
    try {
      var res = await fetch('/cart/add.js', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: parseInt(variantId, 10), quantity: 1 })
      });
      if (!res.ok) {
        var d = await res.json();
        throw new Error((d && (d.description || d.message)) || cfg.strings.errorGeneric);
      }
      await refreshDrawerContent();
    } catch (err) {
      showToast(err.message || cfg.strings.errorGeneric);
      btn.disabled = false;
    }
  }

  // ── Event delegation ──────────────────────────────────────────────────────

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-cart-drawer-trigger]')) {
      e.preventDefault();
      if (cartDirty) {
        refreshDrawerContent().then(function () {
          cartDirty = false;
          openDrawer();
        });
      } else {
        openDrawer();
      }
      return;
    }

    if (e.target.closest('[data-cart-drawer-close]') || e.target === backdropEl) {
      closeDrawer();
      return;
    }

    var dec = e.target.closest('[data-drawer-dec]');
    if (dec) {
      var li = parseInt(dec.dataset.drawerDec, 10);
      var qty = getLineQty(li);
      changeQty(li, qty <= 1 ? 0 : qty - 1);
      return;
    }

    var inc = e.target.closest('[data-drawer-inc]');
    if (inc) {
      var liInc = parseInt(inc.dataset.drawerInc, 10);
      changeQty(liInc, getLineQty(liInc) + 1);
      return;
    }

    var rem = e.target.closest('[data-drawer-remove]');
    if (rem) {
      changeQty(parseInt(rem.dataset.drawerRemove, 10), 0);
      return;
    }

    var upsell = e.target.closest('[data-drawer-upsell-add]');
    if (upsell) {
      addUpsell(upsell.dataset.drawerUpsellAdd, upsell);
      return;
    }
  });

  var FOCUSABLE_SEL = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function getFocusable() {
    return Array.from(drawerEl.querySelectorAll(FOCUSABLE_SEL)).filter(function (el) {
      return !el.closest('[hidden]');
    });
  }

  document.addEventListener('keydown', function (e) {
    if (!drawerEl.classList.contains('is-open')) return;

    if (e.key === 'Escape') {
      closeDrawer();
      return;
    }

    if (e.key === 'Tab') {
      var focusable = getFocusable();
      if (!focusable.length) { e.preventDefault(); return; }
      var first = focusable[0];
      var last  = focusable[focusable.length - 1];
      var active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !drawerEl.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !drawerEl.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });

  // ── External add-to-cart integration ─────────────────────────────────────
  // Dispatch `cart:item-added` to refresh the drawer and open it immediately.
  // Dispatch `cart:changed` to mark the drawer stale without opening it
  // (the drawer will refresh lazily the next time the user opens it).

  document.addEventListener('cart:item-added', function () {
    refreshDrawerContent().then(openDrawer);
  });

  document.addEventListener('cart:changed', function () {
    cartDirty = true;
  });

  // ── Cross-tab stale state ─────────────────────────────────────────────────
  // When the user switches back to this tab, the server-side cart may have
  // changed (another tab added/removed items). If the drawer is open, refresh
  // it immediately so qty controls always operate on current line data.
  // If the drawer is closed, mark dirty so the next open fetches fresh content.

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (drawerEl.classList.contains('is-open')) {
      refreshDrawerContent();
    } else {
      cartDirty = true;
    }
  });

})();
