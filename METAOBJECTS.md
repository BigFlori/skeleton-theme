# Metaobjects & Metafields – Solar Theme

Termékenkénti dinamikus adatok tárolására metaobjecteket és product metafieldeket használunk.
A product page snippetek (`pdp-*.liquid`) ezekből olvasnak, nem a section settingsből.

---

## `datasheet` metaobject

**Típus:** custom metaobject  
**Hivatkozás a témában:** `product.metafields.custom.datasheet.value`  
**Beállítás:** Shopify Admin → Content → Metaobjects → Datasheet

Minden termékhez egy `datasheet` metaobject rekord tartozik, amelyet a termék `custom.datasheet` product metafieldjén keresztül kapcsolunk hozzá (metaobject reference típus).

### Mezők

| Mező                | Típus               | Leírás |
|---------------------|---------------------|--------|
| `Name`              | Single line text    | Azonosító, pl. `SOL-425-Wp` |
| `tech_badge`        | Single line text    | Technológia badge szövege, pl. `N-TYPE TOPCon` |
| `rating`            | Decimal number      | Értékelés, pl. `4.8` |
| `review_count`      | Integer             | Vélemények száma, pl. `127` |
| `pdf_url`           | URL                 | Termék adatlap PDF direkt letöltési linkje |
| `voc`               | Decimal number      | Nyitott köri feszültség (V), pl. `38.9` — megjelenítéshez és számításhoz is |
| `vmp`               | Decimal number      | Maximum power feszültség (V), pl. `32.4` |
| `imp`               | Decimal number      | Maximum power áram (A), pl. `13.1` |
| `isc`               | Decimal number      | Rövidzárlati áram (A), pl. `13.9` |
| `module_power_kwp`  | Decimal number      | Panel teljesítmény kWp-ben, pl. `0.425` |
| `spec_electrical`   | JSON                | Elektromos adatok: `[{ "label": "…", "value": "…" }]` |
| `spec_mechanical`   | JSON                | Mechanikai adatok: `[{ "label": "…", "value": "…" }]` |
| `spec_certificates` | JSON                | Tanúsítványok: `[{ "label": "…", "value": "…" }]` |
| `spec_environment`  | JSON                | Környezeti adatok: `[{ "label": "…", "value": "…" }]` |
| `downloads`         | JSON                | Letölthető fájlok: `[{ "label": "…", "size": "…", "url": "…" }]` |
| `keyspecs`          | JSON                | Kiemelt mutatók a PDP tetején (lásd alább) |

> **Megjegyzés a számmezőkről:** A `voc`, `vmp`, `imp`, `isc`, `module_power_kwp` és `rating` mezőket mindig **ponttal** add meg (pl. `38.9`). A snippetek automatikusan vesszőre cserélik a megjelenítéshez.

### `keyspecs` mező struktúra

Max. 5 elem, mindegyik a következő kulcsokkal:

```json
[
  { "value": "425",  "unit": "Wp",    "label": "Nennleistung",     "sub": "bei STC" },
  { "value": "21,8", "unit": "%",     "label": "Wirkungsgrad",     "sub": "Modul-Effizienz" },
  { "value": "25",   "unit": "Jahre", "label": "Leistungsgarantie","sub": "≥ 87,4 % nach 25 J" },
  { "value": "15",   "unit": "Jahre", "label": "Produktgarantie",  "sub": "Material & Verarbeitung" },
  { "value": "IP68", "unit": "",      "label": "Schutzart",        "sub": "Anschlussdose" }
]
```

**Snippet:** `snippets/pdp-keyspecs.liquid`

---

## Shopify Admin – új mezők létrehozása

### 1. Metaobject definíció bővítése

**Content → Metaobjects → Datasheet → Fields → Add field** — add hozzá ezeket:

| Field name (key)    | Típus            |
|---------------------|------------------|
| `tech_badge`        | Single line text |
| `rating`            | Decimal number   |
| `review_count`      | Integer          |
| `pdf_url`           | URL              |
| `voc`               | Decimal number   |
| `vmp`               | Decimal number   |
| `imp`               | Decimal number   |
| `isc`               | Decimal number   |
| `module_power_kwp`  | Decimal number   |

> A key mező neve pontosan ezeket a snake_case neveket kapja (a „Field name" alatt a szürke key-t állítsd be).

### 2. Meglévő rekordok kitöltése

**Content → Metaobjects → Datasheet → [rekord]** — töltsd ki az új mezőket:

- `tech_badge`: pl. `N-TYPE TOPCon`
- `rating`: pl. `4.8`
- `review_count`: pl. `127`
- `pdf_url`: a termék PDF adatlap URL-je
- `voc`: pl. `38.9`
- `vmp`: pl. `32.4`
- `imp`: pl. `13.1`
- `isc`: pl. `13.9`
- `module_power_kwp`: pl. `0.425`

---

## Product metafields

A termék szintjén tárolt mezők (Shopify Admin → Products → [termék] → Metafields):

| Namespace + key           | Típus                  | Leírás |
|---------------------------|------------------------|--------|
| `custom.datasheet`        | Metaobject reference   | Hivatkozás a termék `datasheet` metaobjectjére |

---

## Workflow – új termék feltöltésekor

1. **Metaobject rekord létrehozása:** Content → Metaobjects → Datasheet → Add entry  
   Töltsd ki az összes mezőt (spec, keyspecs, elektromos értékek, badge, rating, PDF URL).
2. **Termék összekapcsolása:** Products → [termék] → Metafields → `custom.datasheet` → rekord kiválasztása.
3. A PDP automatikusan betölti az adatokat, nincs szükség külön template-re.

---

## Még nem migált adatok (következő lépések)

- **Inverterlista** (`pdp-compat.liquid`): jelenleg statikus HTML — tervezett megoldás: új `inverter` metaobject + `custom.compatible_inverters` list reference a terméken.
- **Mennyiségi presetek** (`pdp-buy.liquid`): 5 / 10 / 24 hardcode — esetleg a datasheet JSON mezőbe vagy section settingbe.
- **Kedvezménysávok** (`pdp-scripts.liquid`): `≥24→12%`, `≥10→8%`, `≥5→4%` — árazási logika, érdemes lehet metafield-be vinni.
