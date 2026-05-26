# Launch TODO — Kritikus blocker-lista

> Dátum: 2026-05-22
> Forrás: 4 párhuzamos audit (UI/UX, Shopify best-practice, performance+a11y, konverziós flow)
>
> **Verdikt: NEM állunk készen az indulásra.** Az alábbi tételek nélkül a bolt sem jogilag (EU/GDPR), sem funkcionálisan (vásárlói fiók), sem akadálymentesség szempontjából (WCAG) nem indítható élesen.
>
> Audit pontszámok: UI/UX **7/10** · Best-practice **7/10** · Konverzió **6.5/10** · Performance **7/10** · Accessibility **5/10**

---

## 🔴 P0 — Jogi / funkcionális blocker (indulás előtt KÖTELEZŐ)

### 1. ~~Customer account templates teljesen hiányoznak~~ ✅ KÉSZ
~~A `templates/customers/` mappa nem létezik~~ → a bolt **új (hostolt) Customer Accounts** rendszert használ (`https://shopify.com/93961322881/account`), így sem classic templatek, sem `customers.*` locales kulcsok nem szükségesek. A téma csak az account-linkeket biztosítja:
- [sections/header.liquid](sections/header.liquid) — `user` ikon-gomb a jobb oldali oszlopban (csak desktop, `shop.customer_accounts_enabled` flag mögött)
- [snippets/mobile-nav-drawer.liquid](snippets/mobile-nav-drawer.liquid) — "Fiók" pill-link mobilon a nyelvválasztó fölött
- [snippets/icon.liquid](snippets/icon.liquid) — új `user` ikon
- `general.account` kulcs hozzáadva en/hu/de locale-okhoz

### 3. ~~`all-products` handle konvenció sértés~~ ✅ KÉSZ
~~[snippets/cart-hero.liquid:5](snippets/cart-hero.liquid#L5) `routes.all_products_collection_url`-t használ~~ → átírva `{{ collections['all-products'].url }}`-ra.

### 4. ~~Theme metadata még "Skeleton" / Shopify default~~ ✅ KÉSZ
~~[config/settings_schema.json](config/settings_schema.json) `theme_info` blokkban a `theme_name` és `theme_author` még a Shopify alapérték~~ → `theme_name: "Sonnwerk"`, `theme_author: "Sonnwerk"`, `theme_version: "1.0.0"`.

---

## 🟠 P1 — Accessibility (WCAG A/AA fail, audit-blocker)

### 5. ~~Skip-to-content link hiánya (WCAG 2.4.1, A szint)~~ ✅ KÉSZ
~~Sehol nincs skip link~~ → `<a class="sw-skip-link" href="#main-content">` hozzáadva [layout/theme.liquid](layout/theme.liquid)-be, fordítás (`general.skip_to_content`) en/hu/de locale-okban, stílus `critical.css`-ben.

### 6. ~~`<main>` landmark hiánya a templatekben~~ ✅ KÉSZ
~~Csak `templates/gift_card.liquid`-ben van `<main>`~~ → `<main id="main-content" role="main" tabindex="-1">` wrapper a `{{ content_for_layout }}` köré.

### 7. ~~Focus-visible stílus hiánya~~ ✅ KÉSZ
~~Nincs globális focus indicator~~ → `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` hozzáadva [critical.css](assets/critical.css)-hez.

---

## 🟡 P2 — Konverziós blocker (élesben látható hiány)

### 8. ~~Search oldal csontváz~~ ✅ KÉSZ
~~[sections/search.liquid](sections/search.liquid) Dawn-alapú stub~~ → `sw-search` design: breadcrumb, centered hero (`title_pre` + italic `title_em`), nagy form ikonnal + clear gombbal, `collection-product-card` grid termékekre, külön lista articles/pages-re, no-results üres állapot (kerek ikon + 2 CTA), intro state.

### 9. ~~Predictive search nincs~~ ✅ KÉSZ
~~Nincs `predictive-search.liquid` snippet, nincs `/search/suggest` integráció~~ → [snippets/predictive-search.liquid](snippets/predictive-search.liquid) top-down drawer + [assets/predictive-search.js](assets/predictive-search.js) (180ms debounce, AbortController, products/articles/pages bontás, "View all" link, Esc + Cmd/Ctrl+K shortcut, history.pushState back-button támogatással). Header `data-search-trigger` gomb [sections/header.liquid](sections/header.liquid)-ben.

### 10. ~~Hardcoded `€` szimbólum cart drawer-ben~~ ✅ KÉSZ
~~Free-shipping threshold címkén fix `€`~~ → a megjelenített összegek már `money` filtert használtak; az admin schema label currency-szimbólum nélküli ("Free shipping threshold") + info clarification.

### 11. Reviews / social proof teljes hiánya
Sem PDP-n, sem product cardon nincs csillag rating / véleményszám.
- **Action:** JudgeMe / Loox / Shopify Product Reviews app integráció + PDP block

---

## 🟢 P3 — Performance / nice-to-have

### 12. Google Fonts render-blocking
[layout/theme.liquid:21](layout/theme.liquid#L21) blocking `<link rel="stylesheet">` Google CDN-re. Render-blokkoló third-party erőforrás.
- **Action:** Vagy self-host (Shopify font_picker + font_url), vagy `media="print"` swap trükk
- **Megjegyzés:** GDPR oldalról a Shopify natív cookie banner (admin → Customer privacy) kezeli a consentet — itt csak performance és third-party függőség a probléma

### 13. `sonnwerk.css` és `pkg-card.css` render-blocking
[layout/theme.liquid:25-26](layout/theme.liquid) — nem critical, mégis blokkoló `<link>`.
- **Action:** `preload` + `media="print"` swap, vagy critical inline + async rest

### 14. ~~OG kép width nélkül~~ ✅ KÉSZ
~~[snippets/meta-tags.liquid:50-67](snippets/meta-tags.liquid) `page_image | image_url` width paraméter nélkül~~ → `image_url: width: 1200`, arányos `og:image:height` számítva.

### 15. ~~Blog / article képek nem optimalizáltak~~ ✅ KÉSZ
~~[sections/article.liquid:10](sections/article.liquid#L10), [sections/blog.liquid:14](sections/blog.liquid#L14): `image_tag` srcset / sizes / loading nélkül~~ → responsive `widths` srcset, `sizes` és `loading: 'lazy'` hozzáadva, alt fallback `article.title`-re.

### 16. ~~Footer emoji zászlók~~ ✅ KÉSZ
~~🇦🇹 🇩🇪 emoji~~ → inline SVG zászlók (AT: piros-fehér-piros, DE: fekete-piros-arany) a [sections/footer.liquid](sections/footer.liquid)-ben, cross-browser konzisztens render.

### 17. ~~Organization JSON-LD hiánya~~ ✅ KÉSZ
~~Csak Product schema létezik~~ → site-szintű `Organization` (név, url, logo) + `WebSite` (SearchAction) JSON-LD a [snippets/meta-tags.liquid](snippets/meta-tags.liquid)-ben.

### 18. Repo cleanup
Gyökérben TODO dokumentumok: `cart-review.md`, `TRANSLATION-FIX.md`, `METAOBJECTS.md`, `design_handoff_sonnwerk_landing/`, `example-project/`, `hello-world.liquid`, `custom-section.liquid`.
- **Action:** `docs/` mappa, vagy törlés ami már nem aktuális

---

## Összegzés

| Terület | Pontszám | Launch-blocker | Megjegyzés |
|---|---|---|---|
| UI/UX | 8/10 | — | PDP + cart + collection + search már 9/10 |
| Best practice | 7/10 | customer templates, all-products handle | erős SEO foundation |
| Konverzió | 7/10 | customer account, no reviews | core flow + search kiváló |
| Performance | 7/10 | Google Fonts blocking | szilárd alapok |
| Accessibility | 5/10 | skip link, focus, `<main>` | nagy javítási potenciál kevés munkával |

**Becsült munka P0 + P1 lezárására: 2-3 fejlesztői nap** (customer templates a leghosszabb tétel; a többi pár órás munka).

A P0 + P1 lezárása után a bolt **production-ready** a termékek feltöltését követően. A P2-P3 tételeket launch utáni iterációkban is lehet kezelni.
