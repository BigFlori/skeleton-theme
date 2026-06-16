/*
 * Recently viewed products
 * -------------------------
 * - Records the current product (from window.PDP_CONFIG) into localStorage.
 * - On pages containing the [data-recently-viewed] section, fetches the
 *   previously viewed products via the Search API + Section Rendering API
 *   (one request) and injects them into the scrollable track.
 *
 * Storage: localStorage key "sw:recently-viewed" — array of product IDs,
 * most-recent first, deduplicated, capped at maxItems (+1 so excluding the
 * current product still leaves a full row).
 */
(function () {
  'use strict';

  var KEY = 'sw:recently-viewed';
  var cfg = window.swRecentlyViewedConfig || {};
  var MAX = parseInt(cfg.maxItems, 10) || 8;

  function read() {
    try {
      var arr = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(arr) ? arr.filter(function (n) { return typeof n === 'number'; }) : [];
    } catch (e) {
      return [];
    }
  }

  function write(arr) {
    try {
      localStorage.setItem(KEY, JSON.stringify(arr));
    } catch (e) {
      /* storage full / blocked — ignore */
    }
  }

  // ── 1. Record the current product (PDP) ────────────────────────────────────
  var pdp = window.PDP_CONFIG;
  var currentId = pdp && typeof pdp.productId === 'number' ? pdp.productId : null;

  if (currentId) {
    var stored = read().filter(function (id) { return id !== currentId; });
    stored.unshift(currentId);
    write(stored.slice(0, MAX + 1));
  }

  // ── 2. Display ──────────────────────────────────────────────────────────────
  var section = document.querySelector('[data-recently-viewed]');
  if (!section) return;

  var track = section.querySelector('[data-rv-carousel-track]');
  if (!track) return;

  // Exclude the product currently being viewed; cap to MAX.
  var displayIds = read().filter(function (id) { return id !== currentId; }).slice(0, MAX);
  if (displayIds.length === 0) return;

  var searchUrl = cfg.searchUrl || '/search';
  var sectionId = cfg.sectionId;
  var loaded = false;

  // Reveal the shell now that we know there is history — reserves layout space
  // (track has a min-height) so the IntersectionObserver has a box to observe.
  // Fill it with skeleton placeholders so the revealed box does not read as
  // empty while the cards are being fetched.
  section.hidden = false;
  renderSkeletons(displayIds.length);

  function renderSkeletons(count) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var slide = document.createElement('div');
      slide.className = 'sw-rv__slide sw-rv__slide--skeleton';
      slide.setAttribute('aria-hidden', 'true');
      slide.innerHTML =
        '<div class="sw-rv__skel">' +
          '<div class="sw-rv__skel-img"></div>' +
          '<div class="sw-rv__skel-line sw-rv__skel-line--sm"></div>' +
          '<div class="sw-rv__skel-line"></div>' +
          '<div class="sw-rv__skel-line sw-rv__skel-line--price"></div>' +
        '</div>';
      frag.appendChild(slide);
    }
    track.appendChild(frag);
  }

  function loadProducts() {
    if (loaded) return;
    loaded = true;

    var query = displayIds.map(function (id) { return 'id:' + id; }).join(' OR ');
    var url = searchUrl +
      '?q=' + encodeURIComponent(query) +
      '&resources[type]=product' +
      '&section_id=' + encodeURIComponent(sectionId);

    fetch(url, { credentials: 'same-origin' })
      .then(function (res) { return res.ok ? res.text() : Promise.reject(res.status); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var slides = Array.prototype.slice.call(doc.querySelectorAll('.sw-rv__slide'));

        // Search does not preserve our order — re-order by localStorage order.
        var byId = {};
        slides.forEach(function (slide) {
          byId[slide.getAttribute('data-product-id')] = slide;
        });

        var frag = document.createDocumentFragment();
        displayIds.forEach(function (id) {
          var node = byId[String(id)];
          if (node) frag.appendChild(node);
        });

        if (!frag.childNodes.length) {
          // Nothing renderable (e.g. all products unpublished) — hide the shell.
          section.hidden = true;
          return;
        }

        track.innerHTML = '';
        track.appendChild(frag);
        track.style.minHeight = '';
        initCarousel();
      })
      .catch(function (err) {
        section.hidden = true;
        console.error('[sw-recently-viewed]', err);
      });
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries, obs) {
      if (entries.some(function (e) { return e.isIntersecting; })) {
        obs.disconnect();
        loadProducts();
      }
    }, { rootMargin: '400px' });
    io.observe(section);
  } else {
    loadProducts();
  }

  // ── 3. Carousel arrows (mirrors header.js mega-menu carousel) ──────────────
  function initCarousel() {
    var prevBtn = section.querySelector('[data-rv-carousel-prev]');
    var nextBtn = section.querySelector('[data-rv-carousel-next]');
    if (!prevBtn || !nextBtn) return;

    function updateBtns() {
      var maxScroll = track.scrollWidth - track.clientWidth;
      prevBtn.disabled = track.scrollLeft <= 2;
      nextBtn.disabled = track.scrollLeft >= maxScroll - 2;
    }

    function pageWidth() {
      return Math.max(160, track.clientWidth - 40);
    }

    prevBtn.addEventListener('click', function () {
      track.scrollBy({ left: -pageWidth(), behavior: 'smooth' });
    });
    nextBtn.addEventListener('click', function () {
      track.scrollBy({ left: pageWidth(), behavior: 'smooth' });
    });

    track.addEventListener('scroll', updateBtns, { passive: true });
    window.addEventListener('resize', updateBtns);
    updateBtns();
  }
})();
