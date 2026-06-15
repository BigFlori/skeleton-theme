# Metaobjects & Metafields – Solar Theme

A PDP snippetek (`pdp-*.liquid`) metaobjectekből és metafieldekből olvasnak, nem section settingsből.

---

## Product metafields

| Namespace + key                  | Típus                     | Használja |
|----------------------------------|---------------------------|-----------|
| `custom.datasheet`               | Metaobject reference      | szinte minden pdp-* snippet |
| `custom.model_number`            | Single line text          | pdp-buy, pdp-jsonld, breadcrumb |
| `custom.compatible_inverters`    | Metaobject reference list | pdp-compat (curated override) |

## Shop metafields

| Namespace + key                  | Típus                     | Használja |
|----------------------------------|---------------------------|-----------|
| `custom.default_inverters`       | Metaobject reference list | pdp-compat (fallback, ha nincs curated) |

## Collection / Page metafields

| Namespace + key                  | Típus                     | Használja |
|----------------------------------|---------------------------|-----------|
| `custom.nav_icon`                | Single line text          | nav-icon (navbar menüpont-ikonok) |

---

## `datasheet` metaobject

**Admin:** Content → Metaobjects → Datasheet  
**Liquid:** `product.metafields.custom.datasheet.value`

| Mező                | Típus            | Példa |
|---------------------|------------------|-------|
| `Name`              | Single line text | `SOL-425-Wp` |
| `tech_badge`        | Single line text | `N-TYPE TOPCon` |
| `rating`            | Decimal number   | `4.8` |
| `review_count`      | Integer          | `127` |
| `voc`               | Decimal number   | `38.9` |
| `vmp`               | Decimal number   | `32.4` |
| `imp`               | Decimal number   | `13.1` |
| `isc`               | Decimal number   | `13.9` |
| `module_power_kwp`  | Decimal number   | `0.425` |
| `keyspecs`          | JSON             | lásd lent |
| `spec_electrical`   | JSON             | `[{ "label": "…", "value": "…" }]` |
| `spec_mechanical`   | JSON             | `[{ "label": "…", "value": "…" }]` |
| `spec_certificates` | JSON             | `[{ "label": "…", "value": "…" }]` |
| `spec_environment`  | JSON             | `[{ "label": "…", "value": "…" }]` |
| `downloads`         | JSON             | `[{ "label": "…", "size": "…", "url": "…" }]` |

> Számmezőknél mindig **pontot** használj (pl. `38.9`). A snippetek automatikusan vesszőre cserélik.

### `keyspecs` struktúra (max. 5 elem)

```json
[
  { "value": "425",  "unit": "Wp",    "label": "Nennleistung",      "sub": "bei STC" },
  { "value": "21,8", "unit": "%",     "label": "Wirkungsgrad",      "sub": "Modul-Effizienz" },
  { "value": "25",   "unit": "Jahre", "label": "Leistungsgarantie", "sub": "≥ 87,4 % nach 25 J" },
  { "value": "15",   "unit": "Jahre", "label": "Produktgarantie",   "sub": "Material & Verarbeitung" },
  { "value": "IP68", "unit": "",      "label": "Schutzart",         "sub": "Anschlussdose" }
]
```

---

## `inverter` metaobject

**Admin:** Content → Metaobjects → Inverter  
**Liquid:** `product.metafields.custom.compatible_inverters.value` vagy `shop.metafields.custom.default_inverters.value`

| Mező               | Típus            | Leírás |
|--------------------|------------------|--------|
| `handle`           | Single line text | Egyedi azonosító |
| `display_name`     | Single line text | Megjelenített név |
| `mppt_count`       | Integer          | MPPT trackerek száma |
| `max_dc_voltage`   | Decimal number   | Max. DC feszültség (V) |
| `mppt_min_voltage` | Decimal number   | Min. MPPT feszültség (V), default: 0 |
| `strings_per_mppt` | Integer          | Stringek / MPPT |
| `power`            | Decimal number   | Névleges teljesítmény (W) |

**Logika (`pdp-compat.liquid`):** ha `custom.compatible_inverters` ki van töltve → azt mutatja; különben `shop.default_inverters` alapján szűr hideg Voc szerint (tc = −0.30 %/°C, T_min = −10°C → faktor: 1.105).

---

## `product_type_collection_map` metaobject

**Admin:** Content → Metaobjects → Product type collection map
**Liquid:** `shop.metaobjects.product_type_collection_map.values`

Product Type → Collection globális hozzárendelés. Egy entry / product type.

| Mező           | Típus                | Példa |
|----------------|----------------------|-------|
| `product_type` | Single line text     | `Napelem` (egyezzen a termék Product Type-jával) |
| `collection`   | Collection reference | pl. `napelemek` kollekció |

**Használat Liquidben:**

```liquid
{%- assign maps = shop.metaobjects.product_type_collection_map.values -%}
{%- for entry in maps -%}
  {%- if entry.product_type == product.type -%}
    <a href="{{ entry.collection.value.url }}">{{ entry.collection.value.title }}</a>
    {%- break -%}
  {%- endif -%}
{%- endfor -%}
```

> A `product_type` mező értéke **pontosan** egyezzen a termék Product Type mezőjével (case-sensitive).

---

## `custom.nav_icon` metafield (navbar ikonok)

**Admin:** Settings → Custom data → Collections (és Pages) → Add definition
**Liquid:** `link.object.metafields.custom.nav_icon.value` (a [snippets/nav-icon.liquid](snippets/nav-icon.liquid) olvassa)

Navlink → ikon hozzárendelés. Az ikonnevet **közvetlenül a kollekcióra (vagy oldalra)** tett
metafield tárolja. A navbar (desktop top-level sáv és mobil drawer gyökér szint) ezt használja.

| Definition | Namespace + key   | Típus            | Példa |
|------------|-------------------|------------------|-------|
| Collections | `custom.nav_icon` | Single line text | `ev-charger` |
| Pages       | `custom.nav_icon` | Single line text | `package` |

**Miért metafield és nem handle-alapú map?** A bolt többnyelvű, és a kollekció **handle nyelvenként
eltérhet** → a string-párosítás törne. A metafield magára az **erőforrásra** köt (`link.object`),
ami minden nyelven ugyanaz, ezért nyelvfüggetlen. A merchant egyszer, a kollekció admin-oldalán állítja be.

**Korlát:** a **custom URL-es** menüpontok mögött nincs erőforrás, így nem kaphatnak metafieldet →
ezekre nem jelenik meg ikon. (Oldal-linkekre a Pages `custom.nav_icon` megoldja.)

**Elérhető ikonnevek** (bővíthető az icon.liquid-ban): `panel`, `panel-grid`, `inverter`,
`battery`, `plug`, `mounting`, `package`, `grid`, `ev-charger`, `bolt`, `bolt-ev`, `leaf`, `truck`, `shield`,
`wrench`, `sun`, `globe`, `warehouse`, `star`, `cart`, `shopping-bag` … (lásd a teljes
listát az [icon.liquid](snippets/icon.liquid) `when` ágaiban).

**Használat Liquidben:**

```liquid
{%- render 'nav-icon', link: link, variant: 'inline' -%}  {%- comment -%} desktop {%- endcomment -%}
{%- render 'nav-icon', link: link, variant: 'chip' -%}    {%- comment -%} mobil drawer {%- endcomment -%}
```

> Ismeretlen `icon` névnél az `icon.liquid` semmit nem renderel, a `nav-icon` snippet pedig
> üres metafield esetén nem ír ki semmit → nincs üres placeholder / layout-eltolás.

---

## Workflow – új termék feltöltésekor

1. **Datasheet rekord:** Content → Metaobjects → Datasheet → Add entry — töltsd ki az összes mezőt.
2. **Termék linkelés:** Products → [termék] → Metafields → `custom.datasheet` → rekord kiválasztása.
3. **Model number:** Products → [termék] → Metafields → `custom.model_number` → pl. `SOL-425-Wp`.
4. **Inverter override (opcionális):** `custom.compatible_inverters` → csak ha az alapértelmezett shop lista nem megfelelő.

---

## Még nyitott feladatok

- **Mennyiségi presetek** (`pdp-buy.liquid`): 5 / 10 / 24 hardcode — datasheet JSON mezőbe vagy section settingbe érdemes vinni.
- **Kedvezménysávok** (`pdp-scripts.liquid`): `≥24→12%`, `≥10→8%`, `≥5→4%` hardcode — metafield-be vihető.
