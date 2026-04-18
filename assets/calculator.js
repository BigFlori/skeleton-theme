/* Sonnwerk — Amortisation Calculator */
(function () {
  const calc = document.querySelector('[data-calculator]');
  if (!calc) return;

  const sliderConsumption = calc.querySelector('[data-input="consumption"]');
  const sliderRoof        = calc.querySelector('[data-input="roof"]');
  const toggleEV          = calc.querySelector('[data-toggle="ev"]');
  const toggleHP          = calc.querySelector('[data-toggle="hp"]');
  const ctaBtn            = calc.querySelector('[data-calc-cta]');

  const outKwp      = calc.querySelector('[data-out="kwp"]');
  const outYield    = calc.querySelector('[data-out="yield"]');
  const outSaving   = calc.querySelector('[data-out="saving"]');
  const outCost     = calc.querySelector('[data-out="cost"]');
  const outPayback  = calc.querySelector('[data-out="payback"]');
  const outCo2      = calc.querySelector('[data-out="co2"]');
  const valConsumption = calc.querySelector('[data-val="consumption"]');
  const valRoof        = calc.querySelector('[data-val="roof"]');

  const fillConsumption  = calc.querySelector('[data-fill="consumption"]');
  const fillRoof         = calc.querySelector('[data-fill="roof"]');
  const thumbConsumption = sliderConsumption.closest('.sw-calc__track').querySelector('.sw-calc__thumb');
  const thumbRoof        = sliderRoof.closest('.sw-calc__track').querySelector('.sw-calc__thumb');

  const fmt = new Intl.NumberFormat('de-AT');

  let hasEV = false;
  let hasHP = false;
  let rafPending = false;

  function pct(slider) {
    return ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
  }

  function flushUI() {
    rafPending = false;

    // Slider track UI
    const pc = pct(sliderConsumption);
    const pr = pct(sliderRoof);
    fillConsumption.style.width  = pc + '%';
    thumbConsumption.style.left  = 'calc(' + pc + '% - 10px)';
    valConsumption.textContent   = fmt.format(sliderConsumption.value);
    fillRoof.style.width         = pr + '%';
    thumbRoof.style.left         = 'calc(' + pr + '% - 10px)';
    valRoof.textContent          = fmt.format(sliderRoof.value);

    // Compute results
    const consumption = Number(sliderConsumption.value);
    const roofSize    = Number(sliderRoof.value);
    const effective   = consumption + (hasEV ? 3000 : 0) + (hasHP ? 4000 : 0);

    const kwp         = Math.round(Math.min(Math.min(30, roofSize / 5.5), effective / 1000) * 10) / 10;
    const yearlyYield = Math.round(kwp * 1050);
    const selfUse     = Math.min(yearlyYield, effective * 0.55);
    const feedIn      = yearlyYield - selfUse;
    const saving      = Math.round(selfUse * 0.34 + feedIn * 0.07);
    const cost        = Math.round(kwp * 920);
    const payback     = Math.round((saving > 0 ? cost / saving : 99) * 10) / 10;
    const co2         = Math.round(yearlyYield * 0.45);

    if (outKwp)     outKwp.textContent     = kwp;
    if (outYield)   outYield.textContent   = fmt.format(yearlyYield);
    if (outSaving)  outSaving.textContent  = fmt.format(saving);
    if (outCost)    outCost.textContent    = '\u20ac\u00a0' + fmt.format(cost);
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

  toggleEV.addEventListener('click', () => {
    hasEV = !hasEV;
    toggleEV.setAttribute('aria-pressed', hasEV);
    toggleEV.classList.toggle('sw-calc__toggle--active', hasEV);
    scheduleUpdate();
  });

  toggleHP.addEventListener('click', () => {
    hasHP = !hasHP;
    toggleHP.setAttribute('aria-pressed', hasHP);
    toggleHP.classList.toggle('sw-calc__toggle--active', hasHP);
    scheduleUpdate();
  });

  // Init
  flushUI();
})();
