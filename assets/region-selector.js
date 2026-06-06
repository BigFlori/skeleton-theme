(function () {
  'use strict';

  var FORM_ID     = 'region-localization-form';
  var COUNTRY_ID  = 'region-localization-country';
  var LANGUAGE_ID = 'region-localization-language';
  var BANNER_ID   = 'region-geo-banner';
  var DISMISS_KEY = 'region-geo-dismissed';

  function selectRegion(country, language) {
    var form = document.getElementById(FORM_ID);
    if (!form) return;
    document.getElementById(COUNTRY_ID).value  = country;
    document.getElementById(LANGUAGE_ID).value = language;
    form.submit();
  }

  function openModal() {
    var dialog = document.getElementById('region-dialog');
    if (!dialog) return;
    dialog.showModal();
    var active = dialog.querySelector('.region-modal__option.is-active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function closeModal(dialog) {
    dialog = dialog || document.getElementById('region-dialog');
    if (!dialog || dialog.classList.contains('is-closing')) return;
    dialog.classList.add('is-closing');
    dialog.addEventListener('animationend', function () {
      dialog.classList.remove('is-closing');
      dialog.close();
    }, { once: true });
  }

  function setupModalTriggers() {
    document.querySelectorAll('[data-region-trigger]').forEach(function (btn) {
      btn.addEventListener('click', openModal);
    });

    var dialog = document.getElementById('region-dialog');
    if (!dialog) return;

    var closeBtn = dialog.querySelector('[data-region-close]');
    if (closeBtn) closeBtn.addEventListener('click', function () { closeModal(dialog); });

    // Backdrop click — fires on the <dialog> element itself
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) closeModal(dialog);
    });

    // Intercept native Escape so our close animation runs first
    dialog.addEventListener('cancel', function (e) {
      e.preventDefault();
      closeModal(dialog);
    });

    // Arrow key navigation within the list
    dialog.addEventListener('keydown', function (e) {
      var opts = Array.from(dialog.querySelectorAll('[data-region-option]'));
      var idx  = opts.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        opts[(idx + 1) % opts.length].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        opts[(idx - 1 + opts.length) % opts.length].focus();
      }
    });
  }

  function setupOptionClicks() {
    document.addEventListener('click', function (e) {
      var opt = e.target.closest('[data-region-option]');
      if (!opt) return;
      selectRegion(opt.dataset.country, opt.dataset.language);
    });
  }

  function setupGeoBanner() {
    var banner = document.getElementById(BANNER_ID);
    if (!banner) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    banner.hidden = false;

    var confirmBtn = banner.querySelector('[data-region-geo-confirm]');
    var dismissBtn = banner.querySelector('[data-region-geo-dismiss]');

    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        localStorage.setItem(DISMISS_KEY, '1');
        banner.hidden = true;
        selectRegion(banner.dataset.country, banner.dataset.language);
      });
    }

    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () {
        localStorage.setItem(DISMISS_KEY, '1');
        banner.hidden = true;
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupModalTriggers();
    setupOptionClicks();
    setupGeoBanner();
  });
})();
