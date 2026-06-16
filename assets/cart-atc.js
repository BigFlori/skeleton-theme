/*
 * Add-to-cart (global)
 * --------------------
 * Single delegated click handler for any [data-atc-id] button rendered by a
 * product card (collection-product-card.liquid). Loaded globally from
 * theme.liquid so the cards work on every page — collection grids, the PDP
 * recently-viewed carousel, etc. — without each section shipping its own
 * handler.
 *
 * Depends on the globally rendered cart-drawer section for:
 *   - #sw-drawer-toast            (error toast target)
 *   - window.swDrawerConfig.strings.errorAddCart / errorGeneric
 *
 * On success it dispatches `cart:item-added`, which cart-drawer.js listens for
 * to refresh the drawer (incl. the header cart badge) and open it.
 */
(function () {
  'use strict';

  var cfg     = window.swDrawerConfig || {};
  var strings = cfg.strings || {};

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

      // cart-drawer.js refreshes the drawer AND the header badge from the
      // re-rendered section in response to this event — no extra /cart.js
      // round-trip needed here.
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAddToCart);
  } else {
    initAddToCart();
  }
})();
