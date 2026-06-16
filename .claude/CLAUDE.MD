# Shopify Téma Struktúra — Gyors Útmutató

A Horizon-theme alapján összefoglalt szervezési elvek. Minden új fájl létrehozásakor vagy módosításakor tartsd be ezeket.

---

## Mappa áttekintés

```
blocks/       – UI komponensek (legkisebb egységek, szerkeszthetők az editorban)
sections/     – Oldalszintű tartalmi blokkok (templatekbe kerülnek)
snippets/     – Újrafelhasználható Liquid partials (nincs schema, csak {% render %}-rel hívhatók)
layout/       – HTML document shell (theme.liquid, password.liquid)
templates/    – Oldal-konfigurációk JSON-ban (product.json, index.json, stb.)
assets/       – CSS, JS, SVG fájlok
config/       – Téma-szintű beállítások (settings_schema.json)
locales/      – Fordítások
```

---

## Blocks

**Mi kerül ide:** A legkisebb, önállóan újrafelhasználható UI elemek, amelyek a Shopify szerkesztőben drag-and-drop-pal kezelhetők.

**Jellemzők:**
- Van `{% schema %}` blokkjuk
- Kibocsátják a `{{ block.shopify_attributes }}` taget
- Beágyazhatók sectionökbe vagy más blockokba

**Két típus:**

### Normál blockök (pl. `text.liquid`, `button.liquid`, `product-card.liquid`)
- A merchant maga adhatja hozzá az editorban
- Van `"presets"` a schemában (ez teszi őket szabadon hozzáadhatóvá)
- Elfogadhatnak nested blockokat: `{ "type": "@theme" }`, `{ "type": "@app" }`

### Aláhúzásos blockök (pl. `_product-details.liquid`, `_header-logo.liquid`)
- Belső / context-specifikus blockök — NEM adhatók hozzá önállóan
- Csak `{% content_for 'block', type: '_nev' %}` hívással példányosíthatók sectionből
- Strukturált oldalelrendezésekhez: termék oldal, blog, fejléc részei
- Nincs `"presets"` a schemában

**Elnevezés:** kebab-case, aláhúzás = belső használat

---

## Sections

**Mi kerül ide:** Egy teljes oldal-szekció, amelynek saját szerkeszthető beállításai vannak, és blockokat fogad magába.

**Jellemzők:**
- Van `{% schema %}` a `"settings"` és `"blocks"` definícióval
- JSON templatekből hivatkoznak rájuk (`"type": "section-neve"`)
- Renderelik a blockokat `{% content_for 'blocks' %}` vagy injektált `content_for 'block'` hívással

**Két típus:**

### Oldal-specifikus sectionök (`main-*`, `*-information`)
- `main-product.liquid`, `main-collection.liquid`, `main-blog.liquid`, stb.
- Kötelező részei az adott oldaltípusnak
- Injektált aláhúzásos blockokat használnak a strukturált elrendezéshez

### Általános / újrafelhasználható sectionök
- `hero.liquid`, `featured-product.liquid`, `carousel.liquid`, `footer.liquid`, stb.
- Bármelyik templatebe kerülhetnek
- Merchant-szerkeszthető blockokat fogadnak

**Elnevezés:** kebab-case, `main-` prefix az oldal-specifikusoknál

---

## Snippets

**Mi kerül ide:** Minden újrafelhasználható Liquid partial, amelynek **nincs** schema-ja és nem jelenik meg az editorban.

**Jellemzők:**
- Csak `{% render 'nev', param: ertek %}` hívással érhetők el
- Paramétereken át kapják a kontextust (nem hozzáférnek globálisan a section/block változókhoz)
- Nincs `{% schema %}` tag

**Főbb kategóriák:**

| Kategória | Példák |
|-----------|--------|
| Komponens renderelők | `product-card.liquid`, `button.liquid`, `section.liquid` |
| CSS utility snippetek | `spacing-style.liquid`, `color-schemes.liquid`, `gap-style.liquid` |
| Médiakezelés | `image.liquid`, `video.liquid`, `background-media.liquid` |
| Segédfunkciók | `format-price.liquid`, `pagination-controls.liquid`, `variant-picker.liquid` |
| Ikonok | `icon.liquid` |
| Layout / setup | `meta-tags.liquid`, `stylesheets.liquid`, `scripts.liquid` |

**Elnevezés:** kebab-case, funkció alapú név

---

## Tartalom-áramlás

```
templates/product.json
  └── sections/product-information.liquid      ← section (schema + blockokat fogad)
        ├── _product-media-gallery (injektált) ← _ block (content_for + closest.product)
        └── _product-details (injektált)       ← _ block
              ├── group (merchant által)        ← normál block
              └── text, button, stb.           ← normál blockök
                    └── snippets/button.liquid ← snippet ({% render %})
```

---

## Döntési fa: Hova tegyem?

```
Van schema és merchant-szerkeszthető?
  ├─ Igen, és oldalszintű konténer → SECTION
  └─ Igen, és kisebb komponens → BLOCK
        ├─ Merchant adhatja hozzá szabadon? → normál block (presets-szel)
        └─ Csak sectionből injektálható? → _ block (aláhúzással)

Nincs schema, csak Liquid partial?
  └─ SNIPPET ({% render %}-rel hívva)

HTML document shell?
  └─ LAYOUT

Oldal struktúra (milyen sectionök jelennek meg)?
  └─ TEMPLATE (JSON)

Globális téma-opciók?
  └─ CONFIG/settings_schema.json
```

---

## Kulcsszabályok

1. **Snippet ≠ Block**: A snippet nem szerkeszthető az editorban, nem kap automatikusan `block.*` változókat — paraméterként kell átadni mindent.
2. **Aláhúzás = belső**: `_nev.liquid` blockhoz soha ne tegyünk `"presets"`-et, csak sectionből hívjuk `content_for`-ral.
3. **CSS sectionből/blockból**: Az inline stílusokat `{% render 'spacing-style', settings: block.settings %}` mintájú snippet hívásokkal injektálják — ne közvetlenül inline-ban.
4. **Kontextus átadás**: Aláhúzásos blockok `closest.product`, `closest.collection` változókon kapják a szülő kontextust.
5. **Fordítás**: Minden felhasználónak látható szöveg `t:names.xxx` / `t:settings.xxx` kulcson keresztül megy a locales-be.
6. **"Összes termék" kollekció**: A bolt NEM a Shopify alapértelmezett `all` handle-jét használja, hanem egy kézzel létrehozott `all-products` handle-ű kollekciót. Minden "összes termék" linkhez (breadcrumb, nav, footer, "view all" CTA, stb.) használd: `{{ collections['all-products'].url }}` — NE `routes.all_products_collection_url`-t és NE `/collections/all`-t.
7. **Sticky elemek `top` értéke**: Soha ne hardkódolj `top: Xpx` értéket sticky elemeknél — mindig `top: var(--sticky-top)` (definiálva: `sonnwerk.css` → `calc(var(--header-height) + 16px)`).

---

## Ikonok

A téma egyetlen központi ikon-snippetet használ: [snippets/icon.liquid](snippets/icon.liquid).

### Használat

A snippet **csak az SVG `<path>` / `<circle>` / `<line>` belső tartalmát** adja vissza — az `<svg>` wrappert a hívási helyen kell biztosítani. Ezzel a hívó kontrollálja a méretet, stroke-vastagságot és a színt (a `currentColor`-ral örökli a szülő szövegszínét).

```liquid
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {%- render 'icon', icon: 'arrow-right' -%}
</svg>
```

**Tipikus hibák** (kerüld):
- `{% render 'icon', icon: 'x' %}` önmagában, `<svg>` wrapper nélkül → **semmi nem fog látszani**.
- Inline SVG path direkt beírása a komponensbe → duplikáció, nem központi.
- `<img src="...">` SVG fájlra → elveszik a `currentColor` öröklés.

### Új ikon hozzáadása

1. Nyisd meg az [snippets/icon.liquid](snippets/icon.liquid) fájlt.
2. Adj hozzá egy új `{%- when 'icon-nev' -%}` ágat a `case` blokkba (kebab-case név).
3. Tedd be a path/shape elemeket — **fill, stroke, stroke-width NEM kell** rajtuk, mert ezeket a hívási oldali `<svg>` wrapper adja.
4. A viewBox-ot tartsd `0 0 24 24`-en (a többi ikon is ezen van), hogy a hívási stílus konzisztens maradjon.

**Példa új ikon felvétele:**

```liquid
{%- when 'heart' -%}
  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
```

Forrásként a [lucide.dev](https://lucide.dev) / [feathericons.com](https://feathericons.com) ikonjai stylisztikailag illeszkednek (24×24 viewBox, stroke-alapú, 1.8–2 stroke-width). Ha máshonnan veszel SVG-t, normalizáld 24×24-re és vedd ki a felesleges attribútumokat (`width`, `height`, `fill`, `stroke`, `xmlns`).
