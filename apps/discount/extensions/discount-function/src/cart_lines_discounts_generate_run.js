import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
} from '../generated/api';

/**
 * Volume discount with two-tier lookup:
 *   1. Per-product override: product.metafield(custom.volume_tiers)
 *   2. Shop-wide price-band default: shop.metafield(custom.volume_tier_bands)
 *      — a JSON array of { min_price, max_price|null, tiers:[{min_qty,discount_pct}] }.
 *      The variant unit price (line.cost.amountPerQuantity) selects the band.
 *
 * Per-product tiers, when present and non-empty, fully override the band.
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

  const rawBands = input.shop?.volumeTierBands?.jsonValue;
  const bands = Array.isArray(rawBands)
    ? rawBands
        .map((b) => {
          if (!b) return null;
          const minPrice = Number(b.min_price);
          const maxPrice =
            b.max_price === null || b.max_price === undefined
              ? Infinity
              : Number(b.max_price);
          const tiers = Array.isArray(b.tiers) ? b.tiers : [];
          if (!Number.isFinite(minPrice) || minPrice < 0) return null;
          if (!Number.isFinite(maxPrice) && maxPrice !== Infinity) return null;
          if (tiers.length === 0) return null;
          return { minPrice, maxPrice, tiers };
        })
        .filter(Boolean)
        .sort((a, b) => a.minPrice - b.minPrice)
    : [];

  function pickTiersForLine(line) {
    const productTiers = line.merchandise.product?.volumeTiers?.jsonValue;
    if (Array.isArray(productTiers) && productTiers.length > 0) {
      return productTiers;
    }
    if (bands.length === 0) return null;
    const unitPrice = Number(line.cost?.amountPerQuantity?.amount);
    if (!Number.isFinite(unitPrice)) return null;
    for (const band of bands) {
      if (unitPrice >= band.minPrice && unitPrice <= band.maxPrice) {
        return band.tiers;
      }
    }
    return null;
  }

  const candidates = [];

  for (const line of input.cart.lines) {
    if (line.merchandise.__typename !== 'ProductVariant') continue;

    const tiers = pickTiersForLine(line);
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
