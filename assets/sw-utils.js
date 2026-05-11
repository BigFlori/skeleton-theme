/* Sonnwerk — shared front-end utilities (formatMoney, toast) */
(function () {
  'use strict';

  var SwUtils = window.SwUtils = window.SwUtils || {};

  SwUtils.formatMoney = function (cents, fmt) {
    var re = /\{\{\s*(\w+)\s*\}\}/;
    function delimit(n, prec, th, dec) {
      th = th == null ? ',' : th;
      dec = dec == null ? '.' : dec;
      n = (n / 100).toFixed(prec);
      var p = n.split('.');
      p[0] = p[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + th);
      return p[0] + (p[1] ? dec + p[1] : '');
    }
    var m = fmt.match(re);
    if (!m) return fmt;
    var val;
    switch (m[1]) {
      case 'amount':                                  val = delimit(cents, 2);           break;
      case 'amount_no_decimals':                      val = delimit(cents, 0);           break;
      case 'amount_with_comma_separator':             val = delimit(cents, 2, '.', ','); break;
      case 'amount_no_decimals_with_comma_separator': val = delimit(cents, 0, '.', ','); break;
      case 'amount_with_space_separator':             val = delimit(cents, 2, ' ', '.'); break;
      case 'amount_no_decimals_with_space_separator': val = delimit(cents, 0, ' ');      break;
      default:                                        val = delimit(cents, 2);
    }
    return fmt.replace(re, val);
  };

  SwUtils.toast = function (el, msg, opts) {
    if (!el) return;
    opts = opts || {};
    clearTimeout(el._swTimer);
    el.innerHTML = '';
    el.hidden = false;

    var msgNode = document.createElement('span');
    msgNode.textContent = msg;
    el.appendChild(msgNode);

    if (opts.actionLabel && opts.actionFn) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sw-toast__action';
      btn.textContent = opts.actionLabel;
      btn.addEventListener('click', opts.actionFn);
      el.appendChild(btn);
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add('sw-toast--visible');
      });
    });

    el._swTimer = setTimeout(function () {
      el.classList.remove('sw-toast--visible');
      setTimeout(function () { el.hidden = true; }, 220);
    }, opts.duration || 4500);
  };
})();
