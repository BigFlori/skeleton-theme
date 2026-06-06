# Nyelv- és pénznem-választó — fejlesztési terv

> Cél: a jelenlegi, kezdetleges nyelv/ország választó felzárkóztatása a nagy webshopok színvonalára.
> Elsődleges piac: **Magyarország (HU / HUF / magyar)** és **Ausztria (AT / EUR / német)**, másodlagosan nemzetközi (EN).

---

## 1. Jelenlegi állapot (audit)

### Hol él a kód
| Hely | Fájl | Megjegyzés |
|------|------|------------|
| Desktop header | [sections/header.liquid](sections/header.liquid) (62–118. sor markup, 354–442. CSS, 448–454. JS) | Két külön `<details>` dropdown |
| Mobil drawer | [snippets/mobile-nav-drawer.liquid](snippets/mobile-nav-drawer.liquid) (72–108. sor) | Lapos gomblista |
| Footer | [sections/footer.liquid](sections/footer.liquid) | **Nincs** választó |

### Hogyan működik most
- **Két különálló választó**: külön a *nyelv* (`localization.available_languages`) és külön az *ország/pénznem* (`localization.available_countries`).
- Desktop: natív `<details>/<summary>`, a triggeren földgömb/térkép-tű ikon + a kód (pl. `HU`, `EUR`), lenyíló panel az opciókkal.
- Záráshoz egy globális `document.addEventListener('click', …)` ami minden nyitott `<details>`-t becsuk a panelen kívüli kattintásra.
- **Minden opció saját `{% form 'localization' %}` + submit gomb** → minden választás full-page POST + teljes újratöltés.
- Ország opció felirata: `{{ country.name }} ({{ country.currency.iso_code }})` — pl. „Austria (EUR)".
- Nyelv opció felirata: `{{ language.endonym_name }}` — pl. „Magyar", „Deutsch".
- Csak `≥750px`-en látszik a header választó; mobilon a drawer alján.

### Gyenge pontok
1. **N darab `<form>` a DOM-ban** — minden egyes nyelvhez/országhoz külön form generálódik. Felesleges markup, nehéz karbantartani, akadálymentesség szempontjából zajos.
2. **Nincs összhang nyelv ↔ ország között.** A user beállíthat AT országot, de magyar nyelven maradhat — és fordítva. A két döntés logikailag összefügg (AT→német/EUR, HU→magyar/HUF), de a UI szétválasztja.
3. **Nincs geolokáció-alapú javaslat.** Aki Ausztriából jön, alapból a bolt default piacát kapja, nincs „Úgy tűnik, Ausztriából érkeztél — váltasz EUR-ra?" jellegű terelés.
4. **Nincs vizuális segítség** — se zászló, se kereső (kis listánál nem gond, de skálázódáskor igen).
5. **Nincs perzisztencia-visszajelzés** — a választás után csak újratöltődik az oldal, nincs megerősítés.
6. **Footer-ben nincs választó** — pedig a nagy shopoknál bevett, hogy a lábléc is tartalmaz egy markat/locale váltót.
7. **Akadálymentesség hiányos** — a `<details>` dropdown nem kezel billentyű-navigációt (nyilak), nincs `aria-expanded`/`role="listbox"`, fókusz-csapda.
8. **Pénznem ≠ ország** keveredés: a trigger pénznem-kódot mutat (`EUR`), de a panel országokat sorol. A user fejében „pénznemet választok", a rendszerben „országot/piacot".

---

## 2. Összevetés nagy webshopokkal

| Szempont | Mi most | Apple | IKEA | Zalando | Zara / H&M | About You |
|----------|---------|-------|------|---------|------------|-----------|
| Belépő pont | Header ikon + kód | Footer „országválasztó" oldal | Külön ország-portál oldal | Header dropdown | Header + dedikált oldal | Header dropdown |
| Nyelv+ország kapcsolat | **Szétválasztva** | Egyben (ország → nyelv alválasztás) | Egyben | Egyben (zászló+nyelv) | Egyben | Egyben |
| Geo-javaslat | **Nincs** | Igen (banner/redirect) | Igen | Igen (popup) | Igen | Igen |
| Zászlók | Nincs | Nincs (tipográfia) | Igen | Igen | Részben | Igen |
| Kereső a listában | Nincs | Igen (sok ország) | Igen | — | Igen | — |
| Modal vs dropdown | Dropdown | Teljes oldal | Teljes oldal/modal | Dropdown/modal | Modal | Modal/panel |
| Megerősítés | Nincs (reload) | Van | Van | Van | Van | Van |

**Tanulságok a mi méretünkre (2 fő piac):**
- A „teljes oldalas országportál" (Apple/IKEA) **túlzás** nekünk — az több tucat piacnál indokolt.
- A **Zalando/About You-féle összevont, zászlós, geo-javaslattal kiegészített dropdown/modal** a mi sweet spotunk.
- Mivel csak HU és AT (+EN) a cél, a **kereső felesleges**, de a **geo-banner és az egyesített „régió" választó** nagy UX-nyereség.

---

## 3. Javasolt célállapot

### Koncepció: egyetlen „régió/market" választó + geo-banner

1. **Egyesített választó (region picker).** A nyelv és az ország/pénznem helyett egy logikai egység: „Régió". Minden sor egy teljes kombinációt jelent:
   - 🇭🇺 **Magyarország** — Magyar · HUF
   - 🇦🇹 **Österreich** — Deutsch · EUR
   - 🇪🇺/🌐 **International** — English · EUR
   - Egy kattintás egyszerre állítja a `country_code`-ot **és** a `language_code`-ot (egy `localization` form, két hidden input).
2. **Haladó mód (opcionális, később).** Ha valakinek mégis külön kell (pl. magyar nyelv EUR-ral), egy „Speciális beállítás" lenyíló a modal alján külön nyelv- és pénznem-rádióval. MVP-ben nem kell.
3. **Geo-javaslat banner.** Első látogatáskor, ha a `request.country` (Shopify geolokáció) eltér az aktuális markettől: diszkrét banner felül vagy a választó mellett — „Úgy tűnik, Ausztriából nézed az oldalt. Váltás: Österreich (EUR)? [Igen] [Maradok]". Választás `localStorage`-be mentve, hogy ne ugráljon vissza.
4. **Egységes komponens.** A header és a mobil drawer **ugyanazt a snippetet** rendereli, hogy ne duplikálódjon a markup és a logika.
5. **Footer belépő.** A footerbe is kerüljön egy kompakt trigger (a nagy shopok mintájára), ami ugyanazt a modalt/panelt nyitja.

### UI/UX részletek
- **Zászlók**: kis SVG/emoji zászló minden sor elején (HU/AT/EU). Emoji zászló a legolcsóbb (nincs asset), de Windows desktopon nem renderel rendesen → **inline SVG zászló snippet** ajánlott (`snippets/flag.liquid`, az `icon.liquid` mintájára).
- **Aktív állapot**: pipa ikon + kiemelt háttér az aktuális régiónál.
- **Megjelenítés**: desktopon a mostani dropdown stílus is jó, de a több infó (zászló + nyelv + pénznem) miatt érdemes **kis modal/panel**-re váltani; mobilon a drawer alján bottom-sheet.
- **Akadálymentesség**: `role="listbox"` / `role="option"`, `aria-selected`, nyíl-billentyűs navigáció, `Esc` zár, fókusz-visszaállítás a triggerre.
- **Animáció**: finom fade/scale a panelnél (≤200ms), a téma meglévő tranzíció-stílusához igazítva.

---

## 4. Technikai terv (Liquid + Shopify Markets)

### 4.1 Adatmodell
A Shopify-ban a nyelv↔ország kombináció a **Markets** beállításból jön. Ellenőrizni kell, hogy az Admin → Markets-ben definiálva van-e:
- **Hungary** market: HU ország, HUF pénznem, magyar elsődleges nyelv.
- **Austria** (vagy „Europe/EU") market: AT ország, EUR, német nyelv.
- **International**: catch-all, EN, EUR/USD.

A témából elérhető:
- `localization.available_countries` → ország + `country.currency` + `country.market` + `country.available_languages`.
- `localization.available_languages` → összes aktív nyelv.
- `localization.country.market` → aktuális market (a párosításhoz).
- `request.country` / Shopify geolokáció → ajánláshoz.

> **Fontos:** a country objektumon elérhető a `country.available_languages` — ezzel lehet ország→nyelv párt építeni a UI-ban (egy ország alatt lehet több nyelv).

### 4.2 Új fájlok / változások
1. **`snippets/region-selector.liquid`** (új) — egyetlen, paraméterezhető komponens:
   - Paraméter: `id` (egyedi), `variant: 'header' | 'drawer' | 'footer'`.
   - **Egyetlen** `{% form 'localization' %}`, benne rejtett `country_code` + `language_code`, amit JS állít a kattintott opció `data-*` attribútumaiból, majd submitol — így nem kell N darab form.
   - Iteráció `localization.available_countries`-on, soronként zászló + ország + nyelv + pénznem.
2. **`snippets/flag.liquid`** (új) — `icon.liquid` mintájára `{% case %}`-szel ország-zászló SVG-k (HU, AT, EU/Intl). 24×24 viewBox-konvenció.
3. **`assets/region-selector.js`** (új) — panel nyitás/zárás, billentyű-navigáció, opció→hidden input→submit, geo-banner logika + `localStorage` perzisztencia.
4. **`sections/header.liquid`** — a 62–118. sor markup és a 354–442. CSS lecserélése `{% render 'region-selector', variant: 'header' %}`-re; a 448–454. ad-hoc JS törlése (átkerül a dedikált JS-be).
5. **`snippets/mobile-nav-drawer.liquid`** — 72–108. sor lecserélése `{% render 'region-selector', variant: 'drawer' %}`-re.
6. **`sections/footer.liquid`** — kompakt trigger hozzáadása ugyanahhoz a komponenshez.
7. **Locale kulcsok** (`locales/*.json`) — új stringek: `localization.region`, `localization.choose_region`, `localization.suggestion_banner` ({{country}} interpolációval), `localization.confirm`, `localization.dismiss`, `localization.advanced`. Mindhárom nyelven (hu / de / en).

### 4.3 Geo-banner logika (vázlat)
```liquid
{%- comment -%} request.country = Shopify geo-IP ország {%- endcomment -%}
{%- assign geo = request.country -%}
{%- if geo and geo.iso_code != localization.country.iso_code -%}
  <div class="region-suggest" data-geo="{{ geo.iso_code }}" hidden>
    … „Úgy tűnik {{ geo.name }}-ból nézed…" + [Váltás] [Maradok] …
  </div>
{%- endif -%}
```
JS: ha `localStorage['region-dismissed']` nincs beállítva ÉS a geo eltér → banner megjelenítése. „Maradok"/„Váltás" után flag mentése, hogy ne villogjon.

> Megjegyzés: a `request.country` csak akkor töltődik, ha a boltban be van kapcsolva a Shopify geolokáció (Markets). Ha nincs, a Shopify „Geolocation" app vagy a `Shopify.designMode`/`/browsing_context_suggestions.json` endpoint a fallback.

---

## 5. Ütemezés / fázisok

### Fázis 1 — Refaktor + egységesítés (alap, törésmentes)
- `region-selector.liquid` snippet létrehozása, **egyetlen formmal** (N form → 1 form).
- Header és mobil drawer átállítása a közös snippetre.
- Locale kulcsok bevezetése.
- *Eredmény:* tisztább kód, kevesebb DOM, azonos vizuál — alacsony kockázat.

### Fázis 2 — UX-feljavítás
- `flag.liquid` zászló-snippet + zászlók a sorokba.
- Egyesített „régió" sorok (zászló + nyelv + pénznem egy kattintással country+language).
- Aktív állapot pipával, panel-animáció, billentyű-navigáció, ARIA.

### Fázis 3 — Geo-javaslat
- `request.country` alapú banner + `localStorage` perzisztencia.
- A/B-zhető terelés (Igen/Maradok).

### Fázis 4 — Finomítás (opcionális)
- Footer belépő.
- „Speciális beállítás" külön nyelv/pénznem haladóknak.
- Analytics esemény a váltásokra (mely régiót választják).

---

## 6. Ellenőrzőlista a célpiacokra

- [ ] Admin → Markets: **Hungary** (HU/HUF/magyar) és **Austria** (AT/EUR/német) market létezik és aktív.
- [ ] Mindkét nyelv (hu, de) publikálva van, az `en` mint nemzetközi fallback.
- [ ] HUF árformázás helyes (ezres tagolás, „Ft" suffix) és EUR formázás (vessző decimális, „€").
- [ ] A választó az `all-products` és minden lokalizált URL-t helyesen kezel váltáskor (a Shopify a `localization` form után a megfelelő `/hu`, `/de` prefixre irányít).
- [ ] Geolokáció be van kapcsolva a Markets beállításban (a banner csak így működik).
- [ ] Mobilon a bottom-sheet érintésre jól záródik, nem ütközik a meglévő drawerrel.

---

## 7. Kockázatok / megjegyzések

- **Markets-függőség:** a témakód csak azt tudja megjeleníteni, amit a Markets beállítás kínál. A nyelv↔ország párosítás minősége a backend-konfiguráción múlik.
- **Geo-pontosság:** IP-alapú, nem 100%. Ezért **javaslat**, soha ne automatikus, visszavonhatatlan redirect.
- **SEO:** a nyelv-váltás `hreflang` tageket igényel a `<head>`-ben (érdemes ellenőrizni, hogy a téma kiteszi-e — ha nem, ez külön feladat).
- **Cache:** a Shopify localization cookie + URL-prefix kezeli a perzisztenciát; a saját `localStorage` csak a banner elnyomására kell.
