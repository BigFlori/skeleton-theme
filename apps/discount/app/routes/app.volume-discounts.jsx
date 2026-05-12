import { useEffect, useMemo, useState } from "react";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

const METAFIELD_NAMESPACE = "custom";
const METAFIELD_KEY = "volume_tiers";

const PRESETS = {
  light: {
    label: "Light (3 / 5 / 8% — 10 / 25 / 50 db)",
    rows: [
      { min_qty: "10", discount_pct: "3" },
      { min_qty: "25", discount_pct: "5" },
      { min_qty: "50", discount_pct: "8" },
    ],
  },
  bulk: {
    label: "Bulk (5 / 10 / 15% — 25 / 50 / 100 db)",
    rows: [
      { min_qty: "25", discount_pct: "5" },
      { min_qty: "50", discount_pct: "10" },
      { min_qty: "100", discount_pct: "15" },
    ],
  },
};

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const copyFromId = url.searchParams.get("copyFrom");

  const result = { product: null, copyFromTiers: null };

  if (productId) {
    const response = await admin.graphql(
      `#graphql
        query ProductWithTiers($id: ID!) {
          product(id: $id) {
            id
            title
            handle
            featuredImage { url altText }
            priceRangeV2 {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            volumeTiers: metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
              id
              jsonValue
            }
          }
        }`,
      { variables: { id: productId } },
    );
    const json = await response.json();
    result.product = json.data?.product ?? null;
  }

  if (copyFromId) {
    const response = await admin.graphql(
      `#graphql
        query CopyFromTiers($id: ID!) {
          product(id: $id) {
            id
            title
            volumeTiers: metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
              jsonValue
            }
          }
        }`,
      { variables: { id: copyFromId } },
    );
    const json = await response.json();
    const source = json.data?.product;
    result.copyFromTiers = {
      title: source?.title ?? null,
      tiers: source?.volumeTiers?.jsonValue ?? null,
    };
  }

  return result;
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const productId = form.get("productId");
  const tiersRaw = form.get("tiers");

  if (!productId || typeof tiersRaw !== "string") {
    return { ok: false, error: "Missing productId or tiers" };
  }

  let tiers;
  try {
    tiers = JSON.parse(tiersRaw);
  } catch {
    return { ok: false, error: "Invalid tiers JSON" };
  }

  const cleaned = (Array.isArray(tiers) ? tiers : [])
    .map((t) => ({
      min_qty: Number(t.min_qty),
      discount_pct: Number(t.discount_pct),
    }))
    .filter(
      (t) =>
        Number.isFinite(t.min_qty) &&
        Number.isFinite(t.discount_pct) &&
        t.min_qty > 0 &&
        t.discount_pct > 0,
    )
    .sort((a, b) => a.min_qty - b.min_qty);

  if (cleaned.length === 0) {
    const response = await admin.graphql(
      `#graphql
        mutation DeleteVolumeTiers($metafields: [MetafieldIdentifierInput!]!) {
          metafieldsDelete(metafields: $metafields) {
            deletedMetafields { key namespace ownerId }
            userErrors { field message }
          }
        }`,
      {
        variables: {
          metafields: [
            {
              ownerId: productId,
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
    return { ok: true, tiers: [] };
  }

  const response = await admin.graphql(
    `#graphql
      mutation SetVolumeTiers($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id key namespace jsonValue }
          userErrors { field message code }
        }
      }`,
    {
      variables: {
        metafields: [
          {
            ownerId: productId,
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
  return { ok: true, tiers: cleaned };
};

function emptyRow() {
  return { min_qty: "", discount_pct: "" };
}

function tiersToRows(tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0) return [emptyRow()];
  return tiers.map((t) => ({
    min_qty: String(t.min_qty ?? ""),
    discount_pct: String(t.discount_pct ?? ""),
  }));
}

function validateRows(rows) {
  const errors = rows.map(() => ({ min_qty: null, discount_pct: null }));
  const warnings = [];

  const parsed = rows.map((r, i) => ({
    i,
    min_qty: r.min_qty === "" ? null : Number(r.min_qty),
    discount_pct: r.discount_pct === "" ? null : Number(r.discount_pct),
  }));

  parsed.forEach((p) => {
    if (p.min_qty !== null) {
      if (!Number.isFinite(p.min_qty) || p.min_qty <= 0) {
        errors[p.i].min_qty = "Must be > 0";
      } else if (!Number.isInteger(p.min_qty)) {
        errors[p.i].min_qty = "Must be a whole number";
      }
    }
    if (p.discount_pct !== null) {
      if (!Number.isFinite(p.discount_pct) || p.discount_pct <= 0) {
        errors[p.i].discount_pct = "Must be > 0";
      } else if (p.discount_pct >= 100) {
        errors[p.i].discount_pct = "Must be < 100";
      }
    }
  });

  const seenQty = new Map();
  parsed.forEach((p) => {
    if (p.min_qty !== null && !errors[p.i].min_qty) {
      if (seenQty.has(p.min_qty)) {
        errors[p.i].min_qty = "Duplicate min qty";
      } else {
        seenQty.set(p.min_qty, p.i);
      }
    }
  });

  const validParsed = parsed
    .filter(
      (p) =>
        p.min_qty !== null &&
        p.discount_pct !== null &&
        !errors[p.i].min_qty &&
        !errors[p.i].discount_pct,
    )
    .sort((a, b) => a.min_qty - b.min_qty);

  for (let i = 1; i < validParsed.length; i++) {
    if (validParsed[i].discount_pct <= validParsed[i - 1].discount_pct) {
      warnings.push(
        `Tier with min qty ${validParsed[i].min_qty} has a ${validParsed[i].discount_pct}% discount, which is not higher than the previous tier (${validParsed[i - 1].discount_pct}%). Customers buying more won't get a bigger discount.`,
      );
    }
  }

  const hasError = errors.some((e) => e.min_qty || e.discount_pct);
  const hasIncomplete = parsed.some(
    (p) =>
      (p.min_qty !== null && p.discount_pct === null) ||
      (p.min_qty === null && p.discount_pct !== null),
  );

  return { errors, warnings, hasError, hasIncomplete, validParsed };
}

function formatMoney(amount, currencyCode) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode || "USD",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currencyCode ?? ""}`.trim();
  }
}

export default function VolumeDiscounts() {
  const { product, copyFromTiers } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTiers = product?.volumeTiers?.jsonValue;
  const [rows, setRows] = useState(() => tiersToRows(initialTiers));

  useEffect(() => {
    setRows(tiersToRows(initialTiers));
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (copyFromTiers?.tiers && Array.isArray(copyFromTiers.tiers)) {
      setRows(tiersToRows(copyFromTiers.tiers));
      shopify.toast.show(
        `Loaded ${copyFromTiers.tiers.length} tiers from "${copyFromTiers.title ?? "product"}"`,
      );
      const next = new URLSearchParams(searchParams);
      next.delete("copyFrom");
      setSearchParams(next, { replace: true });
    }
  }, [copyFromTiers]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (fetcher.data?.ok) shopify.toast.show("Volume tiers saved");
    else if (fetcher.data?.error)
      shopify.toast.show(`Save failed: ${fetcher.data.error}`, {
        isError: true,
      });
  }, [fetcher.data, shopify]);

  const pickProduct = async () => {
    const selection = await shopify.resourcePicker({
      type: "product",
      multiple: false,
      action: "select",
    });
    if (selection && selection[0]?.id) {
      setSearchParams({ productId: selection[0].id });
    }
  };

  const copyFromAnotherProduct = async () => {
    const selection = await shopify.resourcePicker({
      type: "product",
      multiple: false,
      action: "select",
    });
    if (selection && selection[0]?.id && product) {
      setSearchParams({ productId: product.id, copyFrom: selection[0].id });
    }
  };

  const applyPreset = (key) => {
    const preset = PRESETS[key];
    if (preset) setRows(preset.rows.map((r) => ({ ...r })));
  };

  const updateRow = (idx, field, value) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  };
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (idx) =>
    setRows((prev) =>
      prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== idx),
    );
  const clearAll = () => setRows([emptyRow()]);

  const validation = useMemo(() => validateRows(rows), [rows]);

  const priceInfo = useMemo(() => {
    const range = product?.priceRangeV2;
    if (!range) return null;
    const min = Number(range.minVariantPrice?.amount);
    const max = Number(range.maxVariantPrice?.amount);
    const currency =
      range.minVariantPrice?.currencyCode ??
      range.maxVariantPrice?.currencyCode;
    if (!Number.isFinite(min)) return null;
    const hasRange = Number.isFinite(max) && max !== min;
    return { min, max: hasRange ? max : min, currency, hasRange };
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    if (!product) return;
    fetcher.submit(
      { productId: product.id, tiers: JSON.stringify(rows) },
      { method: "POST" },
    );
  };

  const isSaving =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  const canSave =
    !!product && !validation.hasError && validation.validParsed.length > 0;

  return (
    <s-page heading="Volume discounts">
      <s-button slot="primary-action" onClick={pickProduct}>
        {product ? "Change product" : "Select product"}
      </s-button>

      <s-section heading="Per-product volume tiers">
        <s-paragraph>
          Select a product, then define quantity thresholds and the percentage
          discount that applies when a cart line reaches each threshold. The
          highest matching tier is applied automatically at checkout. Tiers are
          stored in the <s-text>custom.volume_tiers</s-text> product metafield,
          which the storefront PDP reads to preview the discount.
        </s-paragraph>

        {!product && (
          <s-stack direction="block" gap="base">
            <s-paragraph>
              <s-text>No product selected.</s-text>
            </s-paragraph>
            <s-stack direction="inline" gap="base">
              <s-button variant="primary" onClick={pickProduct}>
                Select product
              </s-button>
            </s-stack>
          </s-stack>
        )}

        {product && (
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base">
              {product.featuredImage?.url && (
                <img
                  src={product.featuredImage.url}
                  alt={product.featuredImage.altText ?? ""}
                  style={{ width: 48, height: 48, objectFit: "cover" }}
                />
              )}
              <s-stack direction="block" gap="extra-tight">
                <s-heading>{product.title}</s-heading>
                <s-text color="subdued">{product.handle}</s-text>
              </s-stack>
            </s-stack>

            <s-stack direction="block" gap="tight">
              <s-text emphasis="bold">Quick start</s-text>
              <s-stack direction="inline" gap="tight">
                <s-button
                  variant="secondary"
                  onClick={() => applyPreset("light")}
                >
                  {PRESETS.light.label}
                </s-button>
                <s-button
                  variant="secondary"
                  onClick={() => applyPreset("bulk")}
                >
                  {PRESETS.bulk.label}
                </s-button>
                <s-button variant="tertiary" onClick={copyFromAnotherProduct}>
                  Copy from another product…
                </s-button>
                <s-button variant="tertiary" tone="critical" onClick={clearAll}>
                  Clear all
                </s-button>
              </s-stack>
            </s-stack>

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

                {rows.map((row, idx) => {
                  const rowErr = validation.errors[idx] ?? {};
                  const pct =
                    row.discount_pct === "" ? NaN : Number(row.discount_pct);
                  const showPricing =
                    priceInfo &&
                    !rowErr.discount_pct &&
                    Number.isFinite(pct) &&
                    pct > 0 &&
                    pct < 100;
                  let pricingHint = null;
                  if (showPricing) {
                    const factor = 1 - pct / 100;
                    const origMin = formatMoney(
                      priceInfo.min,
                      priceInfo.currency,
                    );
                    const discMin = formatMoney(
                      priceInfo.min * factor,
                      priceInfo.currency,
                    );
                    if (priceInfo.hasRange) {
                      const origMax = formatMoney(
                        priceInfo.max,
                        priceInfo.currency,
                      );
                      const discMax = formatMoney(
                        priceInfo.max * factor,
                        priceInfo.currency,
                      );
                      pricingHint = `Original: ${origMin}–${origMax} → Tier price: ${discMin}–${discMax}`;
                    } else {
                      pricingHint = `Original: ${origMin} → Tier price: ${discMin}`;
                    }
                  }
                  return (
                    <div key={idx}>
                      <div
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
                          error={rowErr.min_qty ?? undefined}
                          onChange={(e) =>
                            updateRow(idx, "min_qty", e.target.value)
                          }
                        />
                        <s-number-field
                          label="Discount %"
                          labelAccessibilityVisibility="exclusive"
                          value={row.discount_pct}
                          min={0}
                          step={0.1}
                          error={rowErr.discount_pct ?? undefined}
                          onChange={(e) =>
                            updateRow(idx, "discount_pct", e.target.value)
                          }
                        />
                        <s-button
                          variant="tertiary"
                          tone="critical"
                          onClick={() => removeRow(idx)}
                        >
                          Remove
                        </s-button>
                      </div>
                      {pricingHint && (
                        <div style={{ marginTop: 4 }}>
                          <s-text color="subdued">{pricingHint}</s-text>
                        </div>
                      )}
                    </div>
                  );
                })}

                <s-stack direction="inline" gap="base">
                  <s-button variant="secondary" onClick={addRow}>
                    Add tier
                  </s-button>
                  <s-button
                    variant="primary"
                    onClick={save}
                    {...(canSave ? {} : { disabled: true })}
                    {...(isSaving ? { loading: true } : {})}
                  >
                    Save tiers
                  </s-button>
                </s-stack>
              </s-stack>
            </s-box>

            {validation.warnings.length > 0 && (
              <s-banner tone="warning" heading="Check your tier values">
                <s-unordered-list>
                  {validation.warnings.map((w, i) => (
                    <s-list-item key={i}>{w}</s-list-item>
                  ))}
                </s-unordered-list>
              </s-banner>
            )}

            <s-paragraph>
              <s-text color="subdued">
                Empty or invalid rows are dropped on save. Tiers are sorted by
                min quantity ascending.
              </s-text>
            </s-paragraph>
          </s-stack>
        )}
      </s-section>

      {product && validation.validParsed.length > 0 && (
        <s-section slot="aside" heading="Live preview">
          <s-paragraph>
            <s-text color="subdued">
              Discount applied at checkout / shown on PDP for these
              quantities:
            </s-text>
          </s-paragraph>
          <s-stack direction="block" gap="extra-tight">
            {validation.validParsed.map((t, i) => {
              const nextMin = validation.validParsed[i + 1]?.min_qty;
              const range = nextMin
                ? `${t.min_qty}–${nextMin - 1} db`
                : `${t.min_qty}+ db`;
              let pricingHint = null;
              if (priceInfo) {
                const factor = 1 - t.discount_pct / 100;
                const discMin = formatMoney(
                  priceInfo.min * factor,
                  priceInfo.currency,
                );
                if (priceInfo.hasRange) {
                  const discMax = formatMoney(
                    priceInfo.max * factor,
                    priceInfo.currency,
                  );
                  pricingHint = `${discMin}–${discMax}`;
                } else {
                  pricingHint = discMin;
                }
              }
              return (
                <s-stack key={i} direction="block" gap="extra-tight">
                  <s-stack direction="inline" gap="base">
                    <s-text style={{ width: 100 }}>{range}</s-text>
                    <s-text emphasis="bold">{t.discount_pct}%</s-text>
                  </s-stack>
                  {pricingHint && (
                    <s-text color="subdued">→ {pricingHint}</s-text>
                  )}
                </s-stack>
              );
            })}
          </s-stack>
        </s-section>
      )}

      <s-section slot="aside" heading="How it works">
        <s-unordered-list>
          <s-list-item>
            Tiers are stored as JSON at <s-text>custom.volume_tiers</s-text> on
            each product.
          </s-list-item>
          <s-list-item>
            The Shopify Function reads this metafield at checkout and applies
            the highest matching tier as a line-level percentage discount.
          </s-list-item>
          <s-list-item>
            The PDP reads the same metafield via{" "}
            <s-text>window.PDP_CONFIG.discountTiers</s-text>, so storefront and
            checkout stay consistent.
          </s-list-item>
          <s-list-item>
            Create an automatic discount in Admin → Discounts using the uploaded
            Function once per shop.
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
