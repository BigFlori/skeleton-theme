# Recently Viewed Products — terv

## Context

A [TODOS.md](../TODOS.md) szerint a "recently viewed products" egy olcsó, localStorage-alapú
konverziós segítség egy sok-SKU-s solar B2B katalógusnál. A felhasználó döntése alapján a
szekció **a termékoldal (PDP) alján** jelenik meg, **8 termékkel**, **egy soros, vízszintesen
görgethető** elrendezésben — pontosan úgy, ahogy a mega-menü termék-karusszelje már működik.

A cél: amikor a látogató termékeket néz végig, a legutóbb megtekintett termékek mindig
kéznél legyenek a PDP alján, hogy könnyen visszaugorhasson hozzájuk.

## Megközelítés

Shopify-natív, build nélküli, a téma meglévő mintáit követve:

- **Tárolás:** `localStorage` (kulcs: `sw:recently-viewed`) — termék-ID-k tömbje,
  legutóbbi elöl, deduplikálva, max 8 (+1 a most nézett kizárásához, lásd lent).
- **Rögzítés:** PDP-n a meglévő `window.PDP_CONFIG`-ot bővítjük a `productId`/`productHandle`
  mezőkkel, és a JS ez alapján rögzít.
- **Megjelenítés/lekérés:** Shopify **Search API** `id:` szűrővel + Section Rendering API
  `section_id` paraméterrel — **egyetlen** kéréssel visszakapjuk a szekciót a kívánt termékekkel
  renderelve. Ez a téma már használt mintája ([cart-drawer.js:172-192](../assets/cart-drawer.js#L172-L192)
  Section Rendering API, [predictive-search.js](../assets/predictive-search.js) fetch).
- **Kártya:** a meglévő [collection-product-card.liquid](../snippets/collection-product-card.liquid)
  snippet újrahasználása (ugyanaz, amit a product-grid és a mega-menü is használ).
- **Görgethető elrendezés:** a [mega-menu.liquid](../snippets/mega-menu.liquid#L48-L82) `__track` +
  prev/next karusszel mintájának tükrözése.

### Miért a Search API + `id:` szűrő?

A localStorage csak ID-ket tárol; ezekből kell *szerveroldalon renderelt* termékkártyákat
kapni (az árak, készlet, kedvezmény Liquidből jönnek). A
`GET /search?q=id:111 OR id:222&section_id=<id>&resources[type]=product` egyetlen kérésben
visszaadja a szekció HTML-jét a megfelelő termékekkel. Ez a Shopify-közösség bevett
recently-viewed mintája, és illeszkedik a téma meglévő AJAX-megoldásaihoz.

## Implementáció

### 1. Új szekció: `sections/recently-viewed-products.liquid`

Önálló szekció (preset-tel), amit a `templates/product.json`-ba húzunk be a `main-product`
szekció **alá**. Önálló szekció kell, mert a Section Rendering API `section_id`-vel ezt
rendereli újra a fetch-nél.

Felépítés:

- **Konténer** kezdetben rejtve (`hidden` attribútum / `display:none`), `data-recently-viewed`
  attribútummal és a config script-tel:
  ```liquid
  <script>
    window.swRecentlyViewedConfig = {
      sectionId: {{ section.id | json }},
      searchUrl: {{ routes.search_url | json }},
      maxItems: 8
    };
  </script>
  ```
- **Kétágú render** (a kulcstrükk):
  ```liquid
  {%- if search.performed -%}
    {%- comment -%} AJAX fetch ága: a track tartalma, amit a JS kivág {%- endcomment -%}
    {%- for product in search.results -%}
      <div class="sw-rv__slide" data-product-id="{{ product.id }}">
        {%- render 'collection-product-card', product: product -%}
      </div>
    {%- endfor -%}
  {%- else -%}
    {%- comment -%} Normál oldalbetöltés: fejléc + üres track + nyilak váza {%- endcomment -%}
    <section class="sw-rv full-width" data-recently-viewed hidden> … track + controls … </section>
  {%- endif -%}
  ```
  Oldalbetöltéskor `search.performed == false` → csak a váz renderelődik (rejtve). A JS
  fetch-eli a search URL-t `section_id`-vel, ahol `search.performed == true` → a `search.results`
  ágon legyártott `.sw-rv__slide`-okat a JS kivágja és beinjektálja a track-be.
- **Görgethető track + nyilak:** a [mega-menu.liquid](../snippets/mega-menu.liquid#L48-L82)
  `data-mega-carousel-*` mintájának megfelelő `data-rv-carousel-*` markup.
- **Eyebrow/cím:** új `sections.recently_viewed.*` fordítási kulcsok.
- **Scoped CSS** a `{% stylesheet %}` blokkban: a `__track` görgetés (`overflow-x:auto`,
  `scroll-snap-type:x mandatory`, rejtett scrollbar) + a `.prod-card` alapstílusok tükrözése
  (mint a mega-menü tette, hogy ne függjön más szekció jelenlététől).

### 2. Új JS: `assets/recently-viewed-products.js`

IIFE minta (mint [region-selector.js](../assets/region-selector.js)), a szekció tölti be defer-rel.
Logika:

1. **Rögzítés:** ha van `window.PDP_CONFIG?.productId`, betesszük a localStorage lista elejére
   (dedup, vágás `maxItems + 1`-re, hogy a most nézett kizárása után is 8 maradjon).
2. **Megjelenítés:** ha van `[data-recently-viewed]` a DOM-ban:
   - ID-lista beolvasása, az **aktuális PDP termék kizárása**, üres lista → szekció marad rejtve.
   - `IntersectionObserver`-rel lustán (ahogy a Horizon product-recommendations teszi), a
     szekció közelébe érve: `fetch(searchUrl + '?q=' + ids.map(id => 'id:'+id).join(' OR ') +
     '&resources[type]=product&section_id=' + sectionId)`.
   - A válasz HTML-ből `DOMParser`-rel kinyerjük a `.sw-rv__slide` elemeket
     ([cart-drawer.js:180-186](../assets/cart-drawer.js#L180-L186) mintájára).
   - **Újrarendezés a localStorage sorrendje szerint** (a search nem garantálja a sorrendet),
     beinjektálás a track-be, a szekció `hidden` levétele.
3. **Karusszel-nyilak:** a [header.js:153-181](../assets/header.js#L153-L181) `scrollBy` +
   disabled-állapot logikájának átemelése (`data-rv-carousel-*` szelektorokkal).

### 3. PDP_CONFIG bővítése — `snippets/pdp-scripts.liquid`

A [pdp-scripts.liquid:24-48](../snippets/pdp-scripts.liquid#L24-L48) `window.PDP_CONFIG`-ba:
```liquid
productId:      {{ product.id | json }},
productHandle:  {{ product.handle | json }},
```

### 4. Fordítások — `locales/de.json` és `locales/en.default.json`

Új blokk (német az elsődleges, AT/DE):
```json
"sections": {
  "recently_viewed": {
    "eyebrow": "Zuletzt angesehen",
    "title": "Ihre zuletzt angesehenen Produkte"
  }
}
```
A karusszel prev/next aria-label újrahasználható a meglévő `sections.header.mega_menu.previous/next`
kulcsokból, vagy saját kulcsot kap. A `{% schema %}` címkékhez `locales/*.schema.json`.

### 5. Template-beillesztés — `templates/product.json`

A `recently-viewed-products` szekció hozzáadása a `main-product` (és kísérő szekciók) **után**.
Mivel preset-es önálló szekció, a theme editorban is áthelyezhető.

## Érintett fájlok

| Fájl | Művelet |
|------|---------|
| `sections/recently-viewed-products.liquid` | **új** szekció (markup + scoped CSS + schema/preset) |
| `assets/recently-viewed-products.js` | **új** IIFE: rögzítés, fetch, render, karusszel |
| `snippets/pdp-scripts.liquid` | `productId` + `productHandle` hozzáadása a PDP_CONFIG-hoz |
| `locales/de.json`, `locales/en.default.json` | `sections.recently_viewed.*` kulcsok |
| `locales/*.schema.json` | schema címke (ha kell) |
| `templates/product.json` | szekció behúzása a PDP-be |

## Megfontolások / élhelyzetek

- **Index-késés:** frissen feltöltött termék, amíg nincs a search indexben, nem jön vissza —
  ezeket a JS egyszerűen kihagyja (a kártya saját maga rendereli az árat/készletet, nincs
  inkonzisztencia). Elfogadható kompromisszum.
- **Aktuális termék kizárása:** mindig kivesszük a megjelenítésből, de a localStorage-ban
  marad (más oldalon releváns lesz).
- **Üres állapot:** ha nincs korábbi nézet, a szekció rejtve marad (nincs üres placeholder).
- **Sorrend:** search után JS rendezi vissza localStorage-sorrendbe (legutóbbi elöl).

## Verifikáció

1. `shopify theme dev` (vagy a projekt szokásos dev-parancsa) → lokális preview.
2. Nyiss meg 3-4 különböző terméket egymás után. Ellenőrizd DevTools → Application →
   Local Storage: a `sw:recently-viewed` kulcs az ID-ket legutóbbi-elöl sorrendben
   tartalmazza, max 8(+1), deduplikálva.
3. A PDP alján jelenjen meg a "Zuletzt angesehen" szekció a korábban nézett termékekkel,
   az **aktuális termék nélkül**, egy soros görgethető track-ben.
4. Network fül: egyetlen `GET /search?q=id:…&section_id=…` kérés fusson, 200-as válasszal,
   szekció-HTML-lel.
5. Karusszel prev/next nyilak görgessenek és tiltódjanak le a track két végén
   (mint a mega-menüben).
6. Privát ablakban / törölt localStorage mellett (első látogatás) a szekció **ne** jelenjen meg.
7. Mobilon: a track érintéssel görgethető, scroll-snap működik.
