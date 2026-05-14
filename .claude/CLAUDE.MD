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
