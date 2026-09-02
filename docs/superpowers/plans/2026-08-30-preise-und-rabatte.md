# Preise und Rabatte — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die App zeigt, was Artikel und Rezepte kosten und was man bei laufenden Picnic-Angeboten spart.

**Architecture:** Preise kommen aus einem DB-Cache (`picnic_prices`), der bedarfsgesteuert von Picnic aufgefrischt wird — ein Live-Abruf beim Rendern scheidet aus, weil Picnic keinen Bulk-Lookup kennt (ein Call pro Produkt). Die Deutung der Picnic-Antworten steckt in einem reinen, netzwerkfreien Parser (`server/picnic/price.ts`), die Rezept-Kalkulation in einem reinen Rechenmodul (`lib/recipeCost.ts`) — beide mit Tests, weil laut `CLAUDE.md` genau dort die schwersten Bugs stecken. Die Routen bleiben dünn.

**Tech Stack:** SvelteKit 2 (Svelte 5 Runes), TypeScript, SQLite via Drizzle, Vitest, `picnic-api` (inoffiziell).

**Spec:** [`docs/superpowers/specs/2026-08-30-preise-und-rabatte-design.md`](../specs/2026-08-30-preise-und-rabatte-design.md)

## Global Constraints

- **Node.js ≥ 22.12** (Vite 8).
- **Kommentare und Commit-Messages deutsch.** Oberflächentexte **nie** fest in Komponenten oder Server-Actions — immer nach `src/lib/i18n/messages/`. `en.ts` ist die Quelle der Wahrheit; `de.ts`/`nl.ts` sind dagegen typisiert, ein fehlender Schlüssel bricht `npm run check`.
- **Formatierung von Hand, Tabs.** Kein Prettier, kein ESLint. Am Stil der jeweiligen Datei ausrichten.
- **Preise sind immer `number` in Cent.** Formatiert wird ausschließlich mit `formatPrice(cents, locale)` aus `$lib/format`. **Keine** der fünf zu ändernden Svelte-Dateien importiert das bisher — der Import ist in jeder Task 8–12 neu zu setzen (`import { formatPrice } from '$lib/format';`). Die Sprache steht als `data.locale` bereit.
- **`keepValues`** ist in `src/routes/bestellen/+page.svelte:2` bereits importiert — dort keinen zweiten Import anlegen.
- **Audit-Felder:** Bei jedem Insert/Update in bestehende Tabellen die Helfer aus `$lib/server/audit` einspreizen und `locals.user?.username` durchreichen. **Ausnahme:** die neue Tabelle `picnic_prices` trägt bewusst keine Audit-Felder (§ 3 des Specs).
- **Journal:** Dieser Plan schreibt **nirgends** in `stock_entries`. Falls das doch nötig scheint — nicht tun, das reißt ein Loch ins Buchungsjournal.
- **Dark Theme:** Vor jeder neuen Utility-Klasse in `src/routes/layout.css` nachsehen, ob sie dort einen Override hat. Opazitätsvarianten sind eigene Klassen (`bg-green-50/50` hat einen, `bg-green-50/60` nicht).
- **Mobile:** Kopfbereiche mit Button-Gruppen: äußerer Container `flex-wrap`, **kein** `shrink-0` auf die Gruppe (375px-Fallstrick, zweimal passiert).
- **Verifikation vor jedem Commit:** `npm run check` **und** `npm test`. Vor dem letzten Commit zusätzlich `npm run build`.
- **CHANGELOG.md:** Jede spürbare Änderung kommt unter `## [Unveröffentlicht]` in **denselben Commit** wie die Änderung.

### Die zwei Preis-Regeln (Verwechslung ist der Hauptfehler)

| | Streichpreis (`regularPrice`) | Tatsächlicher Preis (`promoPrice`) |
| --- | --- | --- |
| **ORDER_LINE** (Lieferung) | `line.price` | `PRICE`-Decorator, Feld `display_price` |
| **Katalogseite** (Produkt) | PML-Knoten `{type:"PRICE", isCrossed:true}` | `displayPrice` aus `getProductDetails()` |

Beide live gemessen. Sie sind **nicht** ineinander überführbar. Zusätzlich: `line.price` ist der **Zeilen-Gesamtpreis**, nicht der Stückpreis.

---

## Dateiübersicht

**Neu:**

| Datei | Verantwortung |
| --- | --- |
| `src/lib/server/picnic/price.ts` | Reine Deutung der Picnic-Preisstrukturen (beide Regeln, getrennt) |
| `src/lib/server/picnic/price.test.ts` | Tests dazu, gegen eingefrorene Fixtures |
| `src/lib/server/prices.ts` | Cache lesen und auffrischen |
| `src/lib/server/settings.ts` | `defaultPortions()` — Naht für die spätere Admin-Einstellung |
| `src/lib/recipeCost.ts` | Reine Kostenrechnung je Rezept |
| `src/lib/recipeCost.test.ts` | Tests dazu |

**Geändert:**

| Datei | Änderung |
| --- | --- |
| `src/lib/server/db/schema.ts` | Tabelle `picnicPrices` |
| `src/lib/units.ts` | `CoverageResult.fullPackages` (additiv) |
| `src/lib/units.test.ts` | Tests für `fullPackages` |
| `src/lib/server/picnic/index.ts` | `getProductPrices()`, Re-Export der Preistypen |
| `src/lib/server/picnic/checklist.ts` | Preis/Ersparnis je Position |
| `src/lib/server/picnic/checklist.test.ts` | Tests dazu |
| `src/routes/bestellen/+page.{server.ts,svelte}` | Preise, Ersparnis, Refresh-Button |
| `src/routes/rezepte/[id]/+page.{server.ts,svelte}` | Zwei Kostenblöcke, Portionen ab `defaultPortions()` |
| `src/routes/rezepte/+page.{server.ts,svelte}` | „ca. X €/Portion" je Kachel |
| `src/routes/rezepte/wochenplan/+page.{server.ts,svelte}` | Summe und Ersparnis |
| `src/routes/lieferung/[id]/+page.{server.ts,svelte}` | Erzielte Ersparnis |
| `src/lib/i18n/messages/{en,de,nl}.ts` | Neue Schlüssel |
| `CLAUDE.md`, `CHANGELOG.md`, `README*.md` | Doku |

---

## Task 1: Picnic-Preisparser

Reine Deutung beider Picnic-Strukturen. Netzwerkfrei und ohne SvelteKit-Import, damit eigenständig testbar — wie `checklist.ts` und `unitQuantity.ts`.

**Files:**
- Create: `src/lib/server/picnic/price.ts`
- Create: `src/lib/server/picnic/price.test.ts`
- Modify: `CLAUDE.md` (Picnic-Block)

**Interfaces:**
- Consumes: nichts.
- Produces:
  - `type ProductPrice = { regularPrice: number; promoPrice: number | null; promoLabel: string | null }`
  - `crossedOutPrice(page: unknown, currentPrice: number): number | null`
  - `lineSavings(line: unknown): ProductPrice | null`

- [ ] **Schritt 1: Test schreiben**

`src/lib/server/picnic/price.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { crossedOutPrice, lineSavings } from './price';

/**
 * Ausschnitt einer rohen Produktseite, wie Picnic sie für ein **rabattiertes**
 * Produkt liefert (live geprüft an s1021273, Mazola Rapsöl: 3,49 € statt 4,49 €).
 * Verschachtelt, weil der Parser die Knoten in beliebiger Tiefe finden muss.
 */
const angebotsSeite = {
	layout: {
		body: {
			children: [
				{
					pml: {
						component: {
							children: [
								{ type: 'PRICE', price: 349, color: '#b40117', fontSize: 28 },
								{ type: 'PRICE', price: 449, color: '#c9c6c3', fontSize: 22, isCrossed: true }
							]
						}
					}
				}
			]
		}
	}
};

/**
 * Ohne Rabatt gibt es **gar keine** PRICE-Komponente (live geprüft an
 * s1020625) — der Preis steckt dann in einer markdown.props-Struktur.
 */
const normalSeite = {
	layout: { body: { children: [{ markdown: { props: { __ep1: { v0: { price: 249 } } } } }] } }
};

describe('crossedOutPrice', () => {
	it('findet den durchgestrichenen Originalpreis', () => {
		expect(crossedOutPrice(angebotsSeite, 349)).toBe(449);
	});

	it('meldet ohne PRICE-Komponente keinen Rabatt', () => {
		expect(crossedOutPrice(normalSeite, 249)).toBeNull();
	});

	// Ein Streichpreis unter dem aktuellen Preis wäre ein negativer Rabatt —
	// eher Datenfehler als Angebot, deshalb lieber nichts melden.
	it('ignoriert einen Streichpreis, der nicht höher liegt', () => {
		const seite = { c: [{ type: 'PRICE', price: 349, isCrossed: true }] };
		expect(crossedOutPrice(seite, 349)).toBeNull();
		expect(crossedOutPrice({ c: [{ type: 'PRICE', price: 300, isCrossed: true }] }, 349)).toBeNull();
	});

	it('verkraftet Datenmüll, ohne zu werfen', () => {
		expect(crossedOutPrice(null, 100)).toBeNull();
		expect(crossedOutPrice('nope', 100)).toBeNull();
		expect(crossedOutPrice({ type: 'PRICE', price: 'viel', isCrossed: true }, 100)).toBeNull();
	});
});

describe('lineSavings', () => {
	// An der ORDER_LINE ist die Semantik genau umgekehrt zur Katalogseite:
	// line.price ist der Streichpreis, der PRICE-Decorator der gezahlte Preis.
	it('liest Streichpreis aus line.price und Aktionspreis aus dem Decorator', () => {
		const line = {
			price: 249,
			decorators: [
				{ type: 'PRICE', display_price: 199 },
				{ type: 'PROMO', text: 'jetzt 1.99€' }
			]
		};
		expect(lineSavings(line)).toEqual({
			regularPrice: 249,
			promoPrice: 199,
			promoLabel: 'jetzt 1.99€'
		});
	});

	it('meldet ohne Decorators keinen Rabatt', () => {
		expect(lineSavings({ price: 325 })).toEqual({
			regularPrice: 325,
			promoPrice: null,
			promoLabel: null
		});
	});

	it('ignoriert einen Aktionspreis, der nicht unter dem Normalpreis liegt', () => {
		const line = { price: 199, decorators: [{ type: 'PRICE', display_price: 249 }] };
		expect(lineSavings(line)?.promoPrice).toBeNull();
	});

	it('gibt null zurück, wenn kein brauchbarer Preis da ist', () => {
		expect(lineSavings({})).toBeNull();
		expect(lineSavings(null)).toBeNull();
		expect(lineSavings({ price: 0 })).toBeNull();
	});
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run src/lib/server/picnic/price.test.ts
```

Erwartet: FAIL — `Failed to resolve import "./price"`.

- [ ] **Schritt 3: Implementieren**

`src/lib/server/picnic/price.ts`:

```ts
/**
 * Reine Deutung der Picnic-Preisstrukturen. Ohne Netz und ohne
 * SvelteKit-Import, damit eigenständig testbar.
 *
 * ACHTUNG — es gibt **zwei Quellen mit gegenläufigen Regeln** (beide live
 * geprüft, siehe CLAUDE.md):
 *
 *   ORDER_LINE:    line.price = Streichpreis, PRICE-Decorator = gezahlter Preis
 *   Katalogseite:  displayPrice = gezahlter Preis, PRICE-Knoten mit
 *                  isCrossed = Streichpreis
 *
 * Die beiden Funktionen bleiben deshalb bewusst getrennt statt hinter einer
 * gemeinsamen Abstraktion — eine Zusammenlegung lüde genau zu der
 * Verwechslung ein, die hier der teuerste Fehler wäre (Rabatt als Aufschlag).
 */

export type ProductPrice = {
	/** Normalpreis in Cent (der Streichpreis). */
	regularPrice: number;
	/** Aktionspreis in Cent; `null` = kein Rabatt. */
	promoPrice: number | null;
	/** Beschriftung der Aktion, z.B. „10% Rabatt". Reine Anzeige. */
	promoLabel: string | null;
};

type PriceNode = { price: number; isCrossed: boolean };

/**
 * Sammelt alle `{ type: "PRICE", price: number }`-Knoten der Seite in
 * Dokumentreihenfolge. Tiefenbegrenzt, weil die PML-Strukturen dynamisch sind
 * und wir uns nicht auf ihre Form verlassen können.
 */
function priceNodes(node: unknown, out: PriceNode[] = [], depth = 0): PriceNode[] {
	if (depth > 40 || node == null || typeof node !== 'object') return out;
	if (Array.isArray(node)) {
		for (const value of node) priceNodes(value, out, depth + 1);
		return out;
	}
	const record = node as Record<string, unknown>;
	if (record.type === 'PRICE' && typeof record.price === 'number') {
		out.push({ price: record.price, isCrossed: record.isCrossed === true });
	}
	for (const value of Object.values(record)) priceNodes(value, out, depth + 1);
	return out;
}

/**
 * Durchgestrichener Originalpreis eines rabattierten Produkts aus der **rohen**
 * Produktseite. `getProductDetails()` kennt ihn nicht, `search()` liefert
 * leere Decorators — diese Seite ist die einzige Quelle.
 *
 * Nimmt den ersten Treffer in Dokumentreihenfolge: der Hauptpreisblock steht
 * vorn, weiter hinten folgen Ähnliche-Produkte-Kacheln mit eigenen Preisen.
 * Ohne Rabatt gibt es gar keine PRICE-Komponente — dann `null`.
 */
export function crossedOutPrice(page: unknown, currentPrice: number): number | null {
	if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;
	for (const node of priceNodes(page)) {
		// Nur ein echt höherer Streichpreis ist ein Rabatt
		if (node.isCrossed && node.price > currentPrice) return node.price;
	}
	return null;
}

/**
 * Preis und Ersparnis einer Bestellposition (ORDER_LINE) einer Lieferung.
 *
 * `line.price` ist der **Zeilen-Gesamtpreis** zum Normalpreis, nicht der
 * Stückpreis (live geprüft: Menge 2 → price 298 bei 1,49 € je Stück). Für
 * einen Stückpreis müsste durch die QUANTITY geteilt werden; die Anzeige
 * bleibt bewusst auf Zeilenebene, dort stimmt die Zahl ohne Division.
 */
export function lineSavings(line: unknown): ProductPrice | null {
	if (line == null || typeof line !== 'object') return null;
	const record = line as { price?: unknown; decorators?: unknown };

	const regularPrice = typeof record.price === 'number' ? record.price : null;
	if (regularPrice == null || regularPrice <= 0) return null;

	const decorators = Array.isArray(record.decorators) ? record.decorators : [];
	const priceDecorator = decorators.find(
		(d: unknown) => (d as { type?: unknown } | null)?.type === 'PRICE'
	) as { display_price?: unknown } | undefined;
	const promoDecorator = decorators.find(
		(d: unknown) => (d as { type?: unknown } | null)?.type === 'PROMO'
	) as { text?: unknown } | undefined;

	const candidate =
		typeof priceDecorator?.display_price === 'number' ? priceDecorator.display_price : null;

	return {
		regularPrice,
		// Ein „Aktionspreis" über dem Normalpreis ist ein Datenfehler, kein Angebot
		promoPrice: candidate != null && candidate > 0 && candidate < regularPrice ? candidate : null,
		promoLabel: typeof promoDecorator?.text === 'string' ? promoDecorator.text : null
	};
}
```

- [ ] **Schritt 4: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run src/lib/server/picnic/price.test.ts
```

Erwartet: PASS, 8 Tests.

- [ ] **Schritt 5: Fallstricke in CLAUDE.md festhalten**

Im Abschnitt **„Picnic-Datenstrukturen"** von `CLAUDE.md` als weiteren Aufzählungspunkt einfügen:

```markdown
  - **Preise und Rabatte folgen zwei gegenläufigen Regeln** (live geprüft):
    An der **ORDER_LINE** ist `line.price` der **Streichpreis** und der
    `PRICE`-Decorator (`display_price`) der tatsächlich gezahlte Preis, dazu
    ein `PROMO`-Decorator mit Beschriftung. Auf der **Katalogseite** ist es
    umgekehrt: `displayPrice` ist der **rabattierte** Preis, der Streichpreis
    steckt ausschließlich als PML-Knoten `{ type: "PRICE", isCrossed: true }`
    in der rohen `getProductDetailsPage()`. Wer eine Regel auf die andere
    Quelle anwendet, verbucht den Rabatt als Aufschlag. Deshalb liegen sie in
    `picnic/price.ts` als **zwei getrennte Funktionen** nebeneinander.
    Weiteres: `getProductDetails()` kennt den Streichpreis gar nicht (nur ein
    `promotion.label`), `search()` liefert **leere** `decorators` und ist für
    Rabatte unbrauchbar, und `ORDER_ARTICLE.price` ist ein Sentinel-Müllwert
    (`432199`) — der echte Preis steht an der Line. `line.price` ist zudem der
    **Zeilen**-Gesamtpreis, nicht der Stückpreis.
```

- [ ] **Schritt 6: Committen**

```bash
npm run check && npm test
git add src/lib/server/picnic/price.ts src/lib/server/picnic/price.test.ts CLAUDE.md
git commit -m "Deute Picnic-Preise und -Rabatte in einem reinen Modul"
```

---

## Task 2: `fullPackages` in `units.ts`

Die Rezept-Kalkulation braucht neben „was fehlt noch" auch „wie viele Gebinde wären es ohne jeden Vorrat". Additiv, damit bestehende Aufrufer unberührt bleiben.

**Files:**
- Modify: `src/lib/units.ts:29-38` (Typ `CoverageResult`), `src/lib/units.ts:100-134` (`coverageMulti`)
- Modify: `src/lib/units.test.ts`

**Interfaces:**
- Consumes: nichts.
- Produces: `CoverageResult.fullPackages: number` — benötigte Gebinde bei Bestand 0, gerundet mit demselben `sizingArticle` wie `neededPackages`.

- [ ] **Schritt 1: Test schreiben**

An `src/lib/units.test.ts` anhängen:

```ts
describe('coverageMulti — fullPackages', () => {
	const artikel = [
		{ id: 1, packageAmount: 500, packageUnit: 'g', stockPackages: 0, picnicId: 'p1' }
	];

	it('rechnet ohne Vorrat wie neededPackages', () => {
		const cov = coverageMulti(1200, 'g', artikel);
		expect(cov.neededPackages).toBe(3);
		expect(cov.fullPackages).toBe(3);
	});

	// Der eigentliche Zweck: „was kostet das Gericht" ignoriert den Vorrat,
	// „was muss ich kaufen" nicht.
	it('ignoriert vorhandenen Bestand', () => {
		const cov = coverageMulti(1200, 'g', [{ ...artikel[0], stockPackages: 2 }]);
		expect(cov.neededPackages).toBe(1);
		expect(cov.fullPackages).toBe(3);
	});

	it('bleibt auch bei voll gedecktem Bedarf gefüllt', () => {
		const cov = coverageMulti(400, 'g', [{ ...artikel[0], stockPackages: 5 }]);
		expect(cov.covered).toBe(true);
		expect(cov.neededPackages).toBe(0);
		expect(cov.fullPackages).toBe(1);
	});

	it('ist 0, wenn die Einheiten nicht vergleichbar sind', () => {
		expect(coverageMulti(2, 'l', artikel).fullPackages).toBe(0);
	});
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run src/lib/units.test.ts
```

Erwartet: FAIL — `fullPackages` ist `undefined`.

- [ ] **Schritt 3: Implementieren**

In `src/lib/units.ts` den Typ ergänzen:

```ts
export type CoverageResult = {
	/** Reicht der Vorrat für den (skalierten) Bedarf? */
	covered: boolean;
	/** Konnten Bedarf und Vorrat überhaupt verglichen werden (kompatible Einheiten)? */
	comparable: boolean;
	/** Noch benötigte Gebinde (auf ganze Packungen aufgerundet), 0 wenn gedeckt. */
	neededPackages: number;
	/**
	 * Benötigte Gebinde **ohne jeden Vorrat** — für die Frage „was kostet
	 * dieses Gericht", die den Lagerbestand bewusst ausblendet. Gleiche
	 * Rundung und derselbe Gebinde-Artikel wie bei `neededPackages`.
	 */
	fullPackages: number;
	/** Picnic-Artikel für die fehlende Menge (erster kompatibler Alternativartikel mit Picnic-Verknüpfung). */
	orderPicnicId: string | null;
};
```

`coverageMulti` anpassen — die drei `return`-Zweige:

```ts
export function coverageMulti(
	requiredAmount: number,
	requiredUnit: string | null,
	articles: IngredientArticleStock[]
): CoverageResult {
	const requiredBase = toBase(requiredAmount, requiredUnit);
	const requiredFamily = unitFamily(requiredUnit);
	if (requiredBase == null || requiredFamily == null) {
		return { covered: false, comparable: false, neededPackages: 0, fullPackages: 0, orderPicnicId: null };
	}

	const { referenceArticle, orderArticle, availableBase, comparable } = pickOrderArticle(
		articles,
		requiredFamily
	);

	if (!comparable || !referenceArticle) {
		return { covered: false, comparable: false, neededPackages: 0, fullPackages: 0, orderPicnicId: null };
	}

	// Gebindegröße für die Rundung: bevorzugt der bestellbare Artikel (damit die
	// Warenkorb-Menge stimmt), sonst der erste kompatible Artikel (nur Anzeige).
	const sizingArticle = orderArticle ?? referenceArticle;
	const sizingPackageBase = toBase(sizingArticle.packageAmount!, sizingArticle.packageUnit)!;
	const fullPackages = Math.ceil(requiredBase / sizingPackageBase);

	const missingBase = requiredBase - availableBase;
	if (missingBase <= 0) {
		return {
			covered: true,
			comparable: true,
			neededPackages: 0,
			fullPackages,
			orderPicnicId: orderArticle?.picnicId ?? null
		};
	}
	return {
		covered: false,
		comparable: true,
		neededPackages: Math.ceil(missingBase / sizingPackageBase),
		fullPackages,
		orderPicnicId: orderArticle?.picnicId ?? null
	};
}
```

- [ ] **Schritt 4: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run src/lib/units.test.ts && npm run check
```

Erwartet: PASS. `npm run check` muss sauber sein — der neue Pflichtschlüssel im Typ bricht sonst bestehende Aufrufer.

- [ ] **Schritt 5: Committen**

```bash
git add src/lib/units.ts src/lib/units.test.ts
git commit -m "Ergänze Gebindebedarf ohne Vorrat in der Deckungsrechnung"
```

---

## Task 3: Tabelle `picnic_prices`

**Files:**
- Modify: `src/lib/server/db/schema.ts` (ans Dateiende)
- Create: `drizzle/00XX_*.sql` (generiert)

**Interfaces:**
- Consumes: nichts.
- Produces: `picnicPrices` mit Spalten `picnicId: string` (PK), `regularPrice: number`, `promoPrice: number | null`, `promoLabel: string | null`, `fetchedAt: Date`.

- [ ] **Schritt 1: Schema ergänzen**

Ans Ende von `src/lib/server/db/schema.ts`:

```ts
/**
 * Preis-Cache je Picnic-Produkt.
 *
 * Bewusst eine **eigene Tabelle** statt Spalten an `articles`: Ein
 * Preis-Refresh würde sonst `updated_at`/`updated_by` des Artikels
 * umschreiben und die Audit-Spur entwerten („wer hat den Artikel geändert?"
 * → „der Preis-Refresh").
 *
 * Aus demselben Grund trägt die Tabelle als einzige **keine Audit-Felder**:
 * Sie ist ein reiner Maschinen-Cache, kein Anwender editiert sie —
 * `fetched_at` *ist* hier die Audit-Information.
 *
 * Schlüssel ist die **Picnic-ID**, nicht die Artikel-ID: Ein Abruf bedient
 * damit alle Artikel, die auf dasselbe Produkt zeigen, und der Eintrag
 * überlebt das Löschen eines Artikels.
 *
 * Zur Semantik siehe `picnic/price.ts`: `regular_price` ist der Normalpreis
 * (Streichpreis), `promo_price` der rabattierte Preis. Ersparnis =
 * `regular_price − promo_price`.
 */
export const picnicPrices = sqliteTable('picnic_prices', {
	picnicId: text('picnic_id').primaryKey(),
	regularPrice: integer('regular_price').notNull(),
	promoPrice: integer('promo_price'),
	promoLabel: text('promo_label'),
	fetchedAt: integer('fetched_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});
```

- [ ] **Schritt 2: Migration erzeugen**

```bash
npm run db:generate
```

- [ ] **Schritt 3: Migration prüfen**

Die erzeugte `drizzle/00XX_*.sql` öffnen und bestätigen, dass sie ein `CREATE TABLE picnic_prices` enthält. **Kein** Handanpassen nötig: Der `unixepoch()`-Fallstrick aus `CLAUDE.md` betrifft nur `ALTER TABLE ADD COLUMN`, nicht `CREATE TABLE`.

- [ ] **Schritt 4: Anwendung starten, Migration greifen lassen**

```bash
npm run check
```

Danach den Dev-Server einmal starten (`db/index.ts` wendet Migrationen beim Start an) und im Log auf Fehler prüfen.

- [ ] **Schritt 5: Committen**

```bash
git add src/lib/server/db/schema.ts drizzle/
git commit -m "Lege Preis-Cache je Picnic-Produkt an"
```

---

## Task 4: `getProductPrices()` im Picnic-Adapter

**Files:**
- Modify: `src/lib/server/picnic/index.ts`

**Interfaces:**
- Consumes: `ProductPrice`, `crossedOutPrice` aus Task 1.
- Produces: `getProductPrices(ids: string[]): Promise<Map<string, ProductPrice>>`, Re-Export von `ProductPrice`.

- [ ] **Schritt 1: Implementieren**

In `src/lib/server/picnic/index.ts` den Import ergänzen:

```ts
import { crossedOutPrice, lineSavings, type ProductPrice } from './price';
```

Und den Re-Export bei den übrigen erweitern:

```ts
export type { DeliveryChecklistItem, ParsedPicnicRecipe, PicnicRecipeTile, ProductPrice };
```

`lineSavings` wird **nicht** re-exportiert: Einziger Verbraucher ist
`checklist.ts` innerhalb desselben Ordners (Task 12), das importiert direkt
aus `./price`.

Ans Dateiende:

```ts
/**
 * Preis je Produkt-ID. Es gibt **keinen Bulk-Lookup** — ein Call pro Produkt,
 * deshalb ist die Menge vom Aufrufer zu deckeln (siehe `server/prices.ts`).
 *
 * Zwei Stufen, um Aufrufe zu sparen: `getProductDetails()` liefert den
 * aktuellen Preis und verrät über `promotion`, ob überhaupt eine Aktion läuft.
 * Nur dann wird zusätzlich die **rohe** Seite geholt — nur dort steht der
 * Streichpreis. Die meisten Produkte sind nicht im Angebot, kosten also einen
 * Call.
 */
async function fetchProductPrice(id: string): Promise<ProductPrice | null> {
	const details = await getClient().catalog.getProductDetails(id);
	const current = (details as { displayPrice?: unknown } | null)?.displayPrice;
	if (typeof current !== 'number' || current <= 0) return null;

	const promotion = (details as { promotion?: { label?: unknown } | null }).promotion;
	if (!promotion) return { regularPrice: current, promoPrice: null, promoLabel: null };

	const label = typeof promotion.label === 'string' ? promotion.label : null;
	const page = await getClient().catalog.getProductDetailsPage(id);
	const regular = crossedOutPrice(page, current);

	// Aktion gemeldet, aber kein Streichpreis auffindbar: Beschriftung
	// behalten, Ersparnis weglassen. Lieber kein Rabatt als ein erfundener.
	return regular == null
		? { regularPrice: current, promoPrice: null, promoLabel: label }
		: { regularPrice: regular, promoPrice: current, promoLabel: label };
}

/**
 * Preise zu mehreren Produkt-IDs. Einzelne Fehlschläge werden übersprungen —
 * ein nicht mehr existierendes Produkt darf nicht die ganze Seite kippen.
 */
export async function getProductPrices(ids: string[]): Promise<Map<string, ProductPrice>> {
	await ensureLoggedIn();
	const prices = new Map<string, ProductPrice>();
	const results = await Promise.allSettled(ids.map((id) => fetchProductPrice(id)));
	results.forEach((result, index) => {
		if (result.status === 'fulfilled' && result.value) prices.set(ids[index], result.value);
	});
	return prices;
}
```

- [ ] **Schritt 2: Typecheck**

```bash
npm run check
```

Erwartet: sauber.

- [ ] **Schritt 3: Gegen die echte API prüfen**

Dev-Server starten, anmelden, Picnic verbinden. Dann in einer Node-Konsole **im Projektverzeichnis** — oder einfacher: nach Task 8 auf `/bestellen` prüfen. Bis dahin genügt der Typecheck; der echte Abruf wird in Task 8 verifiziert.

- [ ] **Schritt 4: Committen**

```bash
npm run check && npm test
git add src/lib/server/picnic/index.ts
git commit -m "Hole Produktpreise samt Streichpreis von Picnic"
```

---

## Task 5: Preis-Cache `server/prices.ts`

**Files:**
- Create: `src/lib/server/prices.ts`

**Interfaces:**
- Consumes: `picnicPrices` (Task 3), `getProductPrices` (Task 4), `getConnectionState` (bestehend).
- Produces:
  - `type CachedPrice = { regularPrice: number; promoPrice: number | null; promoLabel: string | null; fetchedAt: Date }`
  - `pricesFor(picnicIds: string[]): Map<string, CachedPrice>`
  - `refreshPrices(picnicIds: string[], options?: { maxAgeMs?: number; limit?: number }): Promise<{ updated: number; failed: number }>`
  - `savingsOf(price: { regularPrice: number; promoPrice: number | null }): number`
  - `effectivePrice(price: { regularPrice: number; promoPrice: number | null }): number`

- [ ] **Schritt 1: Implementieren**

`src/lib/server/prices.ts`:

```ts
/**
 * Preis-Cache: lesen und bedarfsgesteuert auffrischen.
 *
 * Picnic kennt keinen Bulk-Lookup (ein Call pro Produkt), ein Live-Abruf beim
 * Rendern scheidet damit aus. Der Cache ist deshalb keine Optimierung,
 * sondern Voraussetzung.
 */
import { db } from '$lib/server/db';
import { picnicPrices } from '$lib/server/db/schema';
import { getConnectionState, getProductPrices } from '$lib/server/picnic';
import { inArray } from 'drizzle-orm';

export type CachedPrice = {
	regularPrice: number;
	promoPrice: number | null;
	promoLabel: string | null;
	fetchedAt: Date;
};

/** Preise gelten einen Tag als frisch — Picnic-Aktionen laufen tageweise. */
export const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/**
 * Obergrenze je Auffrischung. Ohne Deckel zöge eine Rezeptseite mit vielen
 * Alternativartikeln dutzende Calls und die Seite stünde spürbar.
 */
export const DEFAULT_REFRESH_LIMIT = 20;

/** Tatsächlich zu zahlender Preis in Cent. */
export function effectivePrice(price: { regularPrice: number; promoPrice: number | null }): number {
	return price.promoPrice ?? price.regularPrice;
}

/** Ersparnis in Cent; 0 ohne Rabatt. */
export function savingsOf(price: { regularPrice: number; promoPrice: number | null }): number {
	return price.promoPrice == null ? 0 : Math.max(0, price.regularPrice - price.promoPrice);
}

/** Gecachte Preise zu den gefragten IDs. Fehlende fehlen einfach in der Map. */
export function pricesFor(picnicIds: string[]): Map<string, CachedPrice> {
	const ids = [...new Set(picnicIds.filter(Boolean))];
	if (ids.length === 0) return new Map();

	const rows = db.select().from(picnicPrices).where(inArray(picnicPrices.picnicId, ids)).all();
	return new Map(
		rows.map((row) => [
			row.picnicId,
			{
				regularPrice: row.regularPrice,
				promoPrice: row.promoPrice,
				promoLabel: row.promoLabel,
				fetchedAt: row.fetchedAt
			}
		])
	);
}

/**
 * Frischt veraltete und fehlende Preise auf. Älteste zuerst, gedeckelt — über
 * mehrere Seitenaufrufe wird so alles nachgezogen, ohne dass ein einzelner
 * spürbar hängt.
 *
 * Ohne Picnic-Verbindung passiert stillschweigend nichts: Die Seite zeigt dann
 * die vorhandenen Cache-Werte, was allemal besser ist als ein Fehler.
 */
export async function refreshPrices(
	picnicIds: string[],
	options: { maxAgeMs?: number; limit?: number } = {}
): Promise<{ updated: number; failed: number }> {
	if (getConnectionState() !== 'connected') return { updated: 0, failed: 0 };

	const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
	const limit = options.limit ?? DEFAULT_REFRESH_LIMIT;
	const ids = [...new Set(picnicIds.filter(Boolean))];
	if (ids.length === 0) return { updated: 0, failed: 0 };

	const cached = pricesFor(ids);
	const threshold = Date.now() - maxAgeMs;
	const stale = ids
		.map((id) => ({ id, fetchedAt: cached.get(id)?.fetchedAt?.getTime() ?? 0 }))
		.filter((entry) => entry.fetchedAt < threshold)
		.sort((a, b) => a.fetchedAt - b.fetchedAt) // nie abgerufene (0) zuerst
		.slice(0, limit)
		.map((entry) => entry.id);

	if (stale.length === 0) return { updated: 0, failed: 0 };

	let fetched: Map<string, { regularPrice: number; promoPrice: number | null; promoLabel: string | null }>;
	try {
		fetched = await getProductPrices(stale);
	} catch {
		// Verbindung weggebrochen o.ä. — Cache bleibt, wie er ist
		return { updated: 0, failed: stale.length };
	}

	const now = new Date();
	for (const [picnicId, price] of fetched) {
		db.insert(picnicPrices)
			.values({ picnicId, ...price, fetchedAt: now })
			.onConflictDoUpdate({
				target: picnicPrices.picnicId,
				set: { ...price, fetchedAt: now }
			})
			.run();
	}

	return { updated: fetched.size, failed: stale.length - fetched.size };
}
```

- [ ] **Schritt 2: Typecheck**

```bash
npm run check
```

- [ ] **Schritt 3: Committen**

```bash
npm run check && npm test
git add src/lib/server/prices.ts
git commit -m "Cache Picnic-Preise mit gedeckelter Auffrischung"
```

---

## Task 6: Rezept-Kostenrechnung `lib/recipeCost.ts`

Reines Modul mit Test — laut `CLAUDE.md` gehört neue Rechenlogik genau hierhin und nicht in eine Route.

**Files:**
- Create: `src/lib/recipeCost.ts`
- Create: `src/lib/recipeCost.test.ts`

**Interfaces:**
- Consumes: `coverageMulti`, `scaleAmount`, `IngredientArticleStock` aus `$lib/units` (inkl. `fullPackages` aus Task 2).
- Produces:
  - `type CostBlock = { total: number; savings: number; perPortion: number; complete: boolean; unpriced: string[] }`
  - `type CostPrice = { regularPrice: number; promoPrice: number | null }`
  - `type CostIngredient = { amount: number | null; unit: string | null; freeText: string | null; articles: (IngredientArticleStock & { name: string })[] }`
  - `recipeCost(input: { ingredients: CostIngredient[]; baseServings: number; portions: number; prices: Map<string, CostPrice> }): { toOrder: CostBlock; all: CostBlock }`

- [ ] **Schritt 1: Test schreiben**

`src/lib/recipeCost.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { recipeCost, type CostIngredient, type CostPrice } from './recipeCost';

function artikel(name: string, picnicId: string | null, packageAmount: number, stockPackages = 0) {
	return { id: 1, name, packageAmount, packageUnit: 'g', picnicId, stockPackages };
}

function zutat(amount: number, articles: CostIngredient['articles']): CostIngredient {
	return { amount, unit: 'g', freeText: null, articles };
}

const preise = (entries: [string, CostPrice][]) => new Map<string, CostPrice>(entries);

describe('recipeCost', () => {
	it('rechnet Gebinde mal Preis, ohne Vorrat identisch in beiden Blöcken', () => {
		const result = recipeCost({
			ingredients: [zutat(1000, [artikel('Mehl', 'p1', 500)])],
			baseServings: 2,
			portions: 2,
			prices: preise([['p1', { regularPrice: 199, promoPrice: null }]])
		});
		expect(result.all.total).toBe(398); // 2 Gebinde à 1,99 €
		expect(result.toOrder.total).toBe(398);
		expect(result.all.perPortion).toBe(199);
	});

	// Der Kern der Trennung: Vorrat senkt „zu bestellen", nicht „alle Zutaten".
	it('blendet den Vorrat nur im all-Block aus', () => {
		const result = recipeCost({
			ingredients: [zutat(1000, [artikel('Mehl', 'p1', 500, 1)])],
			baseServings: 2,
			portions: 2,
			prices: preise([['p1', { regularPrice: 199, promoPrice: null }]])
		});
		expect(result.toOrder.total).toBe(199); // ein Gebinde liegt da
		expect(result.all.total).toBe(398);
	});

	it('skaliert auf die gewünschten Portionen', () => {
		const result = recipeCost({
			ingredients: [zutat(500, [artikel('Mehl', 'p1', 500)])],
			baseServings: 2,
			portions: 6, // 1500 g -> 3 Gebinde
			prices: preise([['p1', { regularPrice: 100, promoPrice: null }]])
		});
		expect(result.all.total).toBe(300);
		expect(result.all.perPortion).toBe(50);
	});

	it('weist die Ersparnis aus und rechnet mit dem Aktionspreis', () => {
		const result = recipeCost({
			ingredients: [zutat(1000, [artikel('Öl', 'p1', 500)])],
			baseServings: 1,
			portions: 1,
			prices: preise([['p1', { regularPrice: 449, promoPrice: 349 }]])
		});
		expect(result.all.total).toBe(698); // 2 x 3,49 €
		expect(result.all.savings).toBe(200); // 2 x 1,00 €
	});

	// „Untergrenze statt stiller Null": eine Zutat ohne Preis darf die Summe
	// nicht vollständig aussehen lassen.
	it('meldet fehlende Preise als unvollständig', () => {
		const result = recipeCost({
			ingredients: [
				zutat(500, [artikel('Mehl', 'p1', 500)]),
				zutat(500, [artikel('Hefe', 'p2', 500)])
			],
			baseServings: 1,
			portions: 1,
			prices: preise([['p1', { regularPrice: 100, promoPrice: null }]])
		});
		expect(result.all.total).toBe(100);
		expect(result.all.complete).toBe(false);
		expect(result.all.unpriced).toEqual(['Hefe']);
	});

	// Die beiden Blöcke können unterschiedlich vollständig sein.
	it('lässt eine gedeckte preislose Zutat den toOrder-Block nicht trüben', () => {
		const result = recipeCost({
			ingredients: [zutat(500, [artikel('Salz', 'p9', 500, 10)])],
			baseServings: 1,
			portions: 1,
			prices: new Map()
		});
		expect(result.toOrder.complete).toBe(true); // es ist nichts zu kaufen
		expect(result.toOrder.total).toBe(0);
		expect(result.all.complete).toBe(false); // gekauft werden müsste es aber
	});

	it('überspringt Freitext-Zutaten ohne Artikel', () => {
		const result = recipeCost({
			ingredients: [{ amount: null, unit: null, freeText: 'Salz nach Gefühl', articles: [] }],
			baseServings: 1,
			portions: 1,
			prices: new Map()
		});
		expect(result.all.complete).toBe(true);
		expect(result.all.total).toBe(0);
	});

	it('meldet nicht vergleichbare Einheiten als unvollständig', () => {
		const result = recipeCost({
			ingredients: [{ amount: 2, unit: 'l', freeText: null, articles: [artikel('Mehl', 'p1', 500)] }],
			baseServings: 1,
			portions: 1,
			prices: preise([['p1', { regularPrice: 100, promoPrice: null }]])
		});
		expect(result.all.complete).toBe(false);
		expect(result.all.unpriced).toEqual(['Mehl']);
	});

	it('verkraftet 0 Portionen ohne Division durch null', () => {
		const result = recipeCost({
			ingredients: [zutat(500, [artikel('Mehl', 'p1', 500)])],
			baseServings: 2,
			portions: 0,
			prices: preise([['p1', { regularPrice: 100, promoPrice: null }]])
		});
		expect(Number.isFinite(result.all.perPortion)).toBe(true);
		expect(result.all.perPortion).toBe(0);
	});
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run src/lib/recipeCost.test.ts
```

Erwartet: FAIL — `Failed to resolve import "./recipeCost"`.

- [ ] **Schritt 3: Implementieren**

`src/lib/recipeCost.ts`:

```ts
/**
 * Was kostet ein Rezept — reine Rechnung, client- und servertauglich.
 *
 * Zwei Sichten, die bewusst getrennt bleiben:
 *   - `toOrder`: nur was der Vorrat nicht deckt („was muss ich kaufen")
 *   - `all`:     alle Zutaten, als wäre nichts da („was kostet das Gericht")
 *
 * Gerechnet wird auf **ganze Gebinde** — man kauft keine halbe Packung. Der
 * Preis pro Portion ist deshalb die Gebindesumme geteilt durch die Portionen
 * und springt bei kleinen Portionszahlen; das ist die ehrliche Zahl für
 * „was kostet mich das heute".
 */
import { coverageMulti, scaleAmount, type IngredientArticleStock } from '$lib/units';

export type CostPrice = { regularPrice: number; promoPrice: number | null };

export type CostArticle = IngredientArticleStock & { name: string };

export type CostIngredient = {
	amount: number | null;
	unit: string | null;
	freeText: string | null;
	articles: CostArticle[];
};

export type CostBlock = {
	/** Tatsächlich zu zahlen, in Cent (Aktionspreis, wo vorhanden). */
	total: number;
	/** Ersparnis gegenüber den Normalpreisen, in Cent. */
	savings: number;
	/** `total` je Portion, **ungerundet** — gerundet wird nur in der Anzeige. */
	perPortion: number;
	/** `false` = die Summe ist eine Untergrenze, es fehlen Preise. */
	complete: boolean;
	/** Zutaten, für die kein Preis ermittelbar war. */
	unpriced: string[];
};

type Accumulator = { total: number; savings: number; unpriced: string[] };

function emptyAccumulator(): Accumulator {
	return { total: 0, savings: 0, unpriced: [] };
}

function add(accumulator: Accumulator, price: CostPrice, packages: number): void {
	const effective = price.promoPrice ?? price.regularPrice;
	accumulator.total += effective * packages;
	if (price.promoPrice != null) {
		accumulator.savings += Math.max(0, price.regularPrice - price.promoPrice) * packages;
	}
}

function toBlock(accumulator: Accumulator, portions: number): CostBlock {
	return {
		total: accumulator.total,
		savings: accumulator.savings,
		perPortion: portions > 0 ? accumulator.total / portions : 0,
		complete: accumulator.unpriced.length === 0,
		unpriced: accumulator.unpriced
	};
}

export function recipeCost(input: {
	ingredients: CostIngredient[];
	baseServings: number;
	portions: number;
	prices: Map<string, CostPrice>;
}): { toOrder: CostBlock; all: CostBlock } {
	const { ingredients, baseServings, portions, prices } = input;
	const toOrder = emptyAccumulator();
	const all = emptyAccumulator();

	for (const ingredient of ingredients) {
		// Freitext-Zutaten („Salz nach Gefühl") tragen nichts bei und fehlen
		// auch nicht — sie sind gar nicht bestellbar gemeint.
		if (ingredient.articles.length === 0 || ingredient.amount == null) continue;

		const label = ingredient.articles.map((a) => a.name).join(' / ');
		const scaled = scaleAmount(ingredient.amount, baseServings, portions) ?? 0;
		const coverage = coverageMulti(scaled, ingredient.unit, ingredient.articles);

		// Ohne vergleichbare Einheit lässt sich kein Gebinde bestimmen — dann
		// ist die Zutat in beiden Sichten unbezifferbar.
		if (!coverage.comparable) {
			toOrder.unpriced.push(label);
			all.unpriced.push(label);
			continue;
		}

		const price = coverage.orderPicnicId ? prices.get(coverage.orderPicnicId) : undefined;

		// Gedeckte Zutat: in `toOrder` ist wirklich nichts zu kaufen, ein
		// fehlender Preis macht diesen Block deshalb **nicht** unvollständig.
		if (coverage.neededPackages > 0) {
			if (price) add(toOrder, price, coverage.neededPackages);
			else toOrder.unpriced.push(label);
		}

		if (coverage.fullPackages > 0) {
			if (price) add(all, price, coverage.fullPackages);
			else all.unpriced.push(label);
		}
	}

	return { toOrder: toBlock(toOrder, portions), all: toBlock(all, portions) };
}
```

- [ ] **Schritt 4: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run src/lib/recipeCost.test.ts
```

Erwartet: PASS, 9 Tests.

- [ ] **Schritt 5: Committen**

```bash
npm run check && npm test
git add src/lib/recipeCost.ts src/lib/recipeCost.test.ts
git commit -m "Berechne Rezeptkosten je Portion mit und ohne Vorrat"
```

---

## Task 7: Portionsvorgabe als Naht

Winziges Modul, dessen einziger Zweck es ist, die spätere Admin-Einstellung billig zu machen: Dann ändert sich nur die Implementierung, kein Aufrufer.

**Files:**
- Create: `src/lib/server/settings.ts`

**Interfaces:**
- Consumes: nichts.
- Produces: `defaultPortions(): number`

- [ ] **Schritt 1: Implementieren**

`src/lib/server/settings.ts`:

```ts
/**
 * App-weite Vorgaben.
 *
 * Bewusst als Funktion und nicht als Konstante: Die Portionsvorgabe soll
 * später von Admins in der App einstellbar sein (eigener Schritt, braucht
 * Tabelle und Oberfläche). Dann ändert sich ausschließlich der Rumpf hier —
 * alle Aufrufer bleiben, wie sie sind.
 */

/** Vorbelegte Portionszahl auf der Rezeptseite. */
export function defaultPortions(): number {
	return 3;
}
```

- [ ] **Schritt 2: Typecheck und committen**

```bash
npm run check
git add src/lib/server/settings.ts
git commit -m "Führe Portionsvorgabe als eigene Funktion ein"
```

---

## Task 8: Preise und Ersparnis im Bestellvorschlag

**Files:**
- Modify: `src/routes/bestellen/+page.server.ts`
- Modify: `src/routes/bestellen/+page.svelte`
- Modify: `src/lib/i18n/messages/en.ts`, `de.ts`, `nl.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `pricesFor`, `refreshPrices`, `effectivePrice`, `savingsOf` (Task 5); `formatPrice` aus `$lib/format`.
- Produces: `data.suggestions[].price: { regularPrice, promoPrice, promoLabel } | null`, `data.totals: { total: number; savings: number }`.

- [ ] **Schritt 1: i18n-Schlüssel ergänzen**

In `src/lib/i18n/messages/en.ts` bei den `order.*`-Schlüsseln:

```ts
	'order.price': 'Price',
	'order.saving': 'You save {amount}',
	'order.total': 'Total',
	'order.totalSavings': 'Savings included: {amount}',
	'order.noPrice': 'No price known',
	'order.refreshPrices': 'Refresh prices',
	'order.pricesRefreshed': '{n} prices updated',
	'order.pricesStale': 'Prices from {date}',
```

Dieselben Schlüssel mit deutschen bzw. niederländischen Texten in `de.ts` und `nl.ts`. Beispiel `de.ts`:

```ts
	'order.price': 'Preis',
	'order.saving': 'Du sparst {amount}',
	'order.total': 'Summe',
	'order.totalSavings': 'Darin enthalten: {amount} gespart',
	'order.noPrice': 'Kein Preis bekannt',
	'order.refreshPrices': 'Preise aktualisieren',
	'order.pricesRefreshed': '{n} Preise aktualisiert',
	'order.pricesStale': 'Preise vom {date}',
```

Und `nl.ts`:

```ts
	'order.price': 'Prijs',
	'order.saving': 'Je bespaart {amount}',
	'order.total': 'Totaal',
	'order.totalSavings': 'Daarvan bespaard: {amount}',
	'order.noPrice': 'Geen prijs bekend',
	'order.refreshPrices': 'Prijzen bijwerken',
	'order.pricesRefreshed': '{n} prijzen bijgewerkt',
	'order.pricesStale': 'Prijzen van {date}',
```

- [ ] **Schritt 2: Typecheck — beweist die Vollständigkeit der Wörterbücher**

```bash
npm run check
```

Erwartet: sauber. Fehlt ein Schlüssel in `de`/`nl`, bricht der Check — genau dafür sind sie typisiert.

- [ ] **Schritt 3: `load` erweitern**

In `src/routes/bestellen/+page.server.ts` die Importe ergänzen:

```ts
import { effectivePrice, pricesFor, refreshPrices, savingsOf } from '$lib/server/prices';
```

Am Ende von `load`, **vor** dem `return`:

```ts
	// Preise: veraltete gedeckelt nachziehen, dann aus dem Cache lesen. Die
	// Vorschlagsliste ist kurz, deshalb ist das hier vertretbar.
	const picnicIds = suggestions.map((s) => s.picnicId).filter((id): id is string => Boolean(id));
	await refreshPrices(picnicIds);
	const prices = pricesFor(picnicIds);

	const priced = suggestions.map((s) => ({
		...s,
		price: s.picnicId ? (prices.get(s.picnicId) ?? null) : null
	}));

	// Summen über die vorgeschlagenen Mengen — was der Warenkorb kosten würde
	const totals = priced.reduce(
		(acc, s) => {
			if (!s.price) return acc;
			acc.total += effectivePrice(s.price) * s.needed;
			acc.savings += savingsOf(s.price) * s.needed;
			return acc;
		},
		{ total: 0, savings: 0 }
	);

	return { suggestions: priced, covered, connection, cartUnavailable, openOrdersUnavailable, totals };
```

Das bisherige `return { suggestions, ... }` entfällt.

- [ ] **Schritt 4: Refresh-Action ergänzen**

In `src/routes/bestellen/+page.server.ts` bei den `actions`:

```ts
	// Alle verknüpften Artikel auffrischen — bewusst ohne Altersgrenze und mit
	// hohem Deckel: Wer hier klickt, will aktuelle Preise und nimmt die
	// Wartezeit in Kauf.
	refreshPrices: async () => {
		const ids = db
			.select({ picnicId: articles.picnicId })
			.from(articles)
			.all()
			.map((row) => row.picnicId)
			.filter((id): id is string => Boolean(id));
		const { updated } = await refreshPrices(ids, { maxAgeMs: 0, limit: 200 });
		return { pricesRefreshed: updated };
	},
```

- [ ] **Schritt 5: Oberfläche ergänzen**

In `src/routes/bestellen/+page.svelte`:

```svelte
<script lang="ts">
	import { formatPrice } from '$lib/format';
	// …bestehende Importe
</script>
```

Je Vorschlagszeile, neben Name und Menge:

```svelte
{#if suggestion.price}
	<span class="text-sm text-gray-700">
		{formatPrice((suggestion.price.promoPrice ?? suggestion.price.regularPrice) * suggestion.needed, data.locale)}
	</span>
	{#if suggestion.price.promoPrice !== null}
		<span class="rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">
			−{formatPrice((suggestion.price.regularPrice - suggestion.price.promoPrice) * suggestion.needed, data.locale)}
		</span>
	{/if}
{:else}
	<span class="text-sm text-gray-400">{t('order.noPrice')}</span>
{/if}
```

Unter der Liste die Summe:

```svelte
<div class="flex flex-wrap items-baseline justify-between gap-2 border-t border-gray-200 pt-3">
	<span class="font-medium text-gray-700">{t('order.total')}</span>
	<span class="text-lg font-semibold">{formatPrice(data.totals.total, data.locale)}</span>
</div>
{#if data.totals.savings > 0}
	<p class="text-sm text-green-700">
		{t('order.totalSavings', { amount: formatPrice(data.totals.savings, data.locale) })}
	</p>
{/if}
```

Und im Kopfbereich der Refresh-Button — der äußere Container muss `flex-wrap` haben und die Gruppe **kein** `shrink-0`:

```svelte
<form method="POST" action="?/refreshPrices" use:enhance={keepValues}>
	<button type="submit" class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
		{t('order.refreshPrices')}
	</button>
</form>
```

- [ ] **Schritt 6: Im Browser prüfen**

Dev-Server starten, mit `admin` + `ADMIN_PASSWORD` aus der `.env` anmelden (Benutzername wird **exakt** verglichen), Picnic verbinden, `/bestellen` öffnen.

Prüfen:
- Preise erscheinen bei verknüpften Artikeln, „Kein Preis bekannt" bei unverknüpften.
- Ein Artikel im Angebot zeigt das grüne Ersparnis-Badge. **Zum Prüfzeitpunkt war `s1021273` (Mazola Rapsöl) im Angebot** — falls die Aktion abgelaufen ist, einen aktuell rabattierten Artikel im Picnic-Katalog suchen.
- Refresh-Button läuft durch und meldet eine Zahl.
- Bei 375px Breite ragt nichts über den Rand.
- Dark Mode: die neuen `bg-green-50`/`text-green-700` haben Overrides in `layout.css` — nachsehen und im dunklen Modus gegenprüfen.

- [ ] **Schritt 7: CHANGELOG und committen**

Unter `## [Unveröffentlicht]` → `### Hinzugefügt`:

```markdown
- Bestellvorschlag zeigt Preise je Artikel, laufende Picnic-Angebote mit
  Ersparnis in Euro sowie Summe und Gesamtersparnis. Preise werden
  zwischengespeichert und lassen sich per Knopfdruck auffrischen.
```

```bash
npm run check && npm test
git add src/routes/bestellen src/lib/i18n/messages CHANGELOG.md
git commit -m "Zeige Preise und Ersparnis im Bestellvorschlag"
```

---

## Task 9: Kostenblöcke auf der Rezeptseite

**Files:**
- Modify: `src/routes/rezepte/[id]/+page.server.ts`
- Modify: `src/routes/rezepte/[id]/+page.svelte:13` (Portionen-Startwert)
- Modify: `src/lib/i18n/messages/en.ts`, `de.ts`, `nl.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `recipeCost` (Task 6), `pricesFor`/`refreshPrices` (Task 5), `defaultPortions` (Task 7), `getRecipeIngredients` (bestehend).
- Produces: `data.defaultPortions: number`, `data.prices: [string, CostPrice][]` (als Array serialisierbar), Kostenberechnung im Client bei Portionswechsel.

**Wichtig:** Die Kosten werden **im Client** gerechnet, damit der Portionsregler ohne Serverrunde reagiert. `recipeCost` ist genau dafür ein reines Modul in `$lib` (nicht `$lib/server`). Der Server liefert nur die Preis-Map.

- [ ] **Schritt 1: i18n-Schlüssel ergänzen**

`en.ts` bei den `recipe.*`-Schlüsseln:

```ts
	'recipe.costToOrder': 'To buy',
	'recipe.costAll': 'All ingredients',
	'recipe.costTotal': 'Total',
	'recipe.costPerPortion': 'Per serving',
	'recipe.costSaving': 'incl. {amount} saved',
	'recipe.costFrom': 'from {amount}',
	'recipe.costIncomplete': 'No price for: {names}',
```

`de.ts`:

```ts
	'recipe.costToOrder': 'Zu kaufen',
	'recipe.costAll': 'Alle Zutaten',
	'recipe.costTotal': 'Gesamt',
	'recipe.costPerPortion': 'Pro Portion',
	'recipe.costSaving': 'davon {amount} gespart',
	'recipe.costFrom': 'ab {amount}',
	'recipe.costIncomplete': 'Kein Preis für: {names}',
```

`nl.ts`:

```ts
	'recipe.costToOrder': 'Te kopen',
	'recipe.costAll': 'Alle ingrediënten',
	'recipe.costTotal': 'Totaal',
	'recipe.costPerPortion': 'Per portie',
	'recipe.costSaving': 'waarvan {amount} bespaard',
	'recipe.costFrom': 'vanaf {amount}',
	'recipe.costIncomplete': 'Geen prijs voor: {names}',
```

- [ ] **Schritt 2: `load` erweitern**

In `src/routes/rezepte/[id]/+page.server.ts`:

```ts
import { defaultPortions } from '$lib/server/settings';
import { pricesFor, refreshPrices } from '$lib/server/prices';
```

`load` wird `async` und liefert die Preise mit:

```ts
export const load: PageServerLoad = async ({ params, locals }) => {
	const t = translator(locals.locale);
	const recipe = loadRecipeOr404(params.id, t);
	const ingredients = getRecipeIngredients(recipe.id);

	// Alle Picnic-IDs aller Alternativartikel — welcher am Ende zählt,
	// entscheidet coverageMulti erst bei der Portionswahl im Client.
	const picnicIds = ingredients
		.flatMap((ing) => ing.articles.map((a) => a.picnicId))
		.filter((id): id is string => Boolean(id));
	await refreshPrices(picnicIds);

	const prices = pricesFor(picnicIds);
	return {
		recipe,
		ingredients,
		tags: tagsForRecipe(recipe.id),
		connection: getConnectionState(),
		defaultPortions: defaultPortions(),
		// Als Array, weil eine Map nicht durch die SvelteKit-Serialisierung geht
		prices: [...prices].map(([id, p]) => [id, { regularPrice: p.regularPrice, promoPrice: p.promoPrice }] as const)
	};
};
```

- [ ] **Schritt 3: Portionen-Startwert und Kostenanzeige**

In `src/routes/rezepte/[id]/+page.svelte` Zeile 13 ändern:

```svelte
	let portions = $state(data.defaultPortions);
```

Im `<script>` ergänzen:

```svelte
	import { recipeCost, type CostPrice } from '$lib/recipeCost';
	import { formatPrice } from '$lib/format';

	const priceMap = $derived(new Map<string, CostPrice>(data.prices));
	const cost = $derived(
		recipeCost({
			ingredients: data.ingredients,
			baseServings: data.recipe.servings,
			portions,
			prices: priceMap
		})
	);
```

Unter der Zutatenliste die zwei Blöcke:

```svelte
<div class="grid gap-3 sm:grid-cols-2">
	{#each [{ label: t('recipe.costToOrder'), block: cost.toOrder }, { label: t('recipe.costAll'), block: cost.all }] as entry}
		<div class="rounded-lg border border-gray-200 p-3">
			<p class="text-sm font-medium text-gray-700">{entry.label}</p>
			<p class="text-lg font-semibold">
				{entry.block.complete
					? formatPrice(entry.block.total, data.locale)
					: t('recipe.costFrom', { amount: formatPrice(entry.block.total, data.locale) })}
			</p>
			<p class="text-sm text-gray-600">
				{t('recipe.costPerPortion')}: {formatPrice(Math.round(entry.block.perPortion), data.locale)}
			</p>
			{#if entry.block.savings > 0}
				<p class="text-sm text-green-700">
					{t('recipe.costSaving', { amount: formatPrice(entry.block.savings, data.locale) })}
				</p>
			{/if}
			{#if !entry.block.complete}
				<p class="text-xs text-gray-500">
					{t('recipe.costIncomplete', { names: entry.block.unpriced.join(', ') })}
				</p>
			{/if}
		</div>
	{/each}
</div>
```

- [ ] **Schritt 4: Im Browser prüfen**

Dev-Server, ein Rezept mit verknüpften Artikeln öffnen. Prüfen:
- Portionen starten bei **3**, nicht bei der Rezept-Portionszahl.
- Beide Blöcke reagieren sofort auf +/− ohne Serverrunde.
- Ein Rezept mit teilweise vorrätigen Zutaten zeigt in „Zu kaufen" weniger als in „Alle Zutaten".
- Ein Rezept mit einer unverknüpften Zutat zeigt „ab …" und die Namensliste.
- 375px und Dark Mode.

- [ ] **Schritt 5: CHANGELOG und committen**

Unter `### Hinzugefügt`:

```markdown
- Rezepte zeigen die Kosten pro Portion und gesamt — getrennt für die noch zu
  kaufenden und für alle Zutaten —, jeweils samt Ersparnis durch laufende
  Angebote. Die Portionszahl ist mit 3 vorbelegt.
```

```bash
npm run check && npm test
git add src/routes/rezepte/\[id\] src/lib/i18n/messages CHANGELOG.md
git commit -m "Zeige Rezeptkosten je Portion samt Ersparnis"
```

---

## Task 10: Preis je Portion in der Rezeptliste

**Files:**
- Modify: `src/routes/rezepte/+page.server.ts`
- Modify: `src/routes/rezepte/+page.svelte`
- Modify: `src/lib/i18n/messages/en.ts`, `de.ts`, `nl.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `recipeCost` (Task 6), `pricesFor` (Task 5), `defaultPortions` (Task 7).
- Produces: `data.recipes[].perPortion: number | null`, `data.recipes[].pricesComplete: boolean`.

**Wichtig:** Diese Seite liest **nur den Cache**, kein `refreshPrices` — sie berührt alle Artikel aller Rezepte, ein Auto-Refresh wäre hier eine Bremse. Der `all`-Block ist bewusst die Grundlage: Ein `toOrder`-Preis schwankte mit dem Vorrat, dasselbe Rezept wäre morgen billiger als heute, ohne dass sich am Rezept etwas geändert hat.

- [ ] **Schritt 1: i18n-Schlüssel ergänzen**

`en.ts`: `'recipe.approxPerPortion': 'approx. {amount}/serving',`
`de.ts`: `'recipe.approxPerPortion': 'ca. {amount}/Portion',`
`nl.ts`: `'recipe.approxPerPortion': 'ca. {amount}/portie',`

- [ ] **Schritt 2: `load` erweitern**

In `src/routes/rezepte/+page.server.ts`:

```ts
import { recipeCost } from '$lib/recipeCost';
import { pricesFor } from '$lib/server/prices';
import { defaultPortions } from '$lib/server/settings';
```

Die `enriched`-Berechnung ersetzen — Zutaten werden ohnehin schon je Rezept geladen, wir sammeln nur zusätzlich alle Picnic-IDs und holen die Preise in **einem** Rutsch (kein N+1):

```ts
	const withIngredients = rows.map((recipe) => ({
		recipe,
		ingredients: getRecipeIngredients(recipe.id)
	}));

	// Preise gebündelt für alle Rezepte zusammen lesen — je Rezept einzeln
	// wäre ein N+1 über die halbe Artikeltabelle.
	const allPicnicIds = withIngredients
		.flatMap((entry) => entry.ingredients.flatMap((ing) => ing.articles.map((a) => a.picnicId)))
		.filter((id): id is string => Boolean(id));
	const prices = pricesFor(allPicnicIds);
	const portions = defaultPortions();

	const enriched = withIngredients.map(({ recipe, ingredients }) => {
		// Bewusst der all-Block: Kacheln sollen Rezepte vergleichbar machen,
		// ein vorratsabhängiger Preis wäre morgen ein anderer.
		const { all } = recipeCost({
			ingredients,
			baseServings: recipe.servings,
			portions,
			prices
		});
		return {
			...recipe,
			tags: tagsForRecipe(recipe.id),
			cookable: isRecipeCookable(ingredients, recipe.servings, recipe.servings),
			perPortion: all.total > 0 ? Math.round(all.perPortion) : null,
			pricesComplete: all.complete
		};
	});
```

- [ ] **Schritt 3: Kachel ergänzen**

In `src/routes/rezepte/+page.svelte` je Kachel, neben den Tags:

```svelte
{#if recipe.perPortion !== null}
	<span class="text-xs text-gray-500">
		{recipe.pricesComplete ? '' : '≥ '}{t('recipe.approxPerPortion', {
			amount: formatPrice(recipe.perPortion, data.locale)
		})}
	</span>
{/if}
```

`formatPrice` aus `$lib/format` importieren.

- [ ] **Schritt 4: Im Browser prüfen**

`/rezepte` öffnen. Prüfen:
- Rezepte mit verknüpften Artikeln zeigen einen Preis, andere nichts.
- Unvollständige Preise erscheinen mit `≥`.
- Die Seite lädt spürbar so schnell wie vorher (kein Picnic-Abruf).
- 375px und Dark Mode.

- [ ] **Schritt 5: CHANGELOG und committen**

```markdown
- Rezeptliste zeigt je Rezept den ungefähren Preis pro Portion.
```

```bash
npm run check && npm test
git add src/routes/rezepte/+page.server.ts src/routes/rezepte/+page.svelte src/lib/i18n/messages CHANGELOG.md
git commit -m "Zeige den Preis pro Portion in der Rezeptliste"
```

---

## Task 11: Summe und Ersparnis im Wochenplan

**Files:**
- Modify: `src/routes/rezepte/wochenplan/+page.server.ts`
- Modify: `src/routes/rezepte/wochenplan/+page.svelte`
- Modify: `src/lib/i18n/messages/en.ts`, `de.ts`, `nl.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `planWeekShoppingList` (bestehend, liefert `items: { productId, quantity }[]`), `pricesFor`, `effectivePrice`, `savingsOf` (Task 5).
- Produces: `data.shoppingTotals: { total: number; savings: number; complete: boolean }`.

- [ ] **Schritt 1: i18n-Schlüssel ergänzen**

`en.ts`:

```ts
	'mealPlan.listTotal': 'Shopping list total',
	'mealPlan.listSavings': 'incl. {amount} saved',
	'mealPlan.listIncomplete': 'Some items have no known price',
```

`de.ts`:

```ts
	'mealPlan.listTotal': 'Summe der Einkaufsliste',
	'mealPlan.listSavings': 'davon {amount} gespart',
	'mealPlan.listIncomplete': 'Für einige Artikel ist kein Preis bekannt',
```

`nl.ts`:

```ts
	'mealPlan.listTotal': 'Totaal boodschappenlijst',
	'mealPlan.listSavings': 'waarvan {amount} bespaard',
	'mealPlan.listIncomplete': 'Van sommige artikelen is geen prijs bekend',
```

- [ ] **Schritt 2: `load` erweitern**

Nach dem Aufruf von `planWeekShoppingList` in `src/routes/rezepte/wochenplan/+page.server.ts`:

```ts
	// Nur Cache lesen: Der Wochenplan kann viele Artikel umfassen, ein
	// Auto-Refresh wäre hier eine spürbare Bremse.
	const listPrices = pricesFor(shoppingList.items.map((item) => item.productId));
	const shoppingTotals = shoppingList.items.reduce(
		(acc, item) => {
			const price = listPrices.get(item.productId);
			if (!price) {
				acc.complete = false;
				return acc;
			}
			acc.total += effectivePrice(price) * item.quantity;
			acc.savings += savingsOf(price) * item.quantity;
			return acc;
		},
		{ total: 0, savings: 0, complete: true }
	);
```

`shoppingTotals` ins `return`-Objekt aufnehmen. Import ergänzen:

```ts
import { effectivePrice, pricesFor, savingsOf } from '$lib/server/prices';
```

- [ ] **Schritt 3: Oberfläche ergänzen**

Unter der Einkaufsliste in `src/routes/rezepte/wochenplan/+page.svelte`:

```svelte
{#if data.shoppingTotals.total > 0}
	<div class="border-t border-gray-200 pt-3">
		<p class="font-medium text-gray-700">
			{t('mealPlan.listTotal')}: {formatPrice(data.shoppingTotals.total, data.locale)}
		</p>
		{#if data.shoppingTotals.savings > 0}
			<p class="text-sm text-green-700">
				{t('mealPlan.listSavings', { amount: formatPrice(data.shoppingTotals.savings, data.locale) })}
			</p>
		{/if}
		{#if !data.shoppingTotals.complete}
			<p class="text-xs text-gray-500">{t('mealPlan.listIncomplete')}</p>
		{/if}
	</div>
{/if}
```

- [ ] **Schritt 4: Im Browser prüfen**

Wochenplan mit mehreren Rezepten befüllen, Einkaufsliste erzeugen, Summe gegen die Einzelpreise nachrechnen. 375px und Dark Mode.

- [ ] **Schritt 5: CHANGELOG und committen**

```markdown
- Wochenplan zeigt die Summe der Einkaufsliste samt enthaltener Ersparnis.
```

```bash
npm run check && npm test
git add src/routes/rezepte/wochenplan src/lib/i18n/messages CHANGELOG.md
git commit -m "Zeige Summe und Ersparnis der Wochenplan-Einkaufsliste"
```

---

## Task 12: Erzielte Ersparnis im Lieferungs-Check

Hier braucht es **keinen** Cache: Preis und Rabatt stehen in den Lieferdaten selbst.

**Files:**
- Modify: `src/lib/server/picnic/checklist.ts`
- Modify: `src/lib/server/picnic/checklist.test.ts`
- Modify: `src/routes/lieferung/[id]/+page.svelte`

`src/lib/server/picnic/index.ts` bleibt **unberührt**: `getDeliveryChecklist`
reicht schlicht `aggregateChecklist(...)` durch, die neuen Felder wandern von
selbst mit. Auch `+page.server.ts` der Route braucht nichts — sie spreizt die
Positionen per `...item` ein.
- Modify: `src/lib/i18n/messages/en.ts`, `de.ts`, `nl.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `lineSavings` (Task 1).
- Produces: `DeliveryChecklistItem` um `regularPrice: number | null`, `promoPrice: number | null`, `promoLabel: string | null` erweitert.

- [ ] **Schritt 1: Test schreiben**

In `src/lib/server/picnic/checklist.test.ts` die Hilfsfunktion `line` um Preisangaben erweitern und einen `describe`-Block ergänzen:

```ts
/** Baut eine Bestellzeile mit Rabatt, wie Picnic sie an der ORDER_LINE führt. */
function rabattLine(id: string, quantity: number, regular: number, promo: number) {
	return {
		price: regular,
		decorators: [
			{ type: 'PRICE', display_price: promo },
			{ type: 'PROMO', text: 'jetzt billiger' }
		],
		items: [
			{
				id,
				name: id,
				image_ids: ['bild-' + id],
				unit_quantity: '500g',
				decorators: [{ type: 'QUANTITY', quantity }]
			}
		]
	};
}

describe('aggregateChecklist — Preise', () => {
	it('übernimmt Normal- und Aktionspreis der Zeile', () => {
		const [item] = aggregateChecklist([{ items: [rabattLine('s1', 1, 249, 199)] }]);
		expect(item.regularPrice).toBe(249);
		expect(item.promoPrice).toBe(199);
	});

	it('lässt die Preisfelder ohne Preisangabe leer', () => {
		const [item] = aggregateChecklist([{ items: [line('s1', 1)] }]);
		expect(item.regularPrice).toBeNull();
		expect(item.promoPrice).toBeNull();
	});

	// Derselbe Artikel kann über mehrere Teilbestellungen laufen — die
	// Zeilenpreise müssen sich dann addieren, nicht überschreiben.
	it('summiert Preise über mehrere Bestellungen desselben Artikels', () => {
		const [item] = aggregateChecklist([
			{ items: [rabattLine('s1', 1, 249, 199)] },
			{ items: [rabattLine('s1', 1, 249, 199)] }
		]);
		expect(item.regularPrice).toBe(498);
		expect(item.promoPrice).toBe(398);
	});
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run src/lib/server/picnic/checklist.test.ts
```

Erwartet: FAIL — `regularPrice` ist `undefined`.

- [ ] **Schritt 3: Implementieren**

In `src/lib/server/picnic/checklist.ts` den Import ergänzen:

```ts
import { lineSavings } from './price';
```

`DeliveryChecklistItem` erweitern:

```ts
	/** Normalpreis dieser Position über alle Bestellungen, in Cent; null wenn unbekannt. */
	regularPrice: number | null;
	/** Aktionspreis, in Cent; null = kein Rabatt. */
	promoPrice: number | null;
	/** Beschriftung der Aktion laut Picnic. */
	promoLabel: string | null;
```

Den Typ `OrderLine` erweitern:

```ts
type OrderLine = { items?: OrderArticle[]; price?: number; decorators?: Decorator[] };
```

In `aggregateChecklist` beim Anlegen eines neuen Eintrags `regularPrice: null, promoPrice: null, promoLabel: null` ergänzen und **nach** der Mengenermittlung je Zeile die Preise aufaddieren:

```ts
				const price = lineSavings(line);
				const target = byProduct.get(article.id)!;
				if (price) {
					// Zeilen-Gesamtpreise, deshalb schlicht addieren — derselbe
					// Artikel kann über mehrere Teilbestellungen laufen.
					target.regularPrice = (target.regularPrice ?? 0) + price.regularPrice;
					if (price.promoPrice != null) {
						target.promoPrice = (target.promoPrice ?? 0) + price.promoPrice;
						target.promoLabel ??= price.promoLabel;
					} else {
						// Ohne Rabatt zahlt man den Normalpreis — für die Summe mitzählen
						target.promoPrice = (target.promoPrice ?? 0) + price.regularPrice;
					}
				}
```

**Achtung beim Einbau:** Der bestehende Code legt den Eintrag im `else`-Zweig an und erhöht im `if`-Zweig nur `orderedQuantity`. Der Preisblock muss **nach** diesem if/else stehen, damit er in beiden Fällen läuft.

- [ ] **Schritt 4: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run src/lib/server/picnic/checklist.test.ts
```

Erwartet: PASS.

- [ ] **Schritt 5: i18n und Oberfläche**

`en.ts`: `'delivery.saved': 'Saved: {amount}',` / `'delivery.savedTotal': 'Total saved on this delivery: {amount}',`
`de.ts`: `'delivery.saved': 'Gespart: {amount}',` / `'delivery.savedTotal': 'Bei dieser Lieferung gespart: {amount}',`
`nl.ts`: `'delivery.saved': 'Bespaard: {amount}',` / `'delivery.savedTotal': 'Bespaard bij deze levering: {amount}',`

In `src/routes/lieferung/[id]/+page.svelte` je Position mit Rabatt:

```svelte
{#if item.promoPrice !== null && item.regularPrice !== null && item.promoPrice < item.regularPrice}
	<span class="rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">
		{t('delivery.saved', { amount: formatPrice(item.regularPrice - item.promoPrice, data.locale) })}
	</span>
{/if}
```

Und im Kopf der Seite die Gesamtersparnis:

```svelte
{@const savedTotal = data.items.reduce(
	(sum, i) => sum + Math.max(0, (i.regularPrice ?? 0) - (i.promoPrice ?? 0)),
	0
)}
{#if savedTotal > 0}
	<p class="text-sm text-green-700">
		{t('delivery.savedTotal', { amount: formatPrice(savedTotal, data.locale) })}
	</p>
{/if}
```

- [ ] **Schritt 6: Im Browser prüfen**

Eine echte Lieferung im Lieferungs-Check öffnen. Die Gesamtersparnis muss mit `total_savings` der Bestellung übereinstimmen — bei der Prüf-Lieferung `5xrc7d43u4` waren das **80 Cent** (50 beim Büffelmozzarella, 30 bei den Back-Bögen).

- [ ] **Schritt 7: CHANGELOG und committen**

```markdown
- Lieferungs-Check weist die bei dieser Lieferung erzielte Ersparnis aus —
  je Position und in Summe.
```

```bash
npm run check && npm test
git add src/lib/server/picnic src/routes/lieferung src/lib/i18n/messages CHANGELOG.md
git commit -m "Weise die erzielte Ersparnis im Lieferungs-Check aus"
```

---

## Task 13: Dokumentation nachziehen

Laut `CLAUDE.md` gehören zu jeder Funktionsänderung ohne gesonderte Aufforderung **drei READMEs** und das **Wiki**. Das Wiki liegt in einem eigenen Repository und wandert nicht automatisch mit — genau deshalb ist es der Punkt, der am leichtesten vergessen wird.

**Files:**
- Modify: `README.md`, `README.de.md`, `README.nl.md`
- Modify: Wiki-Repo `Proviant.wiki.git` — `Ordering.md`, `Recipes.md`, `Meal-plan.md`, `Delivery-check.md`

- [ ] **Schritt 1: READMEs ergänzen**

In allen drei READMEs die Funktionsliste um die Preisfunktionen erweitern. **Inhaltsgleich halten** — `README.md` ist englisch (Standard), `README.de.md` deutsch, `README.nl.md` niederländisch. Beispiel für `README.md`:

```markdown
- **Prices and offers** — items and recipes show what they cost, based on
  cached Picnic prices. Running Picnic offers are shown with the amount saved,
  per item, per serving and in total.
```

- [ ] **Schritt 2: Vollständiger Verifikationslauf**

```bash
npm run check && npm test && npm run build
```

Erwartet: alle drei sauber. Erst danach das Wiki anfassen.

- [ ] **Schritt 3: Wiki klonen und ergänzen**

```bash
git clone https://github.com/SirTobyB/Proviant.wiki.git
```

Englisch, in vier Seiten:
- `Ordering.md` — Preise je Vorschlag, Ersparnis, Refresh-Knopf, dass Preise gecacht sind und wie alt sie sein können.
- `Recipes.md` — die zwei Kostenblöcke, Preis pro Portion, Portionsvorgabe 3, Bedeutung von „ab …".
- `Meal-plan.md` — Summe und Ersparnis der Einkaufsliste.
- `Delivery-check.md` — erzielte Ersparnis je Position und gesamt.

Keine neue Seite, daher **kein** `_Sidebar.md`-Eintrag nötig.

- [ ] **Schritt 4: Wiki committen und pushen**

```bash
git add . && git commit -m "Document prices and offers" && git push
```

- [ ] **Schritt 5: READMEs committen**

```bash
git add README.md README.de.md README.nl.md
git commit -m "Beschreibe Preis- und Rabattanzeige in den READMEs"
```

---

## Abschluss

Nach Task 13 ist die Arbeit inhaltlich fertig, aber **noch nicht ausgeliefert**. Ein Release ist ein bewusster, getrennter Schritt (siehe `CLAUDE.md`):

```bash
npm version X.Y.Z --no-git-tag-version
# CHANGELOG.md: [Unveröffentlicht] auf die Version ziehen, leeren
# Unveröffentlicht-Kopf stehen lassen, Vergleichs-Links am Dateiende nachziehen
git commit -am "Veröffentliche Fassung X.Y.Z"
git push
git tag vX.Y.Z && git push origin vX.Y.Z
```

Ein Push auf `main` allein baut **kein** Image. Wer den Fix auf dem Server vermisst, hat meist schlicht nicht getaggt.

Vorgeschlagene Version: **2.3.0** (neue Funktionen, keine Brüche).
