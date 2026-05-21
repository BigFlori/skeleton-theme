(function () {
  'use strict';

  var els = document.querySelectorAll('.js-format-hun-phone');
  if (!els.length) return;

  els.forEach(function (el) {
    var raw = el.dataset.raw || el.textContent;
    el.textContent = formatHunPhone(raw);
  });

  function formatHunPhone(raw) {
    var digits = raw.replace(/[^\d]/g, '');

    if (raw.match(/^06/)) {
      digits = '36' + digits.slice(2);
    } else if (raw.match(/^\+36/)) {
      digits = '36' + digits.slice(2);
    } else {
      return raw;
    }

    var local = digits.slice(2);

    if (local.charAt(0) === '1' && local.length === 8) {
      return '+36 1 ' + local.slice(1, 4) + ' ' + local.slice(4);
    }
    if (local.length === 9) {
      return '+36 ' + local.slice(0, 2) + ' ' + local.slice(2, 5) + ' ' + local.slice(5);
    }
    if (local.length === 8) {
      return '+36 ' + local.slice(0, 2) + ' ' + local.slice(2, 5) + ' ' + local.slice(5);
    }
    return raw;
  }
})();
