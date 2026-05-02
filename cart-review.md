# Cart Page Review

Három párhuzamos agent review eredménye: UX, Accessibility (WCAG 2.1 AA), SEO + Technical.

---

## Bugok — azonnali javítás

| # | Fájl | Probléma | Javítás |
|---|------|---------|---------|
| ✅ B1 | `snippets/cart-summary.liquid` | Checkout gomb `href="/checkout"` hardcoded — Shopify Markets + locale URL-ek törnek | `{% form 'cart', cart %}` + `name="checkout"` gomb — `routes.checkout_url` üres ezen a store-on |
| ✅ B2 ⚠️ nem tesztelt | `snippets/cart-summary.liquid:37` | VAT sor `€ 0.00` statikusan hardcoded | `{{ cart.total_tax \| money }}` — adó admin-beállítás hiányában nem tesztelhető |
| ✅ B3 | `snippets/meta-tags.liquid` | Cart oldal indexálható — nincs noindex direktíva | `<meta name="robots" content="noindex, nofollow">` cart page_type-ra |
| ✅ B4 | `snippets/cart-line-item.liquid:62–69` | "Save for later" gomb `disabled` állapotban renderelődik — félrevezető, nonfunkcionális UI, nincs magyarázat | Törlés vagy `hidden` attribútum amíg nincs wishlist logika |
| B5 | `snippets/cart-upsell.liquid:36–43` | "Add" gomb + ikon a terméklapra navigál, nem rakja kosárba — szemantikailag helytelen | Label módosítás "View"-ra, vagy Ajax `/cart/add.js` implementáció |

---

## Magas prioritás

### UX

| # | Fájl | Probléma |
|---|------|---------|
| ✅ H1 | `sections/cart.liquid` JS:652–654 | Qty=1 → decrement → azonnali törlés, `location.reload()`, nincs undo/megerősítés — €2000+ tételeknél kritikus |
| ✅ H2 | `snippets/cart-summary.liquid` | Out-of-stock termékekkel a checkout gomb nincs letiltva — a vevő leadhatja a rendelést, a checkout oldal visszadobja |
| ✅ H3 | `snippets/cart-summary.liquid:59–62` | Discount szekció: csak magyarázó szöveg, nincs input mező — törött form érzetét kelti |

### Accessibility

| # | Fájl | Probléma |
|---|------|---------|
| H4 | `sections/cart.liquid` CSS (teljes stylesheet) | Nincs `:focus-visible` stílus egyetlen interaktív elemen sem — ha a globális CSS törli az outline-t, az egész cart billentyűzet-vak |
| H5 | `sections/cart.liquid` CSS:243, 254 | `#964A16` (low-stock szöveg, 11px) ~3.8:1 kontraszt — WCAG AA **FAIL** (minimum 4.5:1 szükséges) |
| H6 | `sections/cart.liquid` JS:566 | Sikeres qty-változásról nincs screen reader bejelentés — nincs `aria-live` frissítés a darabszámra/összegre |
| H7 | `sections/cart.liquid` JS:628–630 | `location.reload()` termékeltávolításnál elveszíti a fókuszt — screen reader felhasználó az oldal tetejéről kénytelen újra navigálni |

---

## Közepes prioritás

| # | Fájl | Terület | Probléma |
|---|------|---------|---------|
| M1 | `snippets/cart-progress.liquid:3–15` | A11y | `aria-disabled` `listitem`-en nem érvényes ARIA; aktív lépésen kell `aria-current="step"` |
| M2 | `sections/cart.liquid:1–11` | UX | Van threshold logika de nincs free shipping progress bar — az egyik legjobb konverziós eszköz |
| M3 | `sections/cart.liquid` JS:633–640 | UX | Sikertelen API call után az input értéke nem áll vissza az előző helyes értékre (desync) |
| M4 | `snippets/cart-empty.liquid:9` | UX | `#pakete` anchor hardcoded és csak németül — section ID változáskor csendesen elromlik; legyen theme setting |
| M5 | `sections/cart.liquid` JS:556–563 | Tech | `formatMoney` nem kezeli az `amount_with_space_separator` és `amount_no_decimals_with_space_separator` formátumokat |
| M6 | `snippets/cart-summary.liquid:64` | A11y | `aria-label` `<div>`-en role nélkül — accessibility tree-ben nincs hatása; kell `role="img"` |
| M7 | `snippets/cart-upsell.liquid:32` | A11y | `<h4>` a upsellben kihagyja a `<h3>` szintet → törött heading hierarchia (WCAG 1.3.1) |
| M8 | `sections/cart.liquid` JS:623–625, 636–639 | UX/i18n | Toast error üzenetek angolul hardcoded — DE és HU storefrontra is angolul jelennének meg |

---

## Alacsony prioritás / Info

| # | Fájl | Terület | Probléma |
|---|------|---------|---------|
| L1 | `sections/cart.liquid` JS:628–630 | UX | `location.reload()` törlésnél kellemetlen — a DOM update infrastruktúra már megvan, csak `lineEl.remove()` hiányzik |
| L2 | `snippets/cart-line-item.liquid:13–20` | Perf | `srcset` hiányzik — 192px kép töltődik 96px displayhez; non-retina eszközök feleslegesen töltenek |
| L3 | `snippets/cart-upsell.liquid:19–24` | Perf | Ugyanaz a srcset probléma: 240px fetch, 120px display |
| L4 | `snippets/cart-line-item.liquid:1` | A11y | `<article>` line item-eknek nincs accessible name — kell `aria-label="{{ item.product.title \| escape }}"` |
| L5 | `snippets/cart-hero.liquid:1`, `snippets/cart-progress.liquid:1`, `sections/cart.liquid:22` | A11y | `<section>` elemek névtelenek — generikus containerként viselkednek, nem landmark-ként |
| L6 | `snippets/cart-summary.liquid:6` | A11y | `<aside>` nincs `aria-labelledby`-val ellátva az `<h2>`-re |
| L7 | `sections/cart.liquid` JS:525–526 | A11y | Toast: `textContent` be van állítva mielőtt `hidden = false` — egyes screen readerek kihagyhatják a bejelentést |
| L8 | `snippets/cart-upsell.liquid:20` | A11y | Upsell kép alt text hiányzik ha a merchant nem tölt ki — kell `\| default: product.title` fallback |
| L9 | `snippets/cart-hero.liquid:5` | UX | "Continue shopping" a főoldalra mutat, nem az utolsó meglátogatott kollekcióra |
| L10 | `snippets/cart-summary.liquid` | UX | Hiányoznak trust signalok (visszaküldési feltételek, garancia, szállítási idő) a checkout gomb közelében |
| L11 | `sections/cart.liquid` JS | UX | Qty stepper decrement 0-ra vs. kézi input 0 beírása eltérően viselkedik (inconsistent) |
| L12 | `sections/cart.liquid` CSS:304–315 | UX | 600px-en qty gombok 30×30px — Apple HIG minimum 44×44px, Google MD 48×48px |
| L13 | Minden cart snippet | Tech | Nincs non-JS `<form>` fallback cart műveletekhez — JS nélkül a cart teljesen működésképtelen |
| L14 | `sections/cart.liquid:699, 705` | Tech | Schema label `€` szimbólummal hardcoded — multi-currency esetén félrevezető |

---

## Prioritizált javítási sorrend

1. **B1** — `routes.checkout_url` (1 sor)
2. **B3** — noindex meta tag (2–3 sor)
3. **B2** — `cart.total_tax | money` (1 sor)
4. **B4** — "Save for later" gomb elrejtése
5. **H3** — Discount szekció redesign vagy label csere
6. **H1** — Törlés megerősítése / undo toast
7. **H4** — `:focus-visible` stílusok
8. **H5** — `#964A16` szín sötétítése (~`#7A3A0D`)
9. **M2** — Free shipping progress bar
10. **B5 + M6** — Upsell gomb szemantika + payment div role
