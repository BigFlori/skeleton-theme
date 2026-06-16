(function () {
  'use strict';

  var cfg = window.swDrawerConfig;
  var drawerEl = document.getElementById('sw-cart-drawer');
  var backdropEl = document.querySelector('[data-cart-drawer-backdrop]');
  var toastEl = document.getElementById('sw-drawer-toast');
  var cartDirty = false;

  if (!drawerEl || !cfg) return;

  // ── Open / close ──────────────────────────────────────────────────────────

  function openDrawer() {
    drawerEl.classList.add('is-open');
    drawerEl.setAttribute('aria-hidden', 'false');
    if (backdropEl) backdropEl.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    var closeBtn = drawerEl.querySelector('[data-cart-drawer-close]');
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  }

  function closeDrawer() {
    drawerEl.classList.remove('is-open');
    drawerEl.setAttribute('aria-hidden', 'true');
    if (backdropEl) backdropEl.classList.remove('is-open');
    document.body.style.overflow = '';
    var trigger = document.querySelector('[data-cart-drawer-trigger]');
    if (trigger) trigger.focus({ preventScroll: true });
  }

  function showToast(msg) { SwUtils.toast(toastEl, msg); }
  function formatMoney(cents) { return SwUtils.formatMoney(cents, cfg.moneyFormat); }

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

  function updateDrawerTotals(cart) {
    updateDrawerTitle(cart.item_count);
    updateHeaderBadge(cart.item_count);
    var subtotalEl = drawerEl.querySelector('[data-drawer-subtotal]');
    if (subtotalEl) subtotalEl.textContent = formatMoney(cart.total_price);
  }

  function toggleEmptyState(isEmpty) {
    var emptyEl = drawerEl.querySelector('[data-drawer-empty]');
    var itemsWrap = drawerEl.querySelector('[data-drawer-items-wrap]');
    var footer = drawerEl.querySelector('[data-drawer-footer]');
    if (emptyEl) emptyEl.hidden = !isEmpty;
    if (itemsWrap) itemsWrap.hidden = isEmpty;
    if (footer) footer.hidden = isEmpty;
  }

  function getLineQty(lineEl) {
    var el = lineEl && lineEl.querySelector('[data-drawer-qty-val]');
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

  // Mutations run through one promise chain so overlapping requests can't race
  // on line indices. Rapid +/- clicks update the displayed quantity optimistically
  // and coalesce into ONE request with the final absolute quantity — instead of
  // being silently dropped while a request is in flight. Pending state is anchored
  // to the line ELEMENT (not its index), so it survives index reshuffles on removal.
  var queue = Promise.resolve();
  var DEBOUNCE_MS = 300;

  function enqueue(task) {
    queue = queue.then(task, task);
    return queue;
  }

  function queueQtyChange(lineEl, newQty) {
    if (!lineEl) return;
    // Optimistic display so successive clicks accumulate from the latest value.
    // Don't dim here — that blocks further clicks (pointer-events: none) and
    // defeats the coalescing. Dimming happens once the request actually fires.
    var qtyEl = lineEl.querySelector('[data-drawer-qty-val]');
    if (qtyEl) qtyEl.textContent = newQty;
    lineEl._swTarget = newQty;
    clearTimeout(lineEl._swTimer);
    lineEl._swTimer = setTimeout(function () {
      var target = lineEl._swTarget;
      enqueue(function () { return commitQty(lineEl, target); });
    }, DEBOUNCE_MS);
  }

  function removeLine(lineEl) {
    if (!lineEl) return;
    clearTimeout(lineEl._swTimer);               // cancel any pending qty change
    lineEl.classList.add('sw-cart-drawer__line--loading');
    enqueue(function () { return commitQty(lineEl, 0); });
  }

  async function commitQty(lineEl, newQty) {
    if (!lineEl.isConnected) return;             // line already removed/refreshed
    var lineIndex = parseInt(lineEl.dataset.drawerLine, 10);
    lineEl.classList.add('sw-cart-drawer__line--loading');

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
        lineEl.remove();
        reindexLines(lineIndex);

        if (cart.item_count === 0) {
          toggleEmptyState(true);
          updateDrawerTitle(0);
          updateHeaderBadge(0);
        } else {
          updateDrawerTotals(cart);
        }
      } else {
        // Reconcile from server truth (it may have capped the quantity).
        var item = cart.items[lineIndex - 1];
        var qtyEl = lineEl.querySelector('[data-drawer-qty-val]');
        if (qtyEl) qtyEl.textContent = item ? item.quantity : newQty;

        if (item) {
          var totalEl = lineEl.querySelector('[data-drawer-line-total]');
          if (totalEl) totalEl.textContent = formatMoney(item.line_price);

          var eachEl = lineEl.querySelector('[data-drawer-line-each]');
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
        lineEl.classList.remove('sw-cart-drawer__line--loading');
      }
    } catch (err) {
      console.error('[sw-drawer]', err.message);
      lineEl.classList.remove('sw-cart-drawer__line--loading');
      showToast(err.message || cfg.strings.errorGeneric);
      refreshDrawerContent();                    // revert optimistic UI to truth
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
      var lineDec = dec.closest('[data-drawer-line]');
      var qty = getLineQty(lineDec);
      if (qty <= 1) removeLine(lineDec);
      else queueQtyChange(lineDec, qty - 1);
      return;
    }

    var inc = e.target.closest('[data-drawer-inc]');
    if (inc) {
      var lineInc = inc.closest('[data-drawer-line]');
      queueQtyChange(lineInc, getLineQty(lineInc) + 1);
      return;
    }

    var rem = e.target.closest('[data-drawer-remove]');
    if (rem) {
      removeLine(rem.closest('[data-drawer-line]'));
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
