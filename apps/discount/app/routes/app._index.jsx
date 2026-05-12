import { useEffect } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

const METAFIELD_NAMESPACE = "custom";
const METAFIELD_KEY = "volume_tiers";
const BANDS_METAFIELD_KEY = "volume_tier_bands";
const PAGE_SIZE = 50;

const ROW_GRID_STYLE = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 80px 140px 120px 180px",
  columnGap: 24,
  alignItems: "center",
};

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");

  const response = await admin.graphql(
    `#graphql
      query ProductsWithTiers($first: Int!, $after: String) {
        products(
          first: $first,
          after: $after,
          query: "metafields.${METAFIELD_NAMESPACE}.${METAFIELD_KEY}:*"
        ) {
          edges {
            cursor
            node {
              id
              title
              handle
              featuredImage { url altText }
              volumeTiers: metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
                id
                jsonValue
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
        shop {
          currencyCode
          bands: metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${BANDS_METAFIELD_KEY}") {
            jsonValue
          }
        }
      }`,
    { variables: { first: PAGE_SIZE, after: cursor } },
  );
  const json = await response.json();
  const products = (json.data?.products?.edges ?? [])
    .map((e) => e.node)
    .filter((p) => {
      const v = p.volumeTiers?.jsonValue;
      return Array.isArray(v) && v.length > 0;
    });
  const pageInfo = json.data?.products?.pageInfo ?? {
    hasNextPage: false,
    endCursor: null,
  };
  const bandsRaw = json.data?.shop?.bands?.jsonValue;
  const bandCount = Array.isArray(bandsRaw) ? bandsRaw.length : 0;
  const currencyCode = json.data?.shop?.currencyCode ?? null;
  return { products, pageInfo, bandCount, currencyCode };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "clear") {
    const metafieldId = form.get("metafieldId");
    if (!metafieldId) {
      return { ok: false, error: "Missing metafieldId" };
    }
    const response = await admin.graphql(
      `#graphql
        mutation DeleteMetafield($input: MetafieldIdentifierInput!) {
          metafieldsDelete(metafields: [$input]) {
            deletedMetafields { key namespace ownerId }
            userErrors { field message }
          }
        }`,
      { variables: { input: { id: metafieldId } } },
    );
    const json = await response.json();
    const errors = json.data?.metafieldsDelete?.userErrors ?? [];
    if (errors.length > 0) {
      return { ok: false, error: errors.map((e) => e.message).join("; ") };
    }
    return { ok: true };
  }

  return { ok: false, error: "Unknown intent" };
};

function summarize(tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return { count: 0, minQty: null, maxQty: null, maxPct: null };
  }
  const qtys = tiers
    .map((t) => Number(t.min_qty))
    .filter((n) => Number.isFinite(n));
  const pcts = tiers
    .map((t) => Number(t.discount_pct))
    .filter((n) => Number.isFinite(n));
  return {
    count: tiers.length,
    minQty: qtys.length ? Math.min(...qtys) : null,
    maxQty: qtys.length ? Math.max(...qtys) : null,
    maxPct: pcts.length ? Math.max(...pcts) : null,
  };
}

export default function Index() {
  const { products, pageInfo, bandCount, currencyCode } = useLoaderData();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.data?.ok) shopify.toast.show("Tiers cleared");
    else if (fetcher.data?.error)
      shopify.toast.show(`Error: ${fetcher.data.error}`, { isError: true });
  }, [fetcher.data, shopify]);

  const pickProductToEdit = async () => {
    const selection = await shopify.resourcePicker({
      type: "product",
      multiple: false,
      action: "select",
    });
    if (selection && selection[0]?.id) {
      navigate(
        `/app/volume-discounts?productId=${encodeURIComponent(selection[0].id)}`,
      );
    }
  };

  const editProduct = (productId) => {
    navigate(
      `/app/volume-discounts?productId=${encodeURIComponent(productId)}`,
    );
  };

  const clearTiers = (metafieldId) => {
    if (!metafieldId) return;
    fetcher.submit(
      { intent: "clear", metafieldId },
      { method: "POST" },
    );
  };

  const isClearing = fetcher.state !== "idle";

  return (
    <s-page heading="Volume discounts">
      <s-button slot="primary-action" onClick={pickProductToEdit}>
        Add tiers to product
      </s-button>

      <s-banner
        tone={bandCount > 0 ? "info" : "warning"}
        heading={
          bandCount > 0
            ? `Price band defaults: ${bandCount} band${bandCount === 1 ? "" : "s"} active (${currencyCode ?? "shop currency"})`
            : "No price band defaults configured"
        }
      >
        <s-paragraph>
          {bandCount > 0
            ? "Products without their own volume_tiers metafield will use the band whose price range contains their variant price."
            : "Define default tiers per price band so every product without per-product overrides still gets a volume discount."}
        </s-paragraph>
        <s-button variant="tertiary" href="/app/price-bands">
          Manage price bands
        </s-button>
      </s-banner>

      {products.length === 0 ? (
        <>
          <s-section heading="No products with volume tiers yet">
            <s-stack direction="block" gap="base">
              <s-paragraph>
                Get started by picking a product and configuring its
                quantity-based discount tiers. Tiers are stored on each product
                as the <s-text>custom.volume_tiers</s-text> JSON metafield.
              </s-paragraph>
              <s-stack direction="inline" gap="base">
                <s-button variant="primary" onClick={pickProductToEdit}>
                  Add tiers to product
                </s-button>
              </s-stack>
            </s-stack>
          </s-section>

          <s-section slot="aside" heading="Setup checklist">
            <s-ordered-list>
              <s-list-item>
                Deploy the app (<s-text>shopify app deploy</s-text>) so the
                Function and the <s-text>custom.volume_tiers</s-text> metafield
                definition are registered on the shop.
              </s-list-item>
              <s-list-item>
                In Shopify admin, go to{" "}
                <s-text>
                  Discounts → Create discount → Amount off products
                </s-text>
                , pick the uploaded Function, set method to{" "}
                <s-text>Automatic</s-text>, and save.
              </s-list-item>
              <s-list-item>
                Use <s-text>Add tiers to product</s-text> to configure tiers per
                product.
              </s-list-item>
            </s-ordered-list>
          </s-section>

          <s-section slot="aside" heading="How it works">
            <s-unordered-list>
              <s-list-item>
                The Shopify Function reads{" "}
                <s-text>custom.volume_tiers</s-text> at checkout and applies the
                highest matching tier as a line-level percentage discount.
              </s-list-item>
              <s-list-item>
                The PDP reads the same metafield via{" "}
                <s-text>window.PDP_CONFIG.discountTiers</s-text>, so storefront
                and checkout stay consistent.
              </s-list-item>
            </s-unordered-list>
          </s-section>
        </>
      ) : (
        <s-section
          heading={`Products with volume tiers (${products.length}${
            pageInfo.hasNextPage ? "+" : ""
          })`}
        >
          <s-stack direction="block" gap="base">
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <div style={ROW_GRID_STYLE}>
                <s-text emphasis="bold">Product</s-text>
                <s-text emphasis="bold">Tiers</s-text>
                <s-text emphasis="bold">Quantity range</s-text>
                <s-text emphasis="bold">Max discount</s-text>
                <s-text emphasis="bold">Actions</s-text>
              </div>
            </s-box>

            {products.map((p) => {
              const tiers = p.volumeTiers?.jsonValue ?? [];
              const s = summarize(tiers);
              return (
                <s-box
                  key={p.id}
                  padding="base"
                  borderWidth="base"
                  borderRadius="base"
                >
                  <div style={ROW_GRID_STYLE}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        minWidth: 0,
                      }}
                    >
                      {p.featuredImage?.url ? (
                        <img
                          src={p.featuredImage.url}
                          alt={p.featuredImage.altText ?? ""}
                          style={{
                            width: 40,
                            height: 40,
                            objectFit: "cover",
                            borderRadius: 4,
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            background: "#f1f1f1",
                            borderRadius: 4,
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <div style={{ minWidth: 0, overflow: "hidden" }}>
                        <s-text emphasis="bold">{p.title}</s-text>
                        <div>
                          <s-text color="subdued">{p.handle}</s-text>
                        </div>
                      </div>
                    </div>
                    <s-text>{s.count}</s-text>
                    <s-text>
                      {s.minQty != null
                        ? s.minQty === s.maxQty
                          ? `${s.minQty}+`
                          : `${s.minQty}–${s.maxQty}+`
                        : "—"}
                    </s-text>
                    <s-text>
                      {s.maxPct != null ? `${s.maxPct}%` : "—"}
                    </s-text>
                    <div style={{ display: "flex", gap: 8 }}>
                      <s-button
                        variant="secondary"
                        onClick={() => editProduct(p.id)}
                      >
                        Edit
                      </s-button>
                      <s-button
                        variant="tertiary"
                        tone="critical"
                        onClick={() => clearTiers(p.volumeTiers?.id)}
                        {...(isClearing ? { loading: true } : {})}
                      >
                        Clear
                      </s-button>
                    </div>
                  </div>
                </s-box>
              );
            })}

            {pageInfo.hasNextPage && (
              <s-stack direction="inline" gap="base">
                <s-button
                  variant="secondary"
                  href={`/app?cursor=${encodeURIComponent(
                    pageInfo.endCursor ?? "",
                  )}`}
                >
                  Load next page
                </s-button>
              </s-stack>
            )}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
