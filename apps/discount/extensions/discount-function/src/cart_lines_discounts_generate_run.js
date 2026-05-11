import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
} from '../generated/api';

/**
 * Volume discount: per cart line we read product.metafield(custom.volume_tiers)
 * as a JSON array of { min_qty, discount_pct } and apply the highest matching
 * tier as a line-level percentage discount. The PDP reads the same metafield,
 * so storefront and checkout stay in sync.
 *
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 *
 * @param {RunInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  if (!input.cart.lines.length) return { operations: [] };
  if (!input.discount.discountClasses.includes(DiscountClass.Product)) {
    return { operations: [] };
  }

  const candidates = [];

  for (const line of input.cart.lines) {
    if (line.merchandise.__typename !== 'ProductVariant') continue;

    const tiers = line.merchandise.product?.volumeTiers?.jsonValue;
    if (!Array.isArray(tiers) || tiers.length === 0) continue;

    let bestPct = 0;
    for (const tier of tiers) {
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

  if (candidates.length === 0) return { operations: [] };

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: ProductDiscountSelectionStrategy.All,
        },
      },
    ],
  };
}
