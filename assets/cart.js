(function () {
  'use strict';

  var cfg          = window.swCartConfig;
  var toastEl      = document.getElementById('sw-cart-toast');
  var settingValue = false;
  var mutating     = false;
  var lastCartFingerprint = null;

  function cartFingerprint(cart) {
    var parts = cart.items.map(function (i) { return i.variant_id + 'x' + i.quantity; });
    return cart.item_count + ':' + cart.total_price + ':' + parts.join(',');
  }

  function formatMoney(cents) { return SwUtils.formatMoney(cents, cfg.moneyFormat); }
  function showToast(msg, opts) { SwUtils.toast(toastEl, msg, opts); }

  function setLineLoading(lineIndex, on) {
    var el = document.querySelector('[data-line="' + lineIndex + '"]');
    if (el) el.classList.toggle('sw-cart-line--loading', on);
  }

  function updateCartTotals(cart) {
    var grandTotal = cart.total_price + cfg.fee;

    var countEl = document.querySelector('[data-cart-count]');
    if (countEl) countEl.textContent = cart.item_count + ' ' + cfg.strings.items;

    var subtotalEl     = document.querySelector('[data-cart-subtotal]');
    var shippingValEl  = document.querySelector('[data-cart-shipping-value]');
    var shippingNoteEl = document.querySelector('[data-cart-shipping-note]');
    var grandTotalEl   = document.querySelector('[data-cart-grand-total]');

    if (subtotalEl)     subtotalEl.textContent     = formatMoney(cart.total_price);
    if (shippingValEl)  shippingValEl.textContent  = formatMoney(cfg.fee);
    if (shippingNoteEl) shippingNoteEl.textContent = cfg.strings.shippingNote;
    if (grandTotalEl)   grandTotalEl.textContent   = formatMoney(grandTotal);

    var liveEl = document.getElementById('sw-cart-live');
    if (liveEl) liveEl.textContent = cart.item_count + ' ' + cfg.strings.items + ' — ' + formatMoney(grandTotal);
  }

  function updateCartDOM(cart, lineIndex) {
    updateCartTotals(cart);

    var item = cart.items[lineIndex - 1];
    if (item) {
      var qtyInput = document.querySelector('[data-cart-qty="' + lineIndex + '"]');
      if (qtyInput) {
        settingValue = true;
        qtyInput.value = item.quantity;
        qtyInput.dataset.prevQty = item.quantity;
        settingValue = false;
      }

      var totalEl = document.querySelector('[data-line-total="' + lineIndex + '"]');
      if (totalEl) totalEl.textContent = formatMoney(item.line_price);

      var eachEl = document.querySelector('[data-line-each="' + lineIndex + '"]');
      if (eachEl) {
        if (item.quantity > 1) {
          eachEl.textContent = formatMoney(item.price) + ' ' + cfg.strings.each;
          eachEl.hidden = false;
        } else {
          eachEl.hidden = true;
        }
      }
    }

    setLineLoading(lineIndex, false);
  }

  function getFocusTargetAfterRemoval(lineIndex) {
    var next = document.querySelector('[data-line="' + (lineIndex + 1) + '"]');
    if (next) return next.querySelector('[data-cart-remove]') || next.querySelector('a') || next;
    var prev = document.querySelector('[data-line="' + (lineIndex - 1) + '"]');
    if (prev) return prev.querySelector('[data-cart-remove]') || prev.querySelector('a') || prev;
    var countEl = document.querySelector('[data-cart-count]');
    if (countEl) { if (!countEl.getAttribute('tabindex')) countEl.setAttribute('tabindex', '-1'); return countEl; }
    return null;
  }

  function reindexLines(removedIndex) {
    var i = removedIndex + 1;
    while (true) {
      var el = document.querySelector('[data-line="' + i + '"]');
      if (!el) break;
      var n = i - 1;
      el.dataset.line = n;
      var dec = el.querySelector('[data-cart-dec]');    if (dec) dec.dataset.cartDec    = n;
      var inc = el.querySelector('[data-cart-inc]');    if (inc) inc.dataset.cartInc    = n;
      var rem = el.querySelector('[data-cart-remove]'); if (rem) rem.dataset.cartRemove = n;
      var qty = el.querySelector('[data-cart-qty]');    if (qty) qty.dataset.cartQty    = n;
      var tot = el.querySelector('[data-line-total]');  if (tot) tot.dataset.lineTotal  = n;
      var ech = el.querySelector('[data-line-each]');   if (ech) ech.dataset.lineEach   = n;
      i++;
    }
  }

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
      lastCartFingerprint = cartFingerprint(cart);
      // Mark the global cart drawer stale so it refreshes on next open.
      document.dispatchEvent(new CustomEvent('cart:changed'));
      if (newQty === 0) {
        var lineEl  = document.querySelector('[data-line="' + lineIndex + '"]');
        var focusEl = getFocusTargetAfterRemoval(lineIndex);
        if (lineEl) lineEl.remove();
        reindexLines(lineIndex);
        if (cart.item_count === 0) {
          showEmptyCart();
        } else {
          updateCartDOM(cart, lineIndex);
          updateCheckoutButton();
          if (focusEl) focusEl.focus();
        }
      } else {
        updateCartDOM(cart, lineIndex);
      }
    } catch (err) {
      setLineLoading(lineIndex, false);
      var failedInput = document.querySelector('[data-cart-qty="' + lineIndex + '"]');
      if (failedInput && failedInput.dataset.prevQty) {
        settingValue = true;
        failedInput.value = failedInput.dataset.prevQty;
        settingValue = false;
      }
      showToast(err.message || cfg.strings.errorGeneric);
    } finally {
      mutating = false;
    }
  }

  function updateCheckoutButton() {
    var btn  = document.querySelector('.sw-cart-summary__checkout-btn');
    var note = document.querySelector('.sw-cart-summary__unavailable-note');
    var hasUnavailable = !!document.querySelector('[data-unavailable]');
    if (btn)  { btn.disabled = hasUnavailable; btn.setAttribute('aria-disabled', hasUnavailable ? 'true' : 'false'); }
    if (note) note.hidden = !hasUnavailable;
  }

  function showEmptyCart() {
    var emptyEl = document.querySelector('[data-cart-empty]');
    var fullEl  = document.querySelector('[data-cart-full]');
    if (fullEl)  fullEl.hidden  = true;
    if (emptyEl) {
      emptyEl.hidden = false;
      var focusTarget = emptyEl.querySelector('h1, a, button');
      if (focusTarget) {
        if (!focusTarget.getAttribute('tabindex')) focusTarget.setAttribute('tabindex', '-1');
        focusTarget.focus();
      }
    }
  }

  function getLineQty(lineIndex) {
    var input = document.querySelector('[data-cart-qty="' + lineIndex + '"]');
    return input ? (parseInt(input.value, 10) || 1) : 1;
  }

  async function addUpsell(variantId, btn) {
    btn.disabled = true;
    try {
      var res = await fetch('/cart/add.js', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity: 1 })
      });
      if (!res.ok) {
        var d = null;
        try { d = await res.json(); } catch (_) {}
        throw new Error((d && (d.description || d.message)) || cfg.strings.errorGeneric);
      }
      var cartRes = await fetch('/cart.js', { headers: { 'Accept': 'application/json' } });
      var cart = await cartRes.json();
      lastCartFingerprint = cartFingerprint(cart);
      document.dispatchEvent(new CustomEvent('cart:changed'));
      updateCartTotals(cart);
      showToast(cfg.strings.upsellAdded);
    } catch (err) {
      showToast(err.message || cfg.strings.errorGeneric);
    } finally {
      btn.disabled = false;
    }
  }

  document.addEventListener('click', function (e) {
    var dec = e.target.closest('[data-cart-dec]');
    if (dec) {
      var li = parseInt(dec.dataset.cartDec, 10);
      var qty = getLineQty(li);
      changeQty(li, qty <= 1 ? 0 : qty - 1);
      return;
    }
    var inc = e.target.closest('[data-cart-inc]');
    if (inc) {
      var liInc = parseInt(inc.dataset.cartInc, 10);
      var incInput = document.querySelector('[data-cart-qty="' + liInc + '"]');
      var incMax = incInput && incInput.dataset.max ? parseInt(incInput.dataset.max, 10) : Infinity;
      var incQty = getLineQty(liInc);
      if (incQty >= incMax) {
        if (incInput && incInput.dataset.maxMsg) showToast(incInput.dataset.maxMsg);
        return;
      }
      changeQty(liInc, incQty + 1);
      return;
    }
    var rem = e.target.closest('[data-cart-remove]');
    if (rem) {
      changeQty(parseInt(rem.dataset.cartRemove, 10), 0);
      return;
    }
    var upsellBtn = e.target.closest('[data-upsell-add]');
    if (upsellBtn) {
      addUpsell(parseInt(upsellBtn.dataset.upsellAdd, 10), upsellBtn);
    }
  });

  async function captureCartFingerprint() {
    try {
      var res = await fetch('/cart.js', { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return;
      var cart = await res.json();
      if (lastCartFingerprint === null) lastCartFingerprint = cartFingerprint(cart);
    } catch (_) {}
  }

  document.addEventListener('visibilitychange', async function () {
    if (document.visibilityState !== 'visible') return;
    if (mutating) return;
    if (lastCartFingerprint === null) { captureCartFingerprint(); return; }
    try {
      var res = await fetch('/cart.js', { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return;
      var cart = await res.json();
      if (cartFingerprint(cart) !== lastCartFingerprint) window.location.reload();
    } catch (_) {}
  });

  captureCartFingerprint();

  document.addEventListener('change', function (e) {
    if (settingValue) return;
    var input = e.target.closest('[data-cart-qty]');
    if (!input) return;
    var line     = parseInt(input.dataset.cartQty, 10);
    var maxStock = input.dataset.max ? parseInt(input.dataset.max, 10) : 999;
    var raw      = parseInt(input.value, 10);
    if (!isNaN(raw) && raw === 0) {
      settingValue = true;
      input.value = input.dataset.prevQty || 1;
      settingValue = false;
      changeQty(line, 0);
      return;
    }
    var val = Math.max(1, Math.min(maxStock, isNaN(raw) ? 1 : raw));
    if (isNaN(raw) || raw < 1) showToast(cfg.strings.qtyMin);
    else if (raw > maxStock && input.dataset.maxMsg) showToast(input.dataset.maxMsg);
    settingValue = true;
    input.value = val;
    settingValue = false;
    changeQty(line, val);
  });
})();
