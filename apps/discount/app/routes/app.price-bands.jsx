import { useEffect, useMemo, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

const METAFIELD_NAMESPACE = "custom";
const METAFIELD_KEY = "volume_tier_bands";

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "HUF", "ISK", "JPY", "KMF", "KRW", "PYG",
  "RWF", "UGX", "UYI", "VND", "VUV", "XAF", "XOF", "XPF",
]);

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(
    `#graphql
      query ShopBands {
        shop {
          id
          currencyCode
          bands: metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
            id
            jsonValue
          }
        }
      }`,
  );
  const json = await response.json();
  const shop = json.data?.shop;
  return {
    shopId: shop?.id ?? null,
    currencyCode: shop?.currencyCode ?? "USD",
    metafieldId: shop?.bands?.id ?? null,
    bands: Array.isArray(shop?.bands?.jsonValue) ? shop.bands.jsonValue : [],
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  const shopId = form.get("shopId");

  if (!shopId) return { ok: false, error: "Missing shopId" };

  if (intent === "clear") {
    const response = await admin.graphql(
      `#graphql
        mutation DeleteShopBands($metafields: [MetafieldIdentifierInput!]!) {
          metafieldsDelete(metafields: $metafields) {
            deletedMetafields { key namespace ownerId }
            userErrors { field message }
          }
        }`,
      {
        variables: {
          metafields: [
            {
              ownerId: shopId,
              namespace: METAFIELD_NAMESPACE,
              key: METAFIELD_KEY,
            },
          ],
        },
      },
    );
    const json = await response.json();
    const errors = json.data?.metafieldsDelete?.userErrors ?? [];
    if (errors.length > 0) {
      return { ok: false, error: errors.map((e) => e.message).join("; ") };
    }
    return { ok: true, bands: [] };
  }

  const bandsRaw = form.get("bands");
  if (typeof bandsRaw !== "string") {
    return { ok: false, error: "Missing bands payload" };
  }
  let parsed;
  try {
    parsed = JSON.parse(bandsRaw);
  } catch {
    return { ok: false, error: "Invalid bands JSON" };
  }

  const cleaned = (Array.isArray(parsed) ? parsed : [])
    .map((b) => {
      const minPrice = Number(b.min_price);
      const maxRaw = b.max_price;
      const maxPrice =
        maxRaw === null || maxRaw === "" || maxRaw === undefined
          ? null
          : Number(maxRaw);
      const tiers = (Array.isArray(b.tiers) ? b.tiers : [])
        .map((t) => ({
          min_qty: Number(t.min_qty),
          discount_pct: Number(t.discount_pct),
        }))
        .filter(
          (t) =>
            Number.isFinite(t.min_qty) &&
            Number.isFinite(t.discount_pct) &&
            t.min_qty > 0 &&
            t.discount_pct > 0 &&
            t.discount_pct < 100,
        )
        .sort((a, b) => a.min_qty - b.min_qty);
      return { min_price: minPrice, max_price: maxPrice, tiers };
    })
    .filter(
      (b) =>
        Number.isFinite(b.min_price) &&
        b.min_price >= 0 &&
        (b.max_price === null ||
          (Number.isFinite(b.max_price) && b.max_price >= b.min_price)) &&
        b.tiers.length > 0,
    )
    .sort((a, b) => a.min_price - b.min_price);

  if (cleaned.length === 0) {
    const response = await admin.graphql(
      `#graphql
        mutation DeleteShopBands($metafields: [MetafieldIdentifierInput!]!) {
          metafieldsDelete(metafields: $metafields) {
            deletedMetafields { key namespace ownerId }
            userErrors { field message }
          }
        }`,
      {
        variables: {
          metafields: [
            {
              ownerId: shopId,
              namespace: METAFIELD_NAMESPACE,
              key: METAFIELD_KEY,
            },
          ],
        },
      },
    );
    const json = await response.json();
    const errors = json.data?.metafieldsDelete?.userErrors ?? [];
    if (errors.length > 0) {
      return { ok: false, error: errors.map((e) => e.message).join("; ") };
    }
    return { ok: true, bands: [] };
  }

  const response = await admin.graphql(
    `#graphql
      mutation SetShopBands($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id key namespace jsonValue }
          userErrors { field message code }
        }
      }`,
    {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: METAFIELD_NAMESPACE,
            key: METAFIELD_KEY,
            type: "json",
            value: JSON.stringify(cleaned),
          },
        ],
      },
    },
  );
  const json = await response.json();
  const errors = json.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length > 0) {
    return { ok: false, error: errors.map((e) => e.message).join("; ") };
  }
  return { ok: true, bands: cleaned };
};

function emptyTierRow() {
  return { min_qty: "", discount_pct: "" };
}

function emptyBand() {
  return { min_price: "", max_price: "", tiers: [emptyTierRow()] };
}

function bandsToForm(bands) {
  if (!Array.isArray(bands) || bands.length === 0) return [emptyBand()];
  return bands.map((b) => ({
    min_price: b.min_price == null ? "" : String(b.min_price),
    max_price: b.max_price == null ? "" : String(b.max_price),
    tiers:
      Array.isArray(b.tiers) && b.tiers.length > 0
        ? b.tiers.map((t) => ({
            min_qty: String(t.min_qty ?? ""),
            discount_pct: String(t.discount_pct ?? ""),
          }))
        : [emptyTierRow()],
  }));
}

function validateBands(bands) {
  const bandErrors = bands.map(() => ({
    min_price: null,
    max_price: null,
    tiers: [],
  }));
  const generalWarnings = [];

  const parsed = bands.map((b, i) => {
    const minP = b.min_price === "" ? null : Number(b.min_price);
    const maxP = b.max_price === "" ? null : Number(b.max_price);
    const tiers = b.tiers.map((t) => ({
      min_qty: t.min_qty === "" ? null : Number(t.min_qty),
      discount_pct: t.discount_pct === "" ? null : Number(t.discount_pct),
    }));
    return { i, minP, maxP, tiers };
  });

  parsed.forEach((p) => {
    if (p.minP !== null) {
      if (!Number.isFinite(p.minP) || p.minP < 0) {
        bandErrors[p.i].min_price = "Must be ≥ 0";
      }
    } else {
      bandErrors[p.i].min_price = "Required";
    }
    if (p.maxP !== null) {
      if (!Number.isFinite(p.maxP) || p.maxP < 0) {
        bandErrors[p.i].max_price = "Must be ≥ 0";
      } else if (p.minP !== null && p.maxP < p.minP) {
        bandErrors[p.i].max_price = "Must be ≥ min price";
      }
    }
  });

  const sortable = parsed
    .filter((p) => p.minP !== null && !bandErrors[p.i].min_price)
    .sort((a, b) => a.minP - b.minP);
  for (let k = 1; k < sortable.length; k++) {
    const prev = sortable[k - 1];
    const cur = sortable[k];
    const prevMax = prev.maxP ?? Infinity;
    if (cur.minP <= prevMax) {
      bandErrors[cur.i].min_price = "Overlaps previous band";
    }
  }

  parsed.forEach((p) => {
    const tierErrs = p.tiers.map(() => ({
      min_qty: null,
      discount_pct: null,
    }));
    const seen = new Map();
    p.tiers.forEach((t, j) => {
      if (t.min_qty !== null) {
        if (!Number.isFinite(t.min_qty) || t.min_qty <= 0) {
          tierErrs[j].min_qty = "Must be > 0";
        } else if (!Number.isInteger(t.min_qty)) {
          tierErrs[j].min_qty = "Must be a whole number";
        } else if (seen.has(t.min_qty)) {
          tierErrs[j].min_qty = "Duplicate min qty";
        } else {
          seen.set(t.min_qty, j);
        }
      }
      if (t.discount_pct !== null) {
        if (!Number.isFinite(t.discount_pct) || t.discount_pct <= 0) {
          tierErrs[j].discount_pct = "Must be > 0";
        } else if (t.discount_pct >= 100) {
          tierErrs[j].discount_pct = "Must be < 100";
        }
      }
    });
    const hasAnyTier = p.tiers.some(
      (t) => t.min_qty !== null || t.discount_pct !== null,
    );
    if (!hasAnyTier && p.minP !== null) {
      generalWarnings.push(
        `Band ${p.i + 1}: no tiers defined — this band will be skipped on save.`,
      );
    }
    bandErrors[p.i].tiers = tierErrs;
  });

  const hasError = bandErrors.some(
    (e) =>
      e.min_price ||
      e.max_price ||
      e.tiers.some((t) => t.min_qty || t.discount_pct),
  );

  const validBands = parsed
    .filter((p) => p.minP !== null && !bandErrors[p.i].min_price)
    .map((p) => ({
      min_price: p.minP,
      max_price: p.maxP,
      tiers: p.tiers
        .filter(
          (t) =>
            t.min_qty !== null &&
            t.discount_pct !== null &&
            Number.isFinite(t.min_qty) &&
            Number.isFinite(t.discount_pct) &&
            t.min_qty > 0 &&
            t.discount_pct > 0 &&
            t.discount_pct < 100,
        )
        .sort((a, b) => a.min_qty - b.min_qty),
    }))
    .filter((b) => b.tiers.length > 0)
    .sort((a, b) => a.min_price - b.min_price);

  return { bandErrors, generalWarnings, hasError, validBands };
}

function formatMoney(amount, currencyCode) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(currencyCode);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode || "USD",
      maximumFractionDigits: isZeroDecimal ? 0 : 2,
    }).format(n);
  } catch {
    return `${n.toFixed(isZeroDecimal ? 0 : 2)} ${currencyCode ?? ""}`.trim();
  }
}

export default function PriceBands() {
  const { shopId, currencyCode, bands: serverBands } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [bands, setBands] = useState(() => bandsToForm(serverBands));

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Price bands saved");
      if (Array.isArray(fetcher.data.bands)) {
        setBands(bandsToForm(fetcher.data.bands));
      }
    } else if (fetcher.data?.error) {
      shopify.toast.show(`Save failed: ${fetcher.data.error}`, {
        isError: true,
      });
    }
  }, [fetcher.data, shopify]);

  const validation = useMemo(() => validateBands(bands), [bands]);

  const updateBandField = (bandIdx, field, value) => {
    setBands((prev) =>
      prev.map((b, i) => (i === bandIdx ? { ...b, [field]: value } : b)),
    );
  };
  const updateTier = (bandIdx, tierIdx, field, value) => {
    setBands((prev) =>
      prev.map((b, i) =>
        i === bandIdx
          ? {
              ...b,
              tiers: b.tiers.map((t, j) =>
                j === tierIdx ? { ...t, [field]: value } : t,
              ),
            }
          : b,
      ),
    );
  };
  const addTier = (bandIdx) => {
    setBands((prev) =>
      prev.map((b, i) =>
        i === bandIdx ? { ...b, tiers: [...b.tiers, emptyTierRow()] } : b,
      ),
    );
  };
  const removeTier = (bandIdx, tierIdx) => {
    setBands((prev) =>
      prev.map((b, i) =>
        i === bandIdx
          ? {
              ...b,
              tiers:
                b.tiers.length === 1
                  ? [emptyTierRow()]
                  : b.tiers.filter((_, j) => j !== tierIdx),
            }
          : b,
      ),
    );
  };
  const addBand = () => setBands((prev) => [...prev, emptyBand()]);
  const removeBand = (bandIdx) =>
    setBands((prev) =>
      prev.length === 1
        ? [emptyBand()]
        : prev.filter((_, i) => i !== bandIdx),
    );
  const clearAll = () => setBands([emptyBand()]);

  const save = () => {
    fetcher.submit(
      { intent: "save", shopId: shopId ?? "", bands: JSON.stringify(bands) },
      { method: "POST" },
    );
  };

  const isSaving =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  const canSave =
    !!shopId && !validation.hasError && validation.validBands.length > 0;

  return (
    <s-page heading="Price bands">
      <s-section heading="Default tiers by product price">
        <s-paragraph>
          Define price bands in your shop currency ({currencyCode}). Each
          product without a per-product <s-text>custom.volume_tiers</s-text>{" "}
          metafield falls into the band whose range contains its variant base
          price, and receives that band's tiers as the default volume discount.
          Per-product tiers always override the matching band.
        </s-paragraph>

        <s-stack direction="block" gap="base">
          {bands.map((band, bi) => {
            const bandErr = validation.bandErrors[bi] ?? {
              min_price: null,
              max_price: null,
              tiers: [],
            };
            return (
              <s-box
                key={bi}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="block" gap="base">
                  <s-stack direction="inline" gap="base">
                    <s-heading>Band {bi + 1}</s-heading>
                    <s-button
                      variant="tertiary"
                      tone="critical"
                      onClick={() => removeBand(bi)}
                    >
                      Remove band
                    </s-button>
                  </s-stack>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                      columnGap: 16,
                    }}
                  >
                    <s-number-field
                      label={`Min price (${currencyCode}, inclusive)`}
                      value={band.min_price}
                      min={0}
                      step={1}
                      error={bandErr.min_price ?? undefined}
                      onChange={(e) =>
                        updateBandField(bi, "min_price", e.target.value)
                      }
                    />
                    <s-number-field
                      label={`Max price (${currencyCode}, inclusive — leave empty for no upper limit)`}
                      value={band.max_price}
                      min={0}
                      step={1}
                      error={bandErr.max_price ?? undefined}
                      onChange={(e) =>
                        updateBandField(bi, "max_price", e.target.value)
                      }
                    />
                  </div>

                  {band.min_price !== "" && !bandErr.min_price && (
                    <s-text color="subdued">
                      Range:{" "}
                      {formatMoney(band.min_price, currencyCode) ??
                        band.min_price}{" "}
                      –{" "}
                      {band.max_price === "" || bandErr.max_price
                        ? "no upper limit"
                        : (formatMoney(band.max_price, currencyCode) ??
                          band.max_price)}
                    </s-text>
                  )}

                  <s-box
                    padding="base"
                    borderWidth="base"
                    borderRadius="base"
                    background="subdued"
                  >
                    <s-stack direction="block" gap="base">
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(120px, 200px) minmax(120px, 200px) auto",
                          columnGap: 16,
                          alignItems: "center",
                        }}
                      >
                        <s-text emphasis="bold">Min quantity</s-text>
                        <s-text emphasis="bold">Discount %</s-text>
                        <s-text emphasis="bold">&nbsp;</s-text>
                      </div>

                      {band.tiers.map((row, ti) => {
                        const tErr = bandErr.tiers[ti] ?? {
                          min_qty: null,
                          discount_pct: null,
                        };
                        return (
                          <div
                            key={ti}
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "minmax(120px, 200px) minmax(120px, 200px) auto",
                              columnGap: 16,
                              alignItems: "start",
                            }}
                          >
                            <s-number-field
                              label="Min quantity"
                              labelAccessibilityVisibility="exclusive"
                              value={row.min_qty}
                              min={1}
                              step={1}
                              error={tErr.min_qty ?? undefined}
                              onChange={(e) =>
                                updateTier(bi, ti, "min_qty", e.target.value)
                              }
                            />
                            <s-number-field
                              label="Discount %"
                              labelAccessibilityVisibility="exclusive"
                              value={row.discount_pct}
                              min={0}
                              step={0.1}
                              error={tErr.discount_pct ?? undefined}
                              onChange={(e) =>
                                updateTier(
                                  bi,
                                  ti,
                                  "discount_pct",
                                  e.target.value,
                                )
                              }
                            />
                            <s-button
                              variant="tertiary"
                              tone="critical"
                              onClick={() => removeTier(bi, ti)}
                            >
                              Remove
                            </s-button>
                          </div>
                        );
                      })}

                      <s-stack direction="inline" gap="base">
                        <s-button
                          variant="secondary"
                          onClick={() => addTier(bi)}
                        >
                          Add tier
                        </s-button>
                      </s-stack>
                    </s-stack>
                  </s-box>
                </s-stack>
              </s-box>
            );
          })}

          <s-stack direction="inline" gap="base">
            <s-button variant="secondary" onClick={addBand}>
              Add band
            </s-button>
            <s-button variant="tertiary" tone="critical" onClick={clearAll}>
              Clear all
            </s-button>
            <s-button
              variant="primary"
              onClick={save}
              {...(canSave ? {} : { disabled: true })}
              {...(isSaving ? { loading: true } : {})}
            >
              Save bands
            </s-button>
          </s-stack>

          {validation.generalWarnings.length > 0 && (
            <s-banner tone="warning" heading="Check your bands">
              <s-unordered-list>
                {validation.generalWarnings.map((w, i) => (
                  <s-list-item key={i}>{w}</s-list-item>
                ))}
              </s-unordered-list>
            </s-banner>
          )}

          <s-paragraph>
            <s-text color="subdued">
              Empty or invalid tiers are dropped on save. Bands are sorted by
              min price ascending. Saving with no valid bands clears the shop
              metafield.
            </s-text>
          </s-paragraph>
        </s-stack>
      </s-section>

      {validation.validBands.length > 0 && (
        <s-section slot="aside" heading="Live preview">
          <s-stack direction="block" gap="base">
            {validation.validBands.map((b, i) => (
              <s-stack key={i} direction="block" gap="extra-tight">
                <s-text emphasis="bold">
                  {formatMoney(b.min_price, currencyCode)} –{" "}
                  {b.max_price == null
                    ? "∞"
                    : formatMoney(b.max_price, currencyCode)}
                </s-text>
                {b.tiers.map((t, j) => (
                  <s-text key={j} color="subdued">
                    {t.min_qty}+ db → {t.discount_pct}%
                  </s-text>
                ))}
              </s-stack>
            ))}
          </s-stack>
        </s-section>
      )}

      <s-section slot="aside" heading="How it works">
        <s-unordered-list>
          <s-list-item>
            Bands are stored as JSON at{" "}
            <s-text>shop.metafields.custom.volume_tier_bands</s-text>.
          </s-list-item>
          <s-list-item>
            The Shopify Function reads this metafield at checkout. If a cart
            line's product has no per-product <s-text>volume_tiers</s-text>, the
            Function picks the band whose range contains the variant unit price.
          </s-list-item>
          <s-list-item>
            The PDP resolves the same band server-side and exposes the resulting
            tier list via <s-text>window.PDP_CONFIG.discountTiers</s-text>.
          </s-list-item>
          <s-list-item>
            Per-product tiers fully override bands — clear them on a product to
            fall back to the band default.
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
