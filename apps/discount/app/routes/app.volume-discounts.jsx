import { useEffect, useState } from "react";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

const METAFIELD_NAMESPACE = "custom";
const METAFIELD_KEY = "volume_tiers";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");

  if (!productId) return { product: null };

  const response = await admin.graphql(
    `#graphql
      query ProductWithTiers($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          featuredImage { url altText }
          volumeTiers: metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
            id
            jsonValue
          }
        }
      }`,
    { variables: { id: productId } },
  );
  const json = await response.json();
  return { product: json.data?.product ?? null };
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

export default function VolumeDiscounts() {
  const { product } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const [, setSearchParams] = useSearchParams();

  const initialTiers = product?.volumeTiers?.jsonValue;
  const [rows, setRows] = useState(() =>
    Array.isArray(initialTiers) && initialTiers.length > 0
      ? initialTiers.map((t) => ({
          min_qty: String(t.min_qty ?? ""),
          discount_pct: String(t.discount_pct ?? ""),
        }))
      : [emptyRow()],
  );

  useEffect(() => {
    setRows(
      Array.isArray(initialTiers) && initialTiers.length > 0
        ? initialTiers.map((t) => ({
            min_qty: String(t.min_qty ?? ""),
            discount_pct: String(t.discount_pct ?? ""),
          }))
        : [emptyRow()],
    );
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <s-paragraph>
            <s-text>No product selected.</s-text>
          </s-paragraph>
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

            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <s-stack direction="block" gap="base">
                <s-stack direction="inline" gap="base">
                  <s-text emphasis="bold" style={{ width: 160 }}>
                    Min quantity
                  </s-text>
                  <s-text emphasis="bold" style={{ width: 160 }}>
                    Discount %
                  </s-text>
                  <s-text emphasis="bold">&nbsp;</s-text>
                </s-stack>

                {rows.map((row, idx) => (
                  <s-stack key={idx} direction="inline" gap="base">
                    <s-number-field
                      label="Min quantity"
                      labelAccessibilityVisibility="exclusive"
                      value={row.min_qty}
                      min={1}
                      step={1}
                      onChange={(e) =>
                        updateRow(idx, "min_qty", e.target.value)
                      }
                      style={{ width: 160 }}
                    />
                    <s-number-field
                      label="Discount %"
                      labelAccessibilityVisibility="exclusive"
                      value={row.discount_pct}
                      min={0}
                      step={0.1}
                      onChange={(e) =>
                        updateRow(idx, "discount_pct", e.target.value)
                      }
                      style={{ width: 160 }}
                    />
                    <s-button
                      variant="tertiary"
                      tone="critical"
                      onClick={() => removeRow(idx)}
                    >
                      Remove
                    </s-button>
                  </s-stack>
                ))}

                <s-stack direction="inline" gap="base">
                  <s-button variant="secondary" onClick={addRow}>
                    Add tier
                  </s-button>
                  <s-button
                    variant="primary"
                    onClick={save}
                    {...(isSaving ? { loading: true } : {})}
                  >
                    Save tiers
                  </s-button>
                </s-stack>
              </s-stack>
            </s-box>

            <s-paragraph>
              <s-text color="subdued">
                Empty or invalid rows are dropped on save. Tiers are sorted by
                min quantity ascending.
              </s-text>
            </s-paragraph>
          </s-stack>
        )}
      </s-section>

      <s-section slot="aside" heading="How it works">
        <s-unordered-list>
          <s-list-item>
            Tiers are stored as JSON at{" "}
            <s-text>custom.volume_tiers</s-text> on each product.
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
            Create an automatic discount in Admin → Discounts using the
            uploaded Function once per shop.
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
