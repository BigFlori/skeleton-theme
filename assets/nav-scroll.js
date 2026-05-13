(function () {
  'use strict';

  var nav = document.querySelector('.sw-nav');
  var shim = document.querySelector('.sw-top-safe');
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

  // iOS 26 Safari bug (WebKit #297779): after keyboard dismiss, visualViewport.offsetTop
  // becomes ~24 which shifts fixed elements down, creating a white gap above the nav.
  if (window.visualViewport) {
    function fixOffset() {
      var offset = window.visualViewport.offsetTop || 0;
      var top = offset > 0 ? offset + 'px' : '';
      nav.style.top = top;
      if (shim) shim.style.top = top;
    }
    window.visualViewport.addEventListener('resize', fixOffset, { passive: true });
    window.visualViewport.addEventListener('scroll', fixOffset, { passive: true });
  }
})();
