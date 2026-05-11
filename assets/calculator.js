/* Sonnwerk — Amortisation Calculator */
(function () {
  function init(scope) {
    scope = scope || document;

    var calc = scope.querySelector('[data-calculator]');
    if (!calc) return;

    var sliderConsumption = calc.querySelector('[data-input="consumption"]');
    var sliderRoof        = calc.querySelector('[data-input="roof"]');
    var toggleEV          = calc.querySelector('[data-toggle="ev"]');
    var toggleHP          = calc.querySelector('[data-toggle="hp"]');
    var ctaBtn            = calc.querySelector('[data-calc-cta]');

    var outKwp      = calc.querySelector('[data-out="kwp"]');
    var outYield    = calc.querySelector('[data-out="yield"]');
    var outSaving   = calc.querySelector('[data-out="saving"]');
    var outCost     = calc.querySelector('[data-out="cost"]');
    var outPayback  = calc.querySelector('[data-out="payback"]');
    var outCo2      = calc.querySelector('[data-out="co2"]');
    var valConsumption = calc.querySelector('[data-val="consumption"]');
    var valRoof        = calc.querySelector('[data-val="roof"]');

    var fillConsumption  = calc.querySelector('[data-fill="consumption"]');
    var fillRoof         = calc.querySelector('[data-fill="roof"]');
    var thumbConsumption = sliderConsumption.closest('.sw-calc__track').querySelector('.sw-calc__thumb');
    var thumbRoof        = sliderRoof.closest('.sw-calc__track').querySelector('.sw-calc__thumb');

    var fmt = new Intl.NumberFormat('de-AT');

    var hasEV = false;
    var hasHP = false;
    var rafPending = false;

    function pct(slider) {
      return ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    }

    function flushUI() {
      rafPending = false;

      // Slider track UI
      var pc = pct(sliderConsumption);
      var pr = pct(sliderRoof);
      fillConsumption.style.width  = pc + '%';
      thumbConsumption.style.left  = 'calc(' + pc + '% - 10px)';
      valConsumption.textContent   = fmt.format(sliderConsumption.value);
      fillRoof.style.width         = pr + '%';
      thumbRoof.style.left         = 'calc(' + pr + '% - 10px)';
      valRoof.textContent          = fmt.format(sliderRoof.value);

      // Compute results
      var consumption = Number(sliderConsumption.value);
      var roofSize    = Number(sliderRoof.value);
      var effective   = consumption + (hasEV ? 3000 : 0) + (hasHP ? 4000 : 0);

      var kwp         = Math.round(Math.min(Math.min(30, roofSize / 5.5), effective / 1000) * 10) / 10;
      var yearlyYield = Math.round(kwp * 1050);
      var selfUse     = Math.min(yearlyYield, effective * 0.55);
      var feedIn      = yearlyYield - selfUse;
      var saving      = Math.round(selfUse * 0.34 + feedIn * 0.07);
      var cost        = Math.round(kwp * 920);
      var payback     = Math.round((saving > 0 ? cost / saving : 99) * 10) / 10;
      var co2         = Math.round(yearlyYield * 0.45);

      if (outKwp)     outKwp.textContent     = kwp;
      if (outYield)   outYield.textContent   = fmt.format(yearlyYield);
      if (outSaving)  outSaving.textContent  = fmt.format(saving);
      if (outCost)    outCost.textContent    = '€ ' + fmt.format(cost);
      if (outPayback) outPayback.textContent = payback;
      if (outCo2)     outCo2.textContent     = fmt.format(co2);
      if (ctaBtn)     ctaBtn.href = (ctaBtn.dataset.href || '#pakete') + '?min_kwp=' + kwp;
    }

    function scheduleUpdate() {
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(flushUI);
      }
    }

    sliderConsumption.addEventListener('input', scheduleUpdate);
    sliderRoof.addEventListener('input', scheduleUpdate);

    toggleEV.addEventListener('click', function () {
      hasEV = !hasEV;
      toggleEV.setAttribute('aria-pressed', hasEV);
      toggleEV.classList.toggle('sw-calc__toggle--active', hasEV);
      scheduleUpdate();
    });

    toggleHP.addEventListener('click', function () {
      hasHP = !hasHP;
      toggleHP.setAttribute('aria-pressed', hasHP);
      toggleHP.classList.toggle('sw-calc__toggle--active', hasHP);
      scheduleUpdate();
    });

    flushUI();
  }

  init();
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
