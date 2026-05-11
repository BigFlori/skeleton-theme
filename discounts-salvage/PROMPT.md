# Volume Discount App — Újra-inicializálási prompt

## Kontextus

A `solar-theme` Shopify-témához tartozó **volume discount** Shopify Function-t újra
kell inicializálni. Az előző `apps/discounts/` mappa törölve lett, mert a build
beakadt és a tiszta scaffolding gyorsabb mint debug-olni.

A téma oldal (PDP) **már be van kötve és NEM kell hozzányúlni**:
- `snippets/pdp-scripts.liquid` exponálja `window.PDP_CONFIG.discountTiers`-ként a
  `product.metafields.custom.volume_tiers.value`-t.
- `assets/pdp.js` `discount(n)` függvénye ebből számolja a kedvezményt
  (pct érték / 100 → decimal).

Tehát a Function-nek **pontosan ugyanazt** a metafieldet kell olvasnia, hogy a PDP
és a checkout konzisztens maradjon.

## Cél

Egyetlen Shopify Function extension, ami:
- Target: `cart.lines.discounts.generate.run`
- Olvassa a `custom.volume_tiers` JSON metafieldet minden cart line variantjának
  termékéről.
- A legmagasabb illeszkedő tier-t alkalmazza line-level **percentage** discount-ként.
- Egy automatikus discount entry-ként él az Admin-ban (per-termék konfig kizárólag
  metafield).

## Konfigurációs értékek amiket be kell állítani

### `shopify.app.toml`
```toml
name = "nrgedge-volume-discounts"
embedded = true

[webhooks]
api_version = "2026-07"

[access_scopes]
scopes = "read_products,write_discounts"
```
(A `client_id` és `application_url` a `shopify app config link` után automatikusan
kerül bele. Az előző `client_id` `b413b602ec6af0e07a2a278184204fa2` volt — ha
ugyanazt a Partner app-ot használjuk újra, ezt fogja visszaadni.)

### `extensions/volume-discount/shopify.extension.toml`
```toml
api_version = "2025-04"

[[extensions]]
name = "Volume Discount"
handle = "volume-discount"
type = "function"
description = "Per-product volume tiers from custom.volume_tiers metafield, applied as line-level percentage discount."

  [[extensions.targeting]]
  target = "cart.lines.discounts.generate.run"
  input_query = "input.graphql"
  export = "run"

  [extensions.build]
  command = "npm run build"
  path = "dist/function.wasm"
```
(A `uid` mező az új scaffolding-ban automatikusan generálódik — **ne** másold át
a régit.)

## Saját fájlok ebben a mappában (újrahasznosítandó)

| Fájl | Cél helye az új app-ban |
|---|---|
| `run.js` | `apps/discounts/extensions/volume-discount/src/run.js` |
| `input.graphql` | `apps/discounts/extensions/volume-discount/input.graphql` |
| `tier-examples.json` | nem fájlként — referencia az Admin metafield kitöltéshez |

A `run.js` és `input.graphql` változtatás nélkül átmásolható.

## Lépések

1. **Töröld** a régi `apps/discounts/` mappát (ha még nem történt meg).
2. Scaffold: a project gyökerében:
   ```bash
   mkdir -p apps/discounts && cd apps/discounts
   shopify app init --name nrgedge-volume-discounts --template none
   ```
   (vagy `shopify app generate extension` egy üres szülőből — amelyik megy)
3. Generáld az extension-t:
   ```bash
   shopify app generate extension --template discount --name volume-discount --flavor vanilla-js
   ```
4. Másold be a `run.js`-t és `input.graphql`-t ebből a salvage mappából a megfelelő
   helyre. Frissítsd a `shopify.extension.toml`-t a fenti targeting + build blokkal.
5. Frissítsd a `shopify.app.toml`-t a fenti scope-okkal + api_version-nel.
6. Build smoke test:
   ```bash
   cd apps/discounts
   npm install
   shopify app build
   ```
   Ha itt beakad: nézd meg a node verziót (20+ kell), töröld `node_modules`-t és
   `package-lock.json`-t, próbáld újra. Windows-on a Javy build néha lassú az első
   futtatáskor (egyszer letölti a Javy binárist) — ne öld meg túl korán.
7. Dev futtatás (interaktív, a user indítja):
   ```bash
   shopify app dev
   ```

## Admin oldali egyszeri setup (a deploy után)

1. **Settings → Custom data → Products → Add definition**
   - Namespace + key: `custom.volume_tiers`
   - Type: **JSON**
   - Storefronts: **Read access ON** (kritikus — a PDP különben üres tömböt kap)
2. **Discounts → Create discount → Amount off products**
   - Method: `volume-discount` (a feltöltött Function)
   - Discount method: **Automatic**
   - Title: `Volume discount`
3. Termékenként töltsd a `custom.volume_tiers` metafieldet — lásd
   `tier-examples.json`.

## Acceptance check

- Termék PDP betöltésekor `window.PDP_CONFIG.discountTiers` a Console-ban
  megegyezik a metafield tartalmával.
- 36+ TRINA panelt rakva a kosárba a checkout-ban megjelenik a "Volume −1%"
  (vagy magasabb tier) line discount.
- A PDP-n mutatott % és a checkout-ban levont % megegyezik.
