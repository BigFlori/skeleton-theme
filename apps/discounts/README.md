# nrgedge — Discounts App

Per-product volume discount implemented as a Shopify Function. A single automatic discount entry
is created in the admin; the actual tier table lives on each product in a JSON metafield, so the
PDP and the checkout both read from the same source of truth.

## Layout

```
apps/discounts/
├── shopify.app.toml                      # app config (needs client_id after Partner linking)
├── package.json                          # workspace root, npm scripts for shopify CLI
└── extensions/
    └── volume-discount/
        ├── shopify.extension.toml        # function extension manifest
        ├── input.graphql                 # query for cart lines + product metafield
        ├── package.json
        └── src/
            └── run.js                    # discount logic (vanilla JS, compiled with Javy)
```

## Data contract

Product metafield:

| field      | value                                           |
|------------|-------------------------------------------------|
| namespace  | `custom`                                        |
| key        | `volume_tiers`                                  |
| type       | `json`                                          |
| shape      | `[{ "min_qty": <int>, "discount_pct": <float> }, …]` |

Behavior:

- For each cart line the Function finds the highest tier whose `min_qty` ≤ `line.quantity` and
  applies `discount_pct` as a line-level percentage discount.
- Missing / empty / malformed metafield → that line is skipped (no discount).
- Same metafield is read on the PDP via Liquid, so the shown percentage matches what the
  Function applies at checkout.

## Prerequisites

- Node.js 20+
- Shopify CLI 3.x (`npm i -g @shopify/cli @shopify/theme`)
- A Shopify Partner account with an app created (or `shopify app config link` to attach this
  config to an existing app)

## One-time setup

### 1. Define the metafield in Admin

Go to **Settings → Custom data → Products → Add definition**:

- Namespace and key: `custom.volume_tiers`
- Type: **JSON**
- Validation: leave empty (the Function tolerates anything; bad rows are skipped)
- Access: storefronts can read (needed so the PDP Liquid can render the tiers)

### 2. Link the app

From this directory (`apps/discounts/`):

```bash
npm install
shopify login
shopify app config link        # picks the Partner app, fills in client_id in shopify.app.toml
```

### 3. Deploy the function

```bash
shopify app deploy
```

This builds `extensions/volume-discount/dist/function.wasm` and uploads it to the linked app.

### 4. Create the discount in Admin

In the store admin:

1. Open **Discounts → Create discount → Amount off products**.
2. In the method selector, pick **volume-discount** (the function uploaded in step 3).
3. Method: **Automatic**.
4. Title: e.g. `Volume discount` (only shown internally).
5. Active dates: as needed.
6. Save.

There is exactly one such entry — per-product configuration lives entirely in the metafield.

### 5. Set tiers on products

On each product, fill the `custom.volume_tiers` metafield with a JSON array. Examples used during
development (rounded percentages — set the real numbers per product):

```json
// TRINA solar panel
[
  { "min_qty": 36,  "discount_pct": 1.0 },
  { "min_qty": 72,  "discount_pct": 2.3 },
  { "min_qty": 108, "discount_pct": 5.0 }
]
```

```json
// V120 roof hook
[
  { "min_qty": 50,  "discount_pct": 2.6 },
  { "min_qty": 200, "discount_pct": 6.2 },
  { "min_qty": 500, "discount_pct": 17.3 }
]
```

```json
// Solfix M10x25 bolt
[
  { "min_qty": 500,  "discount_pct": 4.1 },
  { "min_qty": 1000, "discount_pct": 6.8 },
  { "min_qty": 5000, "discount_pct": 13.7 }
]
```

## Theme integration

The theme reads the same metafield on the PDP, so the badge/price preview matches checkout:

- `snippets/pdp-scripts.liquid` exposes the array as `window.PDP_CONFIG.discountTiers`.
- `assets/pdp.js` `discount(n)` picks the highest matching tier and converts to decimal
  (e.g. `4.1` → `0.041`). Empty array → returns `0` → no badge, no price strikethrough.

No hardcoded thresholds remain in the theme.

## Local development

```bash
shopify app dev
```

Runs the Function against a development store. The CLI prints a URL for live debugging; cart
mutations stream through your function in real time.

To test the JS output once without a live cart:

```bash
cd extensions/volume-discount
shopify app function run --input fixtures/some-input.json
```

(Add fixtures under `extensions/volume-discount/fixtures/` as you need them — not committed by
default.)

## Troubleshooting

- **No discount applied at checkout** — confirm (a) the discount entry in Admin is **Active**,
  (b) the metafield exists on the product with the correct namespace/key, (c) the JSON parses,
  (d) the cart line quantity meets at least the lowest `min_qty`.
- **PDP shows discount but checkout doesn't** — usually a metafield-not-storefront-readable
  problem. Re-check the access setting on the metafield definition.
- **PDP shows no discount but checkout does** — the storefront variable was empty when the page
  rendered; verify the metafield is set on that specific product and re-publish.
