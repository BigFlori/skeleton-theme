// @ts-check

const EMPTY_RESULT = { operations: [] };

export function run(input) {
  const candidates = [];

  for (const line of input.cart.lines) {
    if (line.merchandise.__typename !== "ProductVariant") continue;

    const raw = line.merchandise.product?.volumeTiers?.jsonValue;
    if (!Array.isArray(raw) || raw.length === 0) continue;

    let bestPct = 0;
    for (const tier of raw) {
      if (!tier) continue;
      const minQty = Number(tier.min_qty);
      const pct = Number(tier.discount_pct);
      if (!Number.isFinite(minQty) || !Number.isFinite(pct)) continue;
      if (pct <= 0) continue;
      if (line.quantity < minQty) continue;
      if (pct > bestPct) bestPct = pct;
    }
    if (bestPct <= 0) continue;

    candidates.push({
      message: `Volume −${bestPct}%`,
      targets: [{ cartLine: { id: line.id } }],
      value: { percentage: { value: bestPct } },
    });
  }

  if (candidates.length === 0) return EMPTY_RESULT;

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: "ALL",
        },
      },
    ],
  };
}
