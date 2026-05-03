(function () {
  var cfg          = window.swCartConfig;
  var toast          = document.getElementById('sw-cart-toast');
  var toastTimer;
  var settingValue = false;

  function hideToast() {
    clearTimeout(toastTimer);
    toast.classList.remove('sw-toast--visible');
    setTimeout(function () { toast.hidden = true; }, 220);
  }

  function showToast(msg, actionLabel, actionFn, duration) {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.innerHTML = '';
    toast.hidden = false;
    requestAnimationFrame(function () {
      var msgNode = document.createElement('span');
      msgNode.textContent = msg;
      toast.appendChild(msgNode);
      if (actionLabel && actionFn) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sw-toast__action';
        btn.textContent = actionLabel;
        btn.addEventListener('click', function () { actionFn(); });
        toast.appendChild(btn);
      }
      toast.classList.add('sw-toast--visible');
    });
    toastTimer = setTimeout(function () {
      toast.classList.remove('sw-toast--visible');
      setTimeout(function () { toast.hidden = true; }, 220);
    }, duration || 4500);
  }

  function setLineLoading(lineIndex, on) {
    var el = document.querySelector('[data-line="' + lineIndex + '"]');
    if (el) el.classList.toggle('sw-cart-line--loading', on);
  }

  function formatMoney(cents) {
    var fmt = cfg.moneyFormat;
    var re  = /\{\{\s*(\w+)\s*\}\}/;
    function d(o, def) { return typeof o === 'undefined' ? def : o; }
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
      case 'amount':                                  val = delimit(cents, 2);        break;
      case 'amount_no_decimals':                      val = delimit(cents, 0);        break;
      case 'amount_with_comma_separator':             val = delimit(cents, 2, '.', ','); break;
      case 'amount_no_decimals_with_comma_separator':  val = delimit(cents, 0, '.', ','); break;
      case 'amount_with_space_separator':              val = delimit(cents, 2, ' ', '.'); break;
      case 'amount_no_decimals_with_space_separator':  val = delimit(cents, 0, ' ');      break;
      default:                                         val = delimit(cents, 2);
    }
    return fmt.replace(re, val);
  }

  function updateCartTotals(cart) {
    var shippingFree = cart.total_price >= cfg.threshold;
    var grandTotal   = shippingFree ? cart.total_price : cart.total_price + cfg.fee;

    var countEl = document.querySelector('[data-cart-count]');
    if (countEl) countEl.textContent = cart.item_count + ' ' + cfg.strings.items;

    var subtotalEl     = document.querySelector('[data-cart-subtotal]');
    var shippingValEl  = document.querySelector('[data-cart-shipping-value]');
    var shippingNoteEl = document.querySelector('[data-cart-shipping-note]');
    var grandTotalEl   = document.querySelector('[data-cart-grand-total]');

    if (subtotalEl)     subtotalEl.textContent     = formatMoney(cart.total_price);
    if (shippingValEl)  shippingValEl.textContent  = shippingFree ? cfg.strings.shippingFree : formatMoney(cfg.fee);
    if (shippingNoteEl) shippingNoteEl.textContent = shippingFree ? cfg.strings.shippingFreeNote : cfg.strings.shippingPaidNote;
    if (grandTotalEl)   grandTotalEl.textContent   = formatMoney(grandTotal);

    var liveEl = document.getElementById('sw-cart-live');
    if (liveEl) liveEl.textContent = cart.item_count + ' ' + cfg.strings.items + ' — ' + formatMoney(grandTotal);

    var freeShipFill  = document.querySelector('[data-free-ship-fill]');
    var freeShipLabel = document.querySelector('[data-free-ship-label]');
    var freeShipTrack = freeShipFill && freeShipFill.closest('[role="progressbar"]');
    if (freeShipFill) {
      var pct = Math.min(100, Math.round(cart.total_price / cfg.threshold * 100));
      freeShipFill.style.width = pct + '%';
      if (freeShipTrack) freeShipTrack.setAttribute('aria-valuenow', pct);
      if (shippingFree) {
        freeShipFill.classList.add('sw-free-ship-bar__fill--done');
        if (freeShipLabel) freeShipLabel.textContent = cfg.strings.freeShipUnlocked;
      } else {
        freeShipFill.classList.remove('sw-free-ship-bar__fill--done');
        if (freeShipLabel) {
          var rem = cfg.threshold - cart.total_price;
          freeShipLabel.textContent = cfg.strings.freeShipProgress.replace('__AMOUNT__', formatMoney(rem));
        }
      }
    }
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
      var dec = el.querySelector('[data-cart-dec]');   if (dec)   dec.dataset.cartDec   = n;
      var inc = el.querySelector('[data-cart-inc]');   if (inc)   inc.dataset.cartInc   = n;
      var rem = el.querySelector('[data-cart-remove]');if (rem)   rem.dataset.cartRemove = n;
      var qty = el.querySelector('[data-cart-qty]');   if (qty)   qty.dataset.cartQty   = n;
      var tot = el.querySelector('[data-line-total]'); if (tot)   tot.dataset.lineTotal  = n;
      var ech = el.querySelector('[data-line-each]');  if (ech)   ech.dataset.lineEach   = n;
      i++;
    }
  }

  async function changeQty(lineIndex, newQty) {
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
        console.error('[sw-cart] change failed:', res.status, errData);
        var apiError = errData ? (errData.description || errData.message) : null;
        throw new Error(apiError || cfg.strings.errorGeneric);
      }
      var cart = await res.json();
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
      console.error('[sw-cart]', err.message);
      setLineLoading(lineIndex, false);
      var failedInput = document.querySelector('[data-cart-qty="' + lineIndex + '"]');
      if (failedInput && failedInput.dataset.prevQty) {
        settingValue = true;
        failedInput.value = failedInput.dataset.prevQty;
        settingValue = false;
      }
      var msg = (err.message === 'Failed to fetch' || err.message.indexOf('HTTP') === 0)
        ? cfg.strings.errorGeneric
        : err.message;
      showToast(msg || cfg.strings.errorGeneric);
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

  document.addEventListener('click', function (e) {
    var dec = e.target.closest('[data-cart-dec]');
    if (dec) {
      var line = parseInt(dec.dataset.cartDec, 10);
      var qty  = getLineQty(line);
      if (qty <= 1) { changeQty(line, 0); } else { changeQty(line, qty - 1); }
      return;
    }
    var inc = e.target.closest('[data-cart-inc]');
    if (inc) {
      var line = parseInt(inc.dataset.cartInc, 10);
      var incInput = document.querySelector('[data-cart-qty="' + line + '"]');
      var incMax = incInput && incInput.dataset.max ? parseInt(incInput.dataset.max, 10) : Infinity;
      var incQty = getLineQty(line);
      if (incQty >= incMax) {
        if (incInput && incInput.dataset.maxMsg) showToast(incInput.dataset.maxMsg);
        return;
      }
      changeQty(line, incQty + 1);
      return;
    }
    var rem = e.target.closest('[data-cart-remove]');
    if (rem) {
      changeQty(parseInt(rem.dataset.cartRemove, 10), 0);
      return;
    }
    var upsellBtn = e.target.closest('[data-upsell-add]');
    if (upsellBtn) {
      upsellBtn.disabled = true;
      fetch('/cart/add.js', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: parseInt(upsellBtn.dataset.upsellAdd, 10), quantity: 1 })
      })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (d) { throw new Error(d.description || cfg.strings.errorGeneric); });
        return fetch('/cart.js', { headers: { 'Accept': 'application/json' } });
      })
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        updateCartTotals(cart);
        showToast(cfg.strings.upsellAdded);
        upsellBtn.disabled = false;
      })
      .catch(function (err) {
        showToast(err.message || cfg.strings.errorGeneric);
        upsellBtn.disabled = false;
      });
    }
  });

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
