document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.sw-nav');
  if (!nav) return;

  const update = () => {
    if (window.scrollY > 24) {
      nav.classList.add('sw-nav--scrolled');
    } else {
      nav.classList.remove('sw-nav--scrolled');
    }
  };

  window.addEventListener('scroll', update, { passive: true });
  update();
});
