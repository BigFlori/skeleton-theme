(function () {
  'use strict';

  var form = document.querySelector('[data-sw-search-form]');
  if (!form) return;
  var input = form.querySelector('[data-sw-search-input]');
  var clear = form.querySelector('[data-sw-search-clear]');
  if (!input || !clear) return;

  function toggle() {
    if (input.value.length > 0) clear.removeAttribute('hidden');
    else clear.setAttribute('hidden', '');
  }

  input.addEventListener('input', toggle);
  clear.addEventListener('click', function () {
    input.value = '';
    toggle();
    input.focus();
  });
})();
