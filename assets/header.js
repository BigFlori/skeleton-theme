(function () {
  'use strict';

  // ── Mega-menu: desktop open/close ─────────────────────────────────────────

  var menuItems = document.querySelectorAll('.header-menu__item--has-children');

  // Small grace period before the panel closes once the cursor leaves it, so a
  // brief slip outside the hover area (or crossing the gap to the panel) doesn't
  // snap it shut. Re-entering within this window cancels the close.
  var CLOSE_DELAY = 180; // ms
  // Only wire pointer hover on devices that actually hover (skip touch).
  var canHover = !window.matchMedia || window.matchMedia('(hover: hover)').matches;

  menuItems.forEach(function (item) {
    var trigger = item.querySelector('[data-mega-menu-trigger]');
    if (!trigger) return;

    // Pointer hover with a close debounce. CSS opens on :hover too, but we keep
    // the is-open class on for CLOSE_DELAY after mouseleave so the panel lingers.
    if (canHover) {
      var closeTimer = null;
      item.addEventListener('mouseenter', function () {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        closeAll();
        openItem(item);
      });
      item.addEventListener('mouseleave', function () {
        if (closeTimer) clearTimeout(closeTimer);
        closeTimer = setTimeout(function () {
          closeItem(item);
          closeTimer = null;
        }, CLOSE_DELAY);
      });
    }

    // Keyboard: Enter/Space on the trigger link toggles the panel
    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var isOpen = item.classList.contains('is-open');
        closeAll();
        if (!isOpen) openItem(item);
      }
      if (e.key === 'Escape') {
        closeAll();
        trigger.focus();
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        openItem(item);
        focusFirstLink(item);
      }
    });

    // Keyboard nav inside mega-menu panel
    var panel = item.querySelector('[data-mega-menu]');
    if (panel) {
      panel.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          closeAll();
          trigger.focus();
        }
      });
    }
  });

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.header-menu__item--has-children')) {
      closeAll();
    }
  });

  // Close on Escape globally (when focus is inside a mega-menu)
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
  });

  function openItem(item) {
    item.classList.add('is-open');
    var trigger = item.querySelector('[data-mega-menu-trigger]');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
  }

  function closeItem(item) {
    item.classList.remove('is-open');
    var trigger = item.querySelector('[data-mega-menu-trigger]');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function closeAll() {
    menuItems.forEach(closeItem);
  }

  function focusFirstLink(item) {
    var panel = item.querySelector('[data-mega-menu]');
    if (!panel) return;
    var first = panel.querySelector('a');
    if (first) first.focus();
  }

  // ── Mega-menu: product carousel arrows ───────────────────────────────────

  document.querySelectorAll('[data-mega-carousel-track]').forEach(function (track) {
    var panel = track.closest('[data-mega-menu]');
    if (!panel) return;
    var prevBtn = panel.querySelector('[data-mega-carousel-prev]');
    var nextBtn = panel.querySelector('[data-mega-carousel-next]');
    if (!prevBtn || !nextBtn) return;

    function updateBtns() {
      var maxScroll = track.scrollWidth - track.clientWidth;
      prevBtn.disabled = track.scrollLeft <= 2;
      nextBtn.disabled = track.scrollLeft >= maxScroll - 2;
    }

    function pageWidth() {
      // Scroll by one full visible width minus a small overlap so partially
      // visible cards become fully visible after the click.
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

    // Recompute when the panel becomes visible (display: block changes layout)
    var mo = new MutationObserver(updateBtns);
    var item = panel.closest('.header-menu__item--has-children');
    if (item) mo.observe(item, { attributes: true, attributeFilter: ['class'] });

    updateBtns();
  });

  // ── Inline search: typewriter placeholder ────────────────────────────────

  var searchInput = document.getElementById('header-search-input');
  if (searchInput) {
    var placeholders = (searchInput.dataset.placeholders || '').split('||').map(function (s) { return s.trim(); }).filter(Boolean);

    if (placeholders.length === 0) {
      placeholders = [
        'Keress terméknévre – SigenStor EC 4.6 SP',
        'Keress cikkszámra – SST10K-AT',
        'Keress típusra – Huawei SUN2000-10KTL',
        'Keress kategóriára – Inverterek',
        'Keress márkára – Sigenergy',
        'Keress teljesítményre – 10 kW'
      ];
    }

    var TYPE_MIN = 55;    // ms — base delay between keystrokes
    var TYPE_JITTER = 65; // ms — random extra delay to feel human
    var HOLD_MS = 1600;   // pause after a phrase is fully typed
    var ERASE_MS = 28;    // delay between deletions (faster than typing)
    var PAUSE_MS = 280;   // gap between phrases
    var PREFIX = 'Keress '; // stays fixed, only the suffix is typed

    // Build {suffix, full} pairs so the static prefix is always visible.
    var phrases = placeholders.map(function (p) {
      if (p.indexOf(PREFIX) === 0) {
        return { prefix: PREFIX, suffix: p.slice(PREFIX.length) };
      }
      // Fallback: whole string is typed if it doesn't start with the prefix.
      return { prefix: '', suffix: p };
    });

    var phraseIdx = 0;
    var charIdx = 0;
    var timer = null;
    var paused = false;

    function setPlaceholder(text) {
      searchInput.setAttribute('placeholder', text);
    }

    function step() {
      if (paused) return;
      var phrase = phrases[phraseIdx];

      if (charIdx < phrase.suffix.length) {
        charIdx++;
        setPlaceholder(phrase.prefix + phrase.suffix.slice(0, charIdx));
        timer = setTimeout(step, TYPE_MIN + Math.random() * TYPE_JITTER);
        return;
      }

      // Fully typed — hold, then erase suffix, then advance
      timer = setTimeout(function eraseStep() {
        if (paused) return;
        if (charIdx > 0) {
          charIdx--;
          setPlaceholder(phrase.prefix + phrase.suffix.slice(0, charIdx));
          timer = setTimeout(eraseStep, ERASE_MS);
        } else {
          phraseIdx = (phraseIdx + 1) % phrases.length;
          timer = setTimeout(step, PAUSE_MS);
        }
      }, HOLD_MS);
    }

    function stop() {
      paused = true;
      if (timer) { clearTimeout(timer); timer = null; }
    }

    function start() {
      paused = false;
      if (timer) clearTimeout(timer);
      timer = setTimeout(step, TYPE_MIN);
    }

    searchInput.addEventListener('focus', function () {
      stop();
      setPlaceholder('');
    });

    searchInput.addEventListener('blur', function () {
      // Resume from the start of the current phrase for a clean restart.
      charIdx = 0;
      setPlaceholder(phrases[phraseIdx].prefix);
      start();
    });

    // Respect reduced-motion: keep a single static placeholder.
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setPlaceholder(phrases[0].prefix + phrases[0].suffix);
    } else {
      setPlaceholder(phrases[0].prefix);
      start();
    }
  }

  // ── Inline search: predictive results dropdown ───────────────────────────

  (function inlinePredictiveSearch() {
    var input = document.getElementById('header-search-input');
    if (!input) return;

    var form = input.closest('[data-inline-search-form]');
    var wrapper = input.closest('.header__col-search');
    if (!form || !wrapper) return;

    var resultsEl = wrapper.querySelector('[data-inline-search-results]');
    if (!resultsEl) return;

    var cfg = window.swPredictiveSearchConfig || {};
    var routes = cfg.routes || {};
    var strings = cfg.strings || {};
    var contactUrl = '/pages/contact';

    var DEBOUNCE_MS = 200;
    var MIN_CHARS = 2;

    var debounceId = null;
    var abortCtrl = null;
    var lastQuery = '';
    var isOpen = false;
    var currentState = 'idle';
    var ITEM_SEL = '.header__inline-search-item a, .header__inline-search-view-all';
    var SKELETON_ROWS = 5;

    function escapeHtml(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function openPanel() {
      if (isOpen) return;
      isOpen = true;
      resultsEl.removeAttribute('hidden');
      form.classList.add('is-active');
    }

    function closePanel() {
      if (!isOpen) return;
      isOpen = false;
      resultsEl.setAttribute('hidden', '');
      form.classList.remove('is-active');
      currentState = 'idle';
    }

    function renderLoading() {
      // Don't re-render skeleton on every keystroke — keep the shimmer animation
      // running smoothly while the debounce timer resets.
      if (currentState === 'loading') return;
      currentState = 'loading';
      var rows = '';
      for (var i = 0; i < SKELETON_ROWS; i++) {
        rows +=
          '<li class="header__inline-search-skeleton-item" aria-hidden="true">' +
            '<span class="header__inline-search-skeleton-thumb"></span>' +
            '<span class="header__inline-search-skeleton-line"></span>' +
          '</li>';
      }
      resultsEl.innerHTML =
        '<div class="header__inline-search-scroll">' +
          '<ul class="header__inline-search-list header__inline-search-skeleton" role="list" aria-busy="true" aria-label="' +
          escapeHtml(strings.loading || 'Searching…') + '">' + rows + '</ul>' +
        '</div>' +
        '<span class="header__inline-search-skeleton-cta" aria-hidden="true"></span>';
    }

    function renderError() {
      currentState = 'error';
      resultsEl.innerHTML =
        '<div class="header__inline-search-error">' +
        escapeHtml(strings.error || 'Error') + '</div>';
    }

    function renderEmpty(q) {
      currentState = 'empty';
      var tips = [
        'Ellenőrizd a helyesírást',
        'Használj kevesebb kulcsszót',
        'Keress általánosabb kifejezéssel'
      ];
      var tipsHtml = tips.map(function (t) {
        return '<li>' + escapeHtml(t) + '</li>';
      }).join('');
      resultsEl.innerHTML =
        '<div class="header__inline-search-empty">' +
        '<div class="header__inline-search-empty__title">' +
          escapeHtml((strings.no_results || 'No results') + ' a(z) „' + q + '" keresésre') +
        '</div>' +
        '<div class="header__inline-search-empty__lead">Próbáld a következőt:</div>' +
        '<ul class="header__inline-search-empty__list">' + tipsHtml +
          '<li>Ha nem találod a terméket, <a href="' + escapeHtml(contactUrl) + '">írj nekünk</a>.</li>' +
        '</ul>' +
        '</div>';
    }

    function normalizeProducts(arr) {
      return (arr || []).map(function (p) {
        return {
          title: p.title,
          url: p.url,
          featured_image: p.featured_image || p.image || null
        };
      });
    }

    function productItem(p) {
      var imgUrl = p.featured_image
        ? (typeof p.featured_image === 'string' ? p.featured_image : p.featured_image.url)
        : null;
      var img = imgUrl
        ? '<img class="header__inline-search-thumb" src="' + escapeHtml(imgUrl) +
          '" alt="" loading="lazy" width="48" height="48">'
        : '<span class="header__inline-search-thumb header__inline-search-thumb--ph" aria-hidden="true">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 17l-5-5-9 9"/></svg>' +
          '</span>';
      return '<li class="header__inline-search-item"><a href="' + escapeHtml(p.url) + '">' +
        img +
        '<span class="header__inline-search-item-title">' + escapeHtml(p.title) + '</span>' +
        '</a></li>';
    }

    function searchForLabel(q) {
      var tmpl = strings.search_for || 'Search „{{ terms }}”';
      return tmpl.replace('{{ terms }}', q).replace('{{terms}}', q);
    }

    function ctaHtml(q) {
      var href = (routes.search || '/search') + '?q=' + encodeURIComponent(q) + '&options[prefix]=last';
      return '<a class="header__inline-search-view-all" href="' + escapeHtml(href) + '">' +
        escapeHtml(searchForLabel(q)) +
        '</a>';
    }

    function render(data, q) {
      var resources = (data && data.resources && data.resources.results) || {};
      var products = normalizeProducts(resources.products || []);

      if (!products.length) {
        renderEmpty(q);
        return;
      }

      currentState = 'results';
      var items = products.map(productItem).join('');
      resultsEl.innerHTML =
        '<div class="header__inline-search-scroll">' +
          '<ul class="header__inline-search-list" role="list">' + items + '</ul>' +
        '</div>' +
        ctaHtml(q);
    }

    function fetchSuggest(q) {
      if (abortCtrl) abortCtrl.abort();
      abortCtrl = ('AbortController' in window) ? new AbortController() : null;
      var url = (routes.suggest || '/search/suggest.json') +
        '?q=' + encodeURIComponent(q) +
        '&resources[type]=product' +
        '&resources[limit]=8' +
        '&resources[options][unavailable_products]=last';

      fetch(url, { signal: abortCtrl ? abortCtrl.signal : undefined, headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(function (data) {
          if (q !== lastQuery) return;
          render(data, q);
          openPanel();
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          renderError();
          openPanel();
        });
    }

    input.addEventListener('input', function () {
      var q = input.value.trim();
      lastQuery = q;
      clearTimeout(debounceId);

      if (q.length < MIN_CHARS) {
        if (abortCtrl) abortCtrl.abort();
        closePanel();
        return;
      }

      renderLoading();
      openPanel();
      debounceId = setTimeout(function () { fetchSuggest(q); }, DEBOUNCE_MS);
    });

    input.addEventListener('focus', function () {
      if (input.value.trim().length >= MIN_CHARS && resultsEl.innerHTML.trim().length > 0) {
        openPanel();
      }
    });

    // Close on outside click
    document.addEventListener('mousedown', function (e) {
      if (!isOpen) return;
      if (wrapper.contains(e.target)) return;
      closePanel();
    });

    // Close on Escape; keyboard navigation through results
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (isOpen) {
          e.stopPropagation();
          closePanel();
          input.blur();
        }
        return;
      }
      if (e.key === 'ArrowDown' && isOpen) {
        var first = resultsEl.querySelector(ITEM_SEL);
        if (first) { e.preventDefault(); first.focus(); }
      }
    });

    resultsEl.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closePanel();
        input.focus();
        return;
      }
      var items = Array.prototype.slice.call(resultsEl.querySelectorAll(ITEM_SEL));
      if (!items.length) return;
      var idx = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[Math.min(items.length - 1, idx + 1)].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (idx <= 0) input.focus();
        else items[idx - 1].focus();
      }
    });
  })();
})();
