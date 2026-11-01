# Picnic-Ausbau Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Warenkorb, Angebote, Mengenrabatte, Produktdaten, Favoriten- und Rezeptimport über picnic-api 5.3 in Proviant nutzbar machen, dazu klarere Fehlermeldungen und ein Lagerort-Filter.

**Architecture:** Alles Picnic-Spezifische bleibt im Adapter `src/lib/server/picnic/`; jede neue Deutungs- oder Rechenregel liegt als reines Modul mit Vitest-Test daneben (Picnic-Seite) bzw. in `src/lib/` (auch im Browser gebraucht). Preise und Angebote laufen weiter über den Cache `picnic_prices`, der um Mindestmenge und Preisstaffeln erweitert wird. Routen holen Picnic-Daten fehlertolerant: ohne Verbindung oder bei Fehlern rendert jede Seite ohne den Picnic-Teil.

**Tech Stack:** SvelteKit 3, Svelte 5 (Runes), TypeScript, Drizzle/SQLite, Vitest, picnic-api 5.3.

**Spec:** `docs/superpowers/specs/2026-11-01-picnic-ausbau-design.md`

## Global Constraints

- Branch `picnic-ausbau` (zweigt von `picnic-api-5` ab). Ein Commit je Task, Commit-Messages deutsch, mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Nie bestellen**, kein `checkout.*`, **Lieferfenster nie setzen** (`setDeliverySlot` nicht verwenden).
- **Mengen nie automatisch ändern** – Mengenrabatt ist nur Hinweis + Knopf.
- „Lieber zu wenig als falsch“: unsichere Deutungen (Angebotslabel, Herkunft, Bio, Rezeptmengen) ergeben `null`/nichts.
- Picnic nur aus `#lib/server/picnic/index.js` importieren; reine Untermodule ohne SvelteKit-Import.
- Alle Oberflächentexte als Schlüssel in `src/lib/i18n/messages/en.ts` (Quelle) **und** `de.ts`, `nl.ts`; Server-Actions übersetzen mit `translator(locals.locale)`.
- Jeder Insert/Update mit `auditNew`/`auditEdit`; Migration per `npm run db:generate`.
- Formulare, deren Werte das Absenden überleben müssen: `use:enhance={keepValues}`.
- Neue Farbklassen gegen `src/routes/layout.css` (Dark-Overrides) prüfen; Farbwelt gray/white/green/amber/red. Mobile 375px: Kopfzeilen `flex-wrap`, kein `shrink-0` auf Button-Gruppen, Inputs ≥16px.
- Neue Log-Ausgaben über `logInfo`/`logWarn`/`logError` aus `#lib/server/log.js`.
- Live-Prüfungen gegen Picnic **nur lesend**; Schreibaktionen am echten Warenkorb (hinzufügen, entfernen, tauschen) erst nach ausdrücklicher Rückfrage beim Nutzer.
- Nach jedem Task: `npm run check` (0 Fehler) und `npm test` grün.

## Review Focus

1. **Picnic nicht verbunden oder Fehler/Timeout:** Artikelliste, Artikelseite, `/angebote`, `/bestellen`, Importseiten rendern ohne 500 – nur der Picnic-Teil fehlt bzw. zeigt einen Hinweis. (Tasks 5, 6, 7, 8)
2. **Unbekanntes Angebotslabel** (z.B. „Family-Preis“, „Neu“): kein Angebot angezeigt, kein Absturz, Label geloggt. (Task 5)
3. **Tausch, bei dem der Ersatz nicht im Warenkorb landet** (Picnic quittiert unbekannte IDs ohne Fehler): Meldung statt Erfolg. (Task 8)
4. **Leerer Warenkorb / kein Lieferfenster / kein Mindestbestellwert:** Block zeigt „leer“ bzw. lässt die Angaben weg, statt „0 €“ oder „null“. (Task 8)
5. **Rezept ohne `neededText` oder mit unbekannter Einheit:** Zutat wird mit Name, aber ohne Menge importiert, statt falsche Mengen zu speichern. (Task 3)

---

### Task 1: Klarere Picnic-Fehlermeldungen

**Files:**
- Create: `src/lib/server/picnic/errors.ts`, `src/lib/server/picnic/errors.test.ts`
- Modify: `src/lib/server/picnic/index.ts` (Re-Export), `src/lib/i18n/messages/{en,de,nl}.ts`, alle Stellen, die heute `err.message` aus Picnic-Aufrufen an die Oberfläche geben: `src/routes/bestellen/+page.server.ts`, `src/routes/artikel/import/+page.server.ts`, `src/routes/rezepte/import/+page.server.ts`, `src/routes/lieferung/**/+page.server.ts`, `src/routes/api/picnic/search/+server.ts` (per `grep -rn "err instanceof Error ? err.message" src/routes` vollständig finden)

**Interfaces:**
- Produces: `export type PicnicErrorKind = 'sessionExpired' | 'productNotFound' | 'unreachable' | 'unexpectedFormat' | 'rateLimited' | 'unknown';` und `export function picnicErrorKind(err: unknown): PicnicErrorKind;` – i18n-Schlüssel `picnic.error.<kind>`. Re-Export aus `index.ts`.

- [ ] **Step 1: Tests schreiben** (`errors.test.ts`), Erkennung per Duck-Typing (Feldname/Konstruktorname), damit der Test ohne Netz läuft:

```ts
expect(picnicErrorKind(Object.assign(new Error('x'), { status: 401, code: 'AUTH_INVALID_CRED' }))).toBe('sessionExpired');
expect(picnicErrorKind(Object.assign(new Error('x'), { status: 403, code: null }))).toBe('rateLimited');
expect(picnicErrorKind(Object.assign(new Error('x'), { name: 'ProductNotFoundError', productId: 's1' }))).toBe('productNotFound');
expect(picnicErrorKind(Object.assign(new Error('x'), { name: 'UnexpectedPageFormatError' }))).toBe('unexpectedFormat');
expect(picnicErrorKind(Object.assign(new TypeError('fetch failed')))).toBe('unreachable');
expect(picnicErrorKind(new Error('Zeitüberschreitung'))).toBe('unknown');
expect(picnicErrorKind('kaputt')).toBe('unknown');
```

Regeln: 401 → `sessionExpired`; 403 ohne `code` oder 429 → `rateLimited`; ≥500 → `unreachable`; `TypeError` mit „fetch“ oder `code` `ECONNREFUSED`/`ENOTFOUND`/`ETIMEDOUT` sowie der Adapter-Timeout (Fehlermeldung des `withTimeout` in `index.ts` – Klasse oder Kennung beim Bauen nachsehen) → `unreachable`.

- [ ] **Step 2:** `npx vitest run src/lib/server/picnic/errors.test.ts` → FAIL (Modul fehlt).
- [ ] **Step 3:** `errors.ts` implementieren; i18n-Texte (de als Leitlinie): sessionExpired „Die Anmeldung bei Picnic ist abgelaufen – bitte auf der Bestellseite neu verbinden.“, productNotFound „Dieses Produkt gibt es bei Picnic nicht mehr.“, unreachable „Picnic ist gerade nicht erreichbar. Bitte später erneut versuchen.“, unexpectedFormat „Picnic hat die Seite in einem unerwarteten Format geliefert.“, rateLimited „Picnic bremst gerade zu viele Anfragen – bitte kurz warten.“, unknown „Bei Picnic ist ein Fehler aufgetreten.“
- [ ] **Step 4:** Alle gefundenen Routen-Stellen auf `t(\`picnic.error.${picnicErrorKind(err)}\`)` umstellen und den Rohfehler per `logWarn('Picnic-Fehler', { route, error: String(err) })` loggen.
- [ ] **Step 5:** `npm run check && npm test` → grün.
- [ ] **Step 6:** Commit „Zeige verständliche Picnic-Fehlermeldungen“ inkl. CHANGELOG-Eintrag unter „Geändert“.

### Task 2: Filter „ohne Standard-Lagerort“

**Files:**
- Modify: `src/routes/artikel/+page.server.ts`, `src/routes/artikel/+page.svelte`, i18n (3 Dateien)

**Interfaces:**
- Produces: URL-Parameter `ohneLagerort=1` (lesezeichenfähig, kombinierbar mit `q` und `tag`); `load` liefert zusätzlich `noLocationFilter: boolean`. Task 6 ergänzt denselben Filterbereich um `angebot=1`.

- [ ] **Step 1:** In `load` Artikel herausfiltern, deren `defaultLocationId` `null` ist **oder** auf einen inaktiven Lagerort zeigt (aktive IDs via `activeLocations()` aus `#lib/server/locations.js`).
- [ ] **Step 2:** Im Filterbereich der Liste einen Umschalter (Link, der den Parameter setzt/entfernt und `q`/`tag` beibehält) mit Text `items.filter.noLocation` („Ohne Standard-Lagerort“).
- [ ] **Step 3:** `npm run check`; im Browser `/artikel?ohneLagerort=1` prüfen (auch mit `&tag=…`), Mobile 375px.
- [ ] **Step 4:** Commit „Filtere Artikel ohne Standard-Lagerort“ + CHANGELOG „Hinzugefügt“.

### Task 3: Rezeptimport über `recipe.getRecipe()`

**Files:**
- Create: `src/lib/server/picnic/recipeMapping.ts`, `src/lib/server/picnic/recipeMapping.test.ts`
- Modify: `src/lib/server/picnic/recipeImport.ts` (Typ `ParsedPicnicIngredient` erweitern; `parseRecipeDetail` und alles nur davon Genutzte entfernen, `extractRecipeTiles`/`collectMarkdown`/`buildInstructions` bleiben), `src/lib/server/picnic/index.ts`, `src/routes/rezepte/import/+page.server.ts`, `src/routes/rezepte/import/+page.svelte`, i18n

**Interfaces:**
- Consumes: Task 1 `picnicErrorKind`.
- Produces:
  - `ParsedPicnicIngredient` erweitert um `picnicId: string | null; pantry: boolean`.
  - `export function parseNeededText(text: string | null): { amount: number | null; unit: string | null }`
  - `export type RecipeLike` = schmaler Ausschnitt von picnic-api `Recipe` (`portions`, `defaultPortions`, `description`, `steps`, `note`, `ingredients[]` mit `name`, `sellingUnitId`, `type`, `neededText`) – Felder `unknown`-tolerant.
  - `export function mapPicnicRecipe(recipe: RecipeLike): ParsedPicnicRecipe` (servings = `portions`; `extraLines` = []; `tip` = `null`; `steps` aus `steps`, bei leeren Steps und vorhandener `note` die Note als Text ohne HTML-Tags in `steps`).
  - Adapter: `getPicnicRecipe(id: string): Promise<ParsedPicnicRecipe>` (ruft `recipe.getRecipe(id)`; weicht `portions` von `defaultPortions` ab, erneut mit `{ portions: defaultPortions }`), `listSavedPicnicRecipes(): Promise<PicnicRecipeTile[]>`, `listOwnPicnicRecipes(): Promise<PicnicRecipeTile[]>`. `getPicnicRecipeDetail` entfällt.

- [ ] **Step 1: Live lesend prüfen** (Skript im Scratchpad, wie `live.cjs`): `getRecipe` mit einer Kachel-ID aus `listPicnicRecipes()` funktioniert; Beispielwerte von `neededText` (Format in DE, z.B. „(188 g benötigt)“), `type`-Werte, ob `steps` gefüllt ist; `getSavedRecipes`/`getUserDefinedRecipes` liefern Listen. Befunde als Testfälle übernehmen.
- [ ] **Step 2: Tests schreiben:**

```ts
expect(parseNeededText('(188 g benötigt)')).toEqual({ amount: 188, unit: 'g' });
expect(parseNeededText('(0,5 l benötigt)')).toEqual({ amount: 0.5, unit: 'l' });
expect(parseNeededText('(150 g nodig)')).toEqual({ amount: 150, unit: 'g' });
expect(parseNeededText('(2 Stück benötigt)')).toEqual({ amount: 2, unit: 'Stück' });
expect(parseNeededText(null)).toEqual({ amount: null, unit: null });
expect(parseNeededText('irgendwas')).toEqual({ amount: null, unit: null });
// mapPicnicRecipe: Portionen, Verknüpfungs-ID, Vorrat
const mapped = mapPicnicRecipe({ portions: 4, defaultPortions: 4, description: 'Lecker', steps: ['Schneiden', 'Braten'], note: null,
  ingredients: [
    { name: 'Hähnchenbrust', sellingUnitId: 's100', type: 'CORE', neededText: '(400 g benötigt)' },
    { name: 'Salz', sellingUnitId: 's200', type: 'CUPBOARD', neededText: null },
    { name: 'Brühwürfel', sellingUnitId: '', type: 'CORE_STOCKABLE', neededText: null }] });
expect(mapped.servings).toBe(4);
expect(mapped.ingredients[0]).toEqual({ name: 'Hähnchenbrust', amount: 400, unit: 'g', picnicId: 's100', pantry: false });
expect(mapped.ingredients[1]).toMatchObject({ name: 'Salz', amount: null, pantry: true, picnicId: 's200' });
expect(mapped.ingredients[2]).toMatchObject({ picnicId: null, pantry: true });
expect(mapRecipeWithNoteOnly.steps).toEqual(['Erst anbraten, dann köcheln']); // note '<p>Erst anbraten, <b>dann</b> köcheln</p>'
```

Einheiten-Normalisierung: Werte auf die Einheiten von `#lib/units.js` abbilden (g, kg, ml, l, Stück; „Stk.“/„stuks“/„pieces“ → „Stück“); unbekannte Einheit → `{ amount: null, unit: null }`. Zutaten ohne Namen fallen weg.

- [ ] **Step 3:** `npx vitest run src/lib/server/picnic/recipeMapping.test.ts` → FAIL.
- [ ] **Step 4:** `recipeMapping.ts` implementieren, Adapterfunktionen ergänzen, `getPicnicRecipeDetail`/`parseRecipeDetail` entfernen (bestehende Tests dazu mit entfernen).
- [ ] **Step 5:** Tests → PASS.
- [ ] **Step 6: Route:** Parameter `quelle` = `katalog` (Standard) | `gespeichert` | `eigene` als drei Reiter. Import-Action nutzt `getPicnicRecipe`; je Zutat mit `picnicId`, zu der ein Artikel mit gleicher `articles.picnicId` existiert, eine Zeile in `recipeIngredientArticles` (mit `auditLink`). Vorratszutaten werden normal übernommen, aber ohne Artikelverknüpfung; die Vorschau (Import-Bestätigung bzw. Erfolgsmeldung) nennt sie als „Vorratszutaten“. `instructions` weiter über `buildInstructions`.
- [ ] **Step 7:** `npm run check && npm test`; im Browser ein Rezept je Reiter importieren, Portionen und Mengen gegen die Picnic-App vergleichen, verknüpfte Artikel am Rezept sehen; Testrezepte danach löschen.
- [ ] **Step 8:** Commit „Importiere Picnic-Rezepte über getRecipe“ + CHANGELOG („Behoben“: Portionen; „Hinzugefügt“: gespeicherte/eigene Rezepte, Artikelverknüpfung).

### Task 4: Favoriten als Quelle im Artikelimport

**Files:**
- Modify: `src/lib/server/picnic/index.ts`, `src/routes/artikel/import/+page.server.ts`, `src/routes/artikel/import/+page.svelte`, i18n

**Interfaces:**
- Produces: `export type FavoriteAisle = { id: string; title: string; products: { productId: string; name: string; unitQuantity: string; imageId: string | null }[] };` und `listFavoriteProducts(): Promise<FavoriteAisle[]>` (lädt Gänge mit `complete: false` per `getFavoritesInAisle` nach; leere Gänge weglassen; Dubletten über Gänge hinweg nur beim ersten Vorkommen).

- [ ] **Step 1:** Adapterfunktion implementieren (Nachladen mit der vorhandenen Nebenläufigkeitsgrenze des Adapters).
- [ ] **Step 2:** Route: Parameter `quelle=lieferungen` (Standard) | `favoriten`; Reiter oben. Favoritenansicht nach Gang gruppiert, Auswahl und Import-Action unverändert (gleiche Produktform → `importArticleFromPicnic`), bereits verknüpfte markiert.
- [ ] **Step 3:** `npm run check`; Browser: Favoriten laden (live: 14 Gänge erwartet), einen Artikel importieren, Doppelimport wird übersprungen; Testartikel danach löschen.
- [ ] **Step 4:** Commit „Biete Picnic-Favoriten im Artikelimport an“ + CHANGELOG.

### Task 5: Preis-Cache für Angebote und Staffeln erweitern

**Files:**
- Create: `src/lib/offers.ts`, `src/lib/offers.test.ts`, Migration `drizzle/0011_*.sql` (generiert)
- Modify: `src/lib/server/db/schema.ts` (`picnicPrices`), `src/lib/server/picnic/price.ts` + Test, `src/lib/prices.ts` + Test (anlegen, falls keiner existiert), `src/lib/server/prices.ts`, `src/lib/server/picnic/index.ts`, alle Aufrufer von `effectivePrice`/`savingsOf` mit Menge (`src/routes/bestellen/+page.svelte`, Rezept-/Wochenplanseiten – per grep finden)

**Interfaces:**
- Produces:
  - Schema `picnicPrices` + `promoMinQuantity: integer('promo_min_quantity')` (null = ab 1 Stück) und `priceRanges: text('price_ranges')` (JSON `PriceTier[]` oder null).
  - `src/lib/offers.ts`: `export type PriceTier = { fromQuantity: number; unitPrice: number };` `export function offerFromLabel(label: string, regularPrice: number): { unitPrice: number; minQuantity: number } | null;`
  - `ProductPrice` (in `picnic/price.ts`) und `CachedPrice` erweitert um `promoMinQuantity: number | null; priceRanges: PriceTier[] | null`.
  - `export function tilePrice(tile: { displayPrice?: unknown; originalPrice?: unknown; labels?: unknown; priceRanges?: unknown }): ProductPrice | null` in `picnic/price.ts` (Kacheln von Angebotsseite/Ersatz/Warenkorb; `priceRanges` mit `from_quantity` → `fromQuantity`).
  - `src/lib/prices.ts`: `export function totalFor(price: PriceParts & { promoMinQuantity?: number | null }, quantity: number): number;` und `export function savingsFor(price, quantity): number;` (ersetzen `effectivePrice(p) * n` / `savingsOf(p) * n` an allen Aufrufstellen; `effectivePrice`/`savingsOf` bleiben für Stückanzeigen).
  - `src/lib/server/prices.ts`: `export function storePrices(prices: Map<string, ProductPrice>): number` (Upsert in `picnic_prices`, gibt Anzahl zurück) – `refreshPrices` nutzt ihn intern.

- [ ] **Step 1: Live lesend prüfen:** Labels auf `getPromotions()` und in `getPromotionGroup()` sammeln (Liste ins Scratchpad), dazu je eine Kachel mit und ohne `originalPrice`. Aus den echten Labels die Testfälle für Step 2 ergänzen.
- [ ] **Step 2: Tests schreiben** (`offers.test.ts`, Preise in Cent):

```ts
expect(offerFromLabel('2 für 3,99 €', 249)).toEqual({ unitPrice: 200, minQuantity: 2 }); // 399/2 aufgerundet
expect(offerFromLabel('2 voor €3,99', 249)).toEqual({ unitPrice: 200, minQuantity: 2 });
expect(offerFromLabel('1+1 gratis', 300)).toEqual({ unitPrice: 150, minQuantity: 2 });
expect(offerFromLabel('2+1 gratis', 300)).toEqual({ unitPrice: 200, minQuantity: 3 });
expect(offerFromLabel('2. zum halben Preis', 300)).toEqual({ unitPrice: 225, minQuantity: 2 });
expect(offerFromLabel('2e halve prijs', 300)).toEqual({ unitPrice: 225, minQuantity: 2 });
expect(offerFromLabel('25% Rabatt', 400)).toEqual({ unitPrice: 300, minQuantity: 1 });
expect(offerFromLabel('Family', 300)).toBeNull();
expect(offerFromLabel('2 für 9,99 €', 249)).toBeNull(); // kein Vorteil → kein Angebot
```

`price.test.ts` (neu für `tilePrice`, ergänzt für `catalogPrice`):

```ts
expect(tilePrice({ displayPrice: 222, originalPrice: 349, labels: [] })).toMatchObject({ regularPrice: 349, promoPrice: 222, promoMinQuantity: null });
expect(tilePrice({ displayPrice: 300, originalPrice: null, labels: [{ text: '1+1 gratis' }] })).toMatchObject({ regularPrice: 300, promoPrice: 150, promoMinQuantity: 2, promoLabel: '1+1 gratis' });
expect(tilePrice({ displayPrice: 300, originalPrice: null, labels: [{ text: 'Neu' }] })).toMatchObject({ promoPrice: null });
expect(tilePrice({ displayPrice: 249, originalPrice: null, labels: [], priceRanges: [{ price: 219, from_quantity: 3 }] }).priceRanges).toEqual([{ fromQuantity: 3, unitPrice: 219 }]);
// catalogPrice mit promotion.label „1+1 gratis“ und ohne originalPrice → Mehrfachangebot wie oben
```

`prices.test.ts`:

```ts
const oneplusone = { regularPrice: 300, promoPrice: 150, promoMinQuantity: 2 };
expect(totalFor(oneplusone, 1)).toBe(300);
expect(totalFor(oneplusone, 2)).toBe(300);
expect(totalFor(oneplusone, 3)).toBe(600);
expect(savingsFor(oneplusone, 3)).toBe(300);
expect(totalFor({ regularPrice: 349, promoPrice: 222 }, 2)).toBe(444);
```

Wo `label` deutbar ist und **zusätzlich** `originalPrice` vorliegt, gewinnt der echte Streichpreis (`promoMinQuantity` null). Ein Label, das keiner Regel entspricht, wird mit `logWarn('Unbekanntes Picnic-Angebotslabel', { label })` geloggt – im Adapter, nicht im reinen Modul (dort `null` zurückgeben).

- [ ] **Step 3:** Tests laufen lassen → FAIL.
- [ ] **Step 4:** Implementieren; Schema ergänzen, `npm run db:generate`, Migration prüfen (zwei nullable Spalten, keine Backfill-Sonderbehandlung nötig); alle Mengen-Aufrufstellen auf `totalFor`/`savingsFor` umstellen; `pricesFor` liest die neuen Felder (`priceRanges` per `JSON.parse` defensiv, Fehler → `null`).
- [ ] **Step 5:** `npm run check && npm test` → grün; Bestellseite im Browser: Summen unverändert für normale Rabatte.
- [ ] **Step 6:** Commit „Deute Mehrfachangebote und Preisstaffeln von Picnic“ (noch ohne Changelog – sichtbar wird es erst mit Task 6).

### Task 6: Angebote auf Artikelliste, Artikelseite und `/angebote`

**Files:**
- Create: `src/lib/server/offers.ts`, `src/routes/angebote/+page.server.ts`, `src/routes/angebote/+page.svelte`, `src/lib/components/OfferBadge.svelte`
- Modify: `src/lib/server/picnic/index.ts`, `src/routes/artikel/+page.server.ts` + `.svelte`, `src/routes/artikel/[id]/+page.server.ts` + `.svelte`, `src/routes/+layout.svelte` (Navigation), i18n

**Interfaces:**
- Consumes: Task 5 `tilePrice`, `storePrices`, `offerFromLabel`, `totalFor`; Task 1 `picnicErrorKind`.
- Produces:
  - Adapter: `getPromotedProducts(): Promise<Map<string, ProductPrice>>` – alle Kacheln aus `catalog.getPromotions().sections[].products` plus Produkte jeder Aktionsgruppe (`getPromotionGroup(id)`, Gruppen-IDs aus der Sektion – Feldname beim Bauen in `PromotionSection` nachlesen), über `tilePrice` gedeutet, nur Einträge mit `promoPrice !== null`.
  - `src/lib/server/offers.ts`: `export async function currentOffers(): Promise<Map<string, CachedPrice>>` – ruft `getPromotedProducts` höchstens einmal je Stunde (Modul-Cache `{ at: number; data: Map } | null`, **keine Locale darin**), schreibt die Treffer für **eigene** Artikel-IDs per `storePrices` in `picnic_prices`, gibt die Map (nur eigene Artikel) zurück. Ohne Verbindung oder bei Fehler: leere Map + `logWarn`.
  - `OfferBadge.svelte`: Props `{ price: { regularPrice: number; promoPrice: number | null; promoMinQuantity: number | null; promoLabel: string | null }; locale: Locale; compact?: boolean }` – zeigt „je 2,00 € statt 2,49 € · bei 2 Stück“ (Zusatz nur bei `promoMinQuantity > 1`), `compact` = nur grünes „Angebot −20 %“-Abzeichen.

- [ ] **Step 1:** Adapter + `currentOffers` implementieren.
- [ ] **Step 2: Artikelliste:** `load` holt `currentOffers()` (Fehler → leer); Zeilen bekommen `offer` (oder `null`), `compact`-Badge; Filter `angebot=1` neben `ohneLagerort` (Task 2), kombinierbar.
- [ ] **Step 3: Artikelseite:** Für Artikel mit `picnicId` live `catalog.getProduct` über eine neue Adapterfunktion `getProductDetails(id: string): Promise<{ price: ProductPrice | null; unitPrice: string | null; product: Product }>` (Task 7 nutzt sie mit); Ergebnis per `storePrices` ablegen; großes grünes `OfferBadge` mit Picnics Label. Fehler → Abschnitt fehlt.
- [ ] **Step 4: `/angebote`:** Liste der eigenen Artikel aus `currentOffers()` mit Bild, Name, Badge, Bestand/Mindestbestand; Sortierung: Bestand < `minStock` zuerst, dann Ersparnis in Prozent absteigend (`1 - promoPrice/regularPrice`). Leerer Zustand und „nicht verbunden“-Hinweis. Navigationseintrag neben „Bestellen“ (`nav.offers`).
- [ ] **Step 5:** `npm run check && npm test`; Browser: Liste mit Badge, Filter, Artikelseite (Géramont o.ä. aus `/angebote`), `/angebote` auf 375px und im Dark Mode; zweiter Aufruf innerhalb einer Stunde ohne erneute Picnic-Anfragen (Server-Log).
- [ ] **Step 6:** Commit „Zeige Picnic-Angebote für eigene Artikel“ + CHANGELOG „Hinzugefügt“.

### Task 7: Produktdaten am Artikel

**Files:**
- Create: `src/lib/server/picnic/productFacts.ts`, `src/lib/server/picnic/productFacts.test.ts`, Migration `drizzle/0012_*.sql`
- Modify: `src/lib/server/db/schema.ts` (`articles`), `src/lib/server/articleImport.ts`, `src/lib/server/articleForm.ts`, `src/lib/components/ArticleForm.svelte`, `src/routes/artikel/[id]/+page.server.ts` + `.svelte`, i18n

**Interfaces:**
- Consumes: Task 6 `getProductDetails`.
- Produces:
  - Schema `articles` + `brand: text('brand')`, `origin: text('origin')`, `organic: integer('organic', { mode: 'boolean' }).notNull().default(false)`, `nutrition: text('nutrition')` (JSON `NutritionRow[]`).
  - `export type NutritionRow = { label: string; value: string | null; isCategory: boolean };`
  - `export type ProductFacts = { brand: string | null; origin: string | null; organic: boolean; nutrition: NutritionRow[] | null };`
  - `export function extractProductFacts(product: unknown): ProductFacts;` mit den Helfern `isOrganicLabel(text: string): boolean` und `findOrigin(product: unknown): string | null` (beide exportiert).
  - Adapter: `getProductFacts(id: string): Promise<ProductFacts>`.

- [ ] **Step 1: Live lesend prüfen:** Für 5–10 eigene verknüpfte Artikel `getProduct` ausgeben (`labels`, `infoSections[].title/content`, `highlightItems`, `brand`, `nutritionRows`); notieren, wo und wie die Herkunft steht (Titel wie „Herkunft“, „Ursprungsland“, „Herkunftsland“). Findet sich nichts Verlässliches: `findOrigin` gibt immer `null` zurück, Feld bleibt manuell – im CHANGELOG so benennen.
- [ ] **Step 2: Tests schreiben:**

```ts
expect(isOrganicLabel('Bio')).toBe(true);
expect(isOrganicLabel('Biologisch')).toBe(true);
expect(isOrganicLabel('EU-Bio')).toBe(true);
expect(isOrganicLabel('Demeter')).toBe(true);
expect(isOrganicLabel('Biotin')).toBe(false);
expect(isOrganicLabel('Biomarkt Müller')).toBe(false);
expect(extractProductFacts({ brand: 'Weihenstephan', labels: [{ text: 'Bio' }], nutritionRows: [{ label: 'Energie', value: '272 kJ', isCategory: true, backgroundColor: null }] }))
  .toEqual({ brand: 'Weihenstephan', origin: null, organic: true, nutrition: [{ label: 'Energie', value: '272 kJ', isCategory: true }] });
expect(extractProductFacts({ brand: null, labels: [], nutritionRows: [] })).toEqual({ brand: null, origin: null, organic: false, nutrition: null });
expect(extractProductFacts(null)).toEqual({ brand: null, origin: null, organic: false, nutrition: null });
// findOrigin: Testfälle aus Step 1 (Treffer und mehrdeutige Fälle → null)
```

`isOrganicLabel` prüft nur ganze Wörter (Wortgrenzen inkl. Bindestrich), case-insensitiv: bio, biologisch, organic, biologique, demeter, bioland, naturland.

- [ ] **Step 3:** Tests → FAIL; implementieren; Tests → PASS.
- [ ] **Step 4:** Schema + `npm run db:generate` (Boolean-Spalte mit konstantem Default ist bei `ADD COLUMN` erlaubt).
- [ ] **Step 5: Import:** `importArticleFromPicnic` holt nach dem Anlegen `getProductFacts` (Fehler → Artikel bleibt ohne Daten, kein Abbruch) und schreibt die vier Felder mit `auditEdit`.
- [ ] **Step 6: Artikelseite:** Action `refreshFromPicnic` (überschreibt die vier Felder, Erfolgsmeldung); Anzeige von Marke, Herkunft, Bio-Abzeichen, Grundpreis (`unitPrice` live aus `getProductDetails`, nicht gespeichert) und aufklappbarer Nährwerttabelle. `ArticleForm` + `articleForm.ts`: Felder Marke, Herkunft, Bio (Checkbox) – Nährwerte nicht editierbar.
- [ ] **Step 7:** `npm run check && npm test`; Browser: Artikel importieren → Daten da; Knopf „Daten von Picnic aktualisieren“ an einem bestehenden Artikel; Formular speichert manuelle Werte; Testartikel danach löschen.
- [ ] **Step 8:** Commit „Übernimm Marke, Herkunft, Bio und Nährwerte von Picnic“ + CHANGELOG.

### Task 8: Warenkorb, Mengenrabatte, Lieferfenster und Ankunftszeit

**Files:**
- Create: `src/lib/priceTiers.ts`, `src/lib/priceTiers.test.ts`, `src/lib/components/CartPanel.svelte`, `src/lib/components/CartButton.svelte`, `src/lib/server/cartActions.ts`
- Modify: `src/lib/server/picnic/index.ts`, `src/routes/bestellen/+page.server.ts` + `.svelte`, `src/routes/artikel/+page.server.ts` + `.svelte`, `src/routes/artikel/[id]/+page.server.ts` + `.svelte`, `src/routes/angebote/+page.server.ts` + `.svelte`, i18n

**Interfaces:**
- Consumes: Task 5 `PriceTier`, `tilePrice`, `totalFor`; Task 1 `picnicErrorKind`.
- Produces:
  - `src/lib/priceTiers.ts`: `export type TierHint = { fromQuantity: number; unitPrice: number; extraCost: number };` `export function tierHint(quantity: number, regularUnitPrice: number, tiers: PriceTier[]): TierHint | null;` – Hinweis nur, wenn ein Tier mit `fromQuantity === quantity + 1` und `unitPrice < ` dem bei `quantity` geltenden Stückpreis existiert; `extraCost` = Gesamtpreis bei n+1 minus bei n. Ein Mehrfachangebot (`promoMinQuantity`) wird vom Aufrufer als Tier `{ fromQuantity: promoMinQuantity, unitPrice: promoPrice }` mitgegeben.
  - Adapter:
    - `export type CartLine = { productId: string; name: string; unitQuantity: string; imageId: string | null; quantity: number; maxCount: number; linePrice: number; lineOriginalPrice: number | null; tiers: PriceTier[]; labels: string[]; isUnavailable: boolean; unavailableReason: string | null; replacementIds: string[] };`
    - `export type CartView = { lines: CartLine[]; totalCount: number; totalPrice: number; minimumOrderValue: number | null; slot: { start: string; end: string } | null };`
    - `getCartView(): Promise<CartView>`, `getReplacements(productId: string): Promise<{ id: string; name: string; unitQuantity: string; imageId: string | null; price: number }[]>`, `removeFromCart(productId: string, count: number): Promise<void>`, `getDeliveryEta(): Promise<{ eta: string | null; windowStart: string | null; windowEnd: string | null } | null>` (erste offene Lieferung per `getDeliverySummaries` + `getDeliveryPosition`; `eta` als ISO; ohne Lieferung/Fehler `null`).
  - `src/lib/server/cartActions.ts`: `export async function addArticleToCart(picnicId: string): Promise<'ok' | 'notInCart'>` (fügt 1 hinzu, prüft per `getCartQuantities`, dass die Menge gestiegen ist) – genutzt von Artikelliste, Artikelseite, `/angebote`.
  - `CartButton.svelte`: Props `{ articleId: number; picnicId: string | null; inCart: number; disabled: boolean; t: Translate }` – Formular `?/addToCart` mit `articleId`, zeigt „🛒 +1“ und „n im Warenkorb“; ohne `picnicId` Link „mit Picnic verknüpfen“ auf `/artikel/{id}`.

- [ ] **Step 1: Tests schreiben** (`priceTiers.test.ts`):

```ts
expect(tierHint(2, 249, [{ fromQuantity: 3, unitPrice: 219 }])).toEqual({ fromQuantity: 3, unitPrice: 219, extraCost: 159 }); // 657 − 498
expect(tierHint(1, 249, [{ fromQuantity: 3, unitPrice: 219 }])).toBeNull(); // Staffel zu weit weg
expect(tierHint(3, 249, [{ fromQuantity: 3, unitPrice: 219 }])).toBeNull(); // schon erreicht
expect(tierHint(1, 300, [{ fromQuantity: 2, unitPrice: 150 }])).toEqual({ fromQuantity: 2, unitPrice: 150, extraCost: 0 }); // 1+1
expect(tierHint(2, 249, [])).toBeNull();
expect(tierHint(0, 249, [{ fromQuantity: 1, unitPrice: 200 }])).toBeNull(); // Menge 0 → kein Hinweis
```

(Hinweis zum Spec-Beispieltext: „1 mehr kostet nur 1,59 € extra“ – der Spec-Wert 0,13 € war nur illustrativ; maßgeblich ist die Rechnung.)

- [ ] **Step 2:** `npx vitest run src/lib/priceTiers.test.ts` → FAIL; implementieren → PASS.
- [ ] **Step 3: Adapter** implementieren (`CartLineItem` → `CartLine`: `displayPrice`/`originalPrice` sind **Zeilen**preise; `priceRanges` → `tiers`; `labels[].text`). Ersatz-Namen/Preise ausschließlich aus `cart.getReplacements` (Cart-Felder sind Platzhalter).
- [ ] **Step 4: Bestellseite `load`:** parallel und je einzeln fehlertolerant `getCartView()`, `getDeliveryEta()`, für höchstens 5 nicht lieferbare Zeilen `getReplacements`. Vorschläge erhalten `tierHint` aus `price.priceRanges` (Task 5) bzw. Mehrfachangebot.
- [ ] **Step 5: Bestellseite Actions** (alle mit Gegenprüfung über `getCartQuantities` und Fehlern über `picnicErrorKind`): `cartRemove` (`productId`, ganze Menge), `cartChange` (`productId`, `delta` ±1; bei 0 entfernen; nicht über `maxCount`), `cartSwap` (`productId`, `replacementId`: alte Menge merken, entfernen, Ersatz in gleicher Menge hinzufügen; landet der Ersatz nicht → Meldung `order.cart.swapFailed`, das alte Produkt **wieder** hinzufügen).
- [ ] **Step 6: `CartPanel.svelte`** nach Variante A der Spec: Kopf (Anzahl, Summe, Mindestbestellwert-Abstand in Amber solange unterschritten, Lieferfenster oder „kein Lieferfenster gewählt“, Hinweis „ändern in der Picnic-App“), nicht Lieferbares zuerst (rot, Grund, Ersatzliste mit „tauschen“), Zeilen mit −/+/🗑, Link auf Artikelseite für bekannte `picnicId`s (Map aus `load`), Tier-Hinweis mit „+“. Aufklappbar (`<details>`), offen wenn nicht leer. Live-Ankunft als Zeile über dem Panel, nur wenn `getDeliveryEta()` etwas liefert.
- [ ] **Step 7: Vorschläge:** Tier-Hinweis unter der Zeile mit Knopf „auf n erhöhen“, der nur `quantities[item.id]` setzt.
- [ ] **Step 8: Artikelstamm:** Artikelliste, Artikelseite und `/angebote` laden einmal `getCartQuantities()` (Fehler → leere Map, Knöpfe deaktiviert) und rendern `CartButton`; Action `addToCart` in allen drei Routen über `addArticleToCart`.
- [ ] **Step 9:** `npm run check && npm test && npm run build`; Browser lesend: Warenkorb-Block mit echtem Inhalt, Lieferfenster, Mindestbestellwert, Mobile 375px, Dark Mode, Seite ohne Picnic-Verbindung. **Dann den Nutzer fragen**, ob hinzufügen/−/+/entfernen/tauschen am echten Warenkorb getestet werden darf; nur nach Zustimmung testen und den Ausgangszustand wiederherstellen.
- [ ] **Step 10:** Commit „Zeige und bearbeite den Picnic-Warenkorb in Proviant“ + CHANGELOG (Warenkorb, nicht lieferbar/Ersatz, Mengenrabatt-Hinweis, Lieferfenster, Mindestbestellwert, Ankunftszeit, Warenkorb-Knopf im Artikelstamm).

### Task 9: Doku und Abschlussprüfung

**Files:**
- Modify: `README.md`, `README.de.md`, `README.nl.md` (inhaltsgleich), `CLAUDE.md`, `CHANGELOG.md`; Wiki-Repo `Proviant.wiki.git`: `Ordering.md`, `Items.md`, `Recipes.md`, neu `Offers.md`, `_Sidebar.md`

- [ ] **Step 1:** READMEs: Funktionsliste um Warenkorb, Angebote, Produktdaten, Favoriten-/Rezeptimport ergänzen (drei Sprachen inhaltsgleich).
- [ ] **Step 2:** CLAUDE.md: neue reine Module in Test- und Modulliste (`errors.ts`, `recipeMapping.ts`, `productFacts.ts`, `offers.ts`, `priceTiers.ts`), Fallstricke: Ersatz nur über `getReplacements`, Mehrfachangebote im Preis-Cache (`promoMinQuantity`), `totalFor` statt `effectivePrice * n`, Angebots-Cache 1 h ohne Locale, Lieferfenster nie setzen.
- [ ] **Step 3:** Wiki klonen, Seiten aktualisieren/anlegen (englisch), `_Sidebar.md` um „Offers“ ergänzen, committen, nach Rückfrage pushen.
- [ ] **Step 4:** `npm run check && npm test && npm run build` → alles grün; Ausgabe festhalten.
- [ ] **Step 5:** Commit „Dokumentiere den Picnic-Ausbau“; Branch pushen und PR gegen `main` erst nach Rückfrage beim Nutzer (Hinweis im PR: baut auf PR #40 auf).
