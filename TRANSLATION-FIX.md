# Hero szekció fordítási hiba

## A probléma

A Shopify **nem** tud automatikusan `templates/index.de.json`-t kiszolgálni a DE locale-on. Ez nem egy Shopify feature. Ezért a hero szövegek (headline, subcopy, CTA-k, chip) angolul maradtak, miközben a `| t` filtert használó elemek (pl. "Versand aus Österreich") helyesen fordultak.

## A javítás

A szövegeket `section.settings.*`-ból `| t` locale stringekre kell cserélni — pontosan úgy, ahogy a badge már működött.

### 1. Locale fájlok (`en.default.json`, `de.json`, `hu.json`)

Az `sections.hero` blokkba felvenni:
```json
"eyebrow": "...",
"headline": "...",
"headline_italic": "...",
"subcopy": "...",
"cta_primary": "...",
"cta_ghost": "...",
"chip_label": "...",
"chip_detail": "...",
"chip_price": "...",
"metric_shipping_num": "3–5 Days / Tage / nap",
"metric_warranty_num": "25 Years / Jahre / év"
```

### 2. `sections/hero.liquid` — eleje

```liquid
assign eyebrow           = 'sections.hero.eyebrow'           | t
assign headline          = 'sections.hero.headline'          | t
assign headline_italic   = 'sections.hero.headline_italic'   | t
assign subcopy           = 'sections.hero.subcopy'           | t
assign cta_primary_text  = 'sections.hero.cta_primary'       | t
assign cta_ghost_text    = 'sections.hero.cta_ghost'         | t
assign chip_label        = 'sections.hero.chip_label'        | t
assign chip_detail       = 'sections.hero.chip_detail'       | t
assign chip_price        = 'sections.hero.chip_price'        | t
```

URL-ek és layout maradnak `section.settings.*`-on.

### 3. `snippets/hero-metrics.liquid`

```liquid
{{ 'sections.hero.metric_shipping_num' | t }}  {{- helyett: "3–5 Tage" hardcode }}
{{ 'sections.hero.metric_warranty_num' | t }}  {{- helyett: "25 Jahre" hardcode }}
```

### 4. Schema

A `hero.liquid` schema-ból törölni a szöveges mezőket (eyebrow, headline, subcopy, CTA text, chip szövegek) — csak az URL mezők és layout maradnak.

## Megjegyzés

A `templates/index.de.json` és `index.hu.json` fájlok ezután feleslegesek a szövegfordítás szempontjából — törölhetők vagy megtarthatók URL/layout overrideoknak.
