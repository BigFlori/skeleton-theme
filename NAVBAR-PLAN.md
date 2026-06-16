# Több szintes navbar — implementációs vázlat

Cél: az `energrosso`-hoz hasonló, **3 soros header** dropdown menükkel.
Asztali nézetben 3 sáv egymás alatt, mobilon a meglévő drawer (bővítve).

```
┌──────────────────────────────────────────────────────────────┐
│ ① TOP BAR   social ·  üzenet/CTA  ·  utility linkek           │  ← opcionális, toggle-elhető
├──────────────────────────────────────────────────────────────┤
│ ② MAIN BAR  logo  ·  [ nagy kereső ]  ·  fiók  ·  kosár        │
├──────────────────────────────────────────────────────────────┤
│ ③ NAV BAR   Napelem · Inverter ▾ · Akkumulátor ▾ · …          │  ← dropdown / mega-menü
└──────────────────────────────────────────────────────────────┘
```

## Felépítés (sávok)

### ① Top bar (legfelső szint) — opcionális
- Most **nem biztos, hogy kell**, de beépítjük `enable_top_bar` checkbox mögé (default: off).
- Tartalom: social ikonok (bal), központi üzenet/CTA (pl. „Aktiváld fiókod"), utility `link_list` (jobb: Kivitelezés, Cégünkről, Kapcsolat, Karrier).
- Külön blokk: `blocks/_header-topbar.liquid` (saját `link_list` + szövegmező + social toggle).

### ② Main bar
- Meglévő logo + ikonok marad.
- **Inline kereső sáv** (eldöntve) — nagy mező a logo mellett, placeholder-rotációval, mint a képen. A `predictive-search` snippetet hasznosítjuk újra; a mobil drawer-es kereső megmaradhat kisebb nézethez.
- Grid: `logo | search (flex:1) | account+cart`.

### ③ Nav bar (fő kategórianav, többszintű)
- Külön sáv a main bar alatt, full-width háttérrel, középre/balra zárt menüvel.
- A meglévő `_header-menu` blokkot **bővítjük mega-menü panellel** (lásd lent).

## Menü adatmodell (Shopify)
Shopify `link_list` natívan **3 szintet** támogat: `link.links` → `childlink.links`.
- 1. szint: top-level kategória (Napelem, Inverter…)
- 2. szint: dropdown / mega-menü oszlopfejek
- 3. szint: oszlopon belüli linkek
A menüt az adminban a **Navigation → main-menu** alatt kell felépíteni, kódmódosítás nélkül bővíthető.

## Renderelés — kulcsfájlok

| Fájl | Teendő |
|------|--------|
| `sections/header.liquid` | 1 sor → 3 `header__row`. Top bar feltételes render, inline kereső a main barba, új nav-row a menünek. Új schema settingek (`enable_top_bar`, `enable_inline_search`). |
| `blocks/_header-menu.liquid` | `for link in menu.links` ágba `{% if link.links.size > 0 %}` → caret + mega-menü panel render (`mega-menu` snippet). Hover + focus megnyitás, `aria-expanded`. |
| `blocks/_header-topbar.liquid` | **ÚJ** — top bar blokk (social toggle + szöveg/CTA + utility `link_list`). |
| `snippets/mega-menu.liquid` | **ÚJ** — a 2. szint = oszlopfej, 3. szint = linkek; opcionális promó kép/CTA blokk az oszlopok mellett. |
| `snippets/mobile-nav-drawer.liquid` | Többszintűvé tenni: `<details>`/accordion a `link.links`-re (2-3 szint), back-gomb vagy lenyíló. |
| `assets/mobile-nav.js` | Almenük nyitás/zárás kezelése mobilon. |
| `assets/header.js` (új v. meglévőbe) | Asztali mega-menü billentyűzet-nav, kívülre kattintás zárás, sticky állapot. |

## Mega-menü viselkedés (asztali)
- Top-level link alá igazított, **full-width vagy konténer-széles panel** (`position: absolute`, a nav-row `position: relative`).
- Belső layout: CSS grid, oszloponként egy 2. szintű `link` + alatta a `link.links` (3. szint). Jobb oldalon opcionális promó slot (kép + CTA).
- Hover **és** focus (`:focus-within`) nyit; Esc + kívülre kattintás zár.
- Sticky headernél a panel `z-index` > tartalom; egyszerre csak egy panel nyitva.

## Reszponzív
- `< 750px`: ③ nav-row elrejtve, helyette hamburger → drawer (többszintű).
- ① top bar mobilon: csak üzenet + utility linkek, social rejtve (vagy teljesen el).
- ② kereső mobilon külön sorba törhet.

## Stílus
- Theme tokenek (`--ink`, `--accent-deep`, `--accent-soft`, `--line`, `--bg-card`) használata — ne legyen hardcode szín.
- Dropdown: `--bg-card` háttér, `--line` border, finom árnyék, 12px radius (a header gombokhoz illően).

## Lépések sorrendje (javaslat)
1. `header.liquid` → 3 soros szerkezet + schema settingek.
2. `_header-menu` + `mega-menu` snippet (2.+3. szint), hover/focus + CSS.
3. Inline kereső a main barba.
4. Mobile drawer többszintűsítés + JS.
5. Top bar blokk (default OFF).

## Eldöntött irány
- **Mega-menü panel** a 2. szinten (oszlopos, opcionális promó képpel) — nem sima dropdown.
- **Inline kereső** kerül a main barba (placeholder-rotációval).
- **Top bar beépül**, de `enable_top_bar` default **OFF** — később egy kapcsolóval aktiválható.

## Még tisztázandó (később)
- Top bar végleges tartalma (üzenet/CTA szöveg, utility linkek listája).
- Mega-menü promó slot: kell-e kép/akció minden panelhez, vagy csak kiemelt kategóriákhoz.
