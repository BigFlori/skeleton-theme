(function () {
  'use strict';

  function init(scope) {
    scope = scope || document;

    var list = scope.querySelector('#sw-faq-list');
    if (!list) return;

    var items = list.querySelectorAll('.sw-faq__item');

    items.forEach(function (item) {
      var trigger = item.querySelector('.sw-faq__trigger');
      var answer  = item.querySelector('.sw-faq__answer');
      var inner   = item.querySelector('.sw-faq__answer-inner');

      trigger.addEventListener('click', function () {
        var isOpen = item.classList.contains('sw-faq__item--open');

        items.forEach(function (el) {
          el.classList.remove('sw-faq__item--open');
          el.querySelector('.sw-faq__trigger').setAttribute('aria-expanded', 'false');
          el.querySelector('.sw-faq__answer').style.maxHeight = '0';
        });

        if (!isOpen) {
          item.classList.add('sw-faq__item--open');
          trigger.setAttribute('aria-expanded', 'true');
          answer.style.maxHeight = inner.scrollHeight + 'px';
        }
      });
    });
  }

  init();
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
