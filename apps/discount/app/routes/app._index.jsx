import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <s-page heading="Volume discount app">
      <s-button slot="primary-action" href="/app/volume-discounts">
        Manage volume tiers
      </s-button>

      <s-section heading="Per-product volume discounts">
        <s-paragraph>
          Configure quantity-based discount tiers for individual products.
          Tiers are stored on each product as the{" "}
          <s-text>custom.volume_tiers</s-text> JSON metafield. The Shopify
          Function included with this app reads that metafield at checkout and
          applies the highest matching tier as a line-level percentage
          discount. The storefront PDP reads the same metafield, so the
          discount preview shown to the customer and the discount applied at
          checkout always match.
        </s-paragraph>
      </s-section>

      <s-section heading="Setup checklist">
        <s-ordered-list>
          <s-list-item>
            Deploy the app (<s-text>shopify app deploy</s-text>) so the
            Function and the <s-text>custom.volume_tiers</s-text> metafield
            definition are registered on the shop.
          </s-list-item>
          <s-list-item>
            In Shopify admin, go to <s-text>Discounts → Create discount →
            Amount off products</s-text>, pick the uploaded Function, set
            method to <s-text>Automatic</s-text>, and save.
          </s-list-item>
          <s-list-item>
            Open <s-link href="/app/volume-discounts">Volume discounts</s-link>{" "}
            and configure tiers per product.
          </s-list-item>
        </s-ordered-list>
      </s-section>

      <s-section slot="aside" heading="Tier JSON shape">
        <s-paragraph>
          Each row is stored as <s-text>{`{ min_qty, discount_pct }`}</s-text>.
          Example:
        </s-paragraph>
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <pre style={{ margin: 0 }}>
            <code>{`[
  { "min_qty": 36, "discount_pct": 1.0 },
  { "min_qty": 72, "discount_pct": 2.3 },
  { "min_qty": 108, "discount_pct": 5.0 }
]`}</code>
          </pre>
        </s-box>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
