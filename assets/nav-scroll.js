(function () {
  'use strict';

  var nav = document.querySelector('.sw-nav');
  if (!nav) return;

  var pending = false;
  function update() {
    pending = false;
    nav.classList.toggle('sw-nav--scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', function () {
    if (!pending) {
      pending = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();
})();
