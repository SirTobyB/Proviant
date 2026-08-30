# Preise und Rabatte — Design

Stand: 2026-08-30

## 1. Ziel

Die App kennt bisher keine Preise. Sie soll künftig zeigen, **was etwas kostet
und was man spart**:

- **Bestellvorschlag** (`/bestellen`): Preis je Artikel, Ersparnis in Euro,
  Summe und Gesamtersparnis.
- **Rezept-Detail** (`/rezepte/[id]`): Gesamtpreis und Preis pro Portion,
  getrennt für *nur die fehlenden* und *alle* Zutaten, jeweils mit Ersparnis.
  Portionen mit **3** vorbelegt.
- **Rezeptliste** (`/rezepte`): kurze Angabe „ca. X €/Portion" je Kachel.
- **Wochenplan** (`/rezepte/wochenplan`): Summe und Ersparnis der Einkaufsliste.
- **Lieferungs-Check** (`/lieferung`): tatsächlich erzielte Ersparnis der
  Lieferung.

Nicht im Umfang: Preis-Gewichtung im Rezeptvorschlag (`suggest.ts`) und die
Admin-Einstellung für die Portionsvorgabe — beides eigene Schritte, siehe § 9.

## 2. Live-Befunde zur Picnic-API

Am 2026-08-30 an Lieferung `5xrc7d43u4` (28.08.) und mehreren Katalogabrufen
geprüft. Diese Befunde tragen das ganze Design und gehören anschließend in den
Picnic-Block von `CLAUDE.md`.

### 2.1 Rabatte sitzen an der ORDER_LINE — mit invertierter Semantik

Nicht am `ORDER_ARTICLE`, sondern an der umschließenden `ORDER_LINE`:

| Position | `line.price` | `PRICE`-Decorator | `PROMO`-Decorator |
| --- | --- | --- | --- |
| Mandara Büffelmozzarella (`s1020625`) | 249 | **199** | „jetzt 1.99€" |
| Toppits Back-Bögen (`s1020867`) | 295 | **265** | „10% Rabatt" |

**`line.price` ist der Streichpreis (Normalpreis), der `PRICE`-Decorator der
tatsächlich gezahlte Aktionspreis.** Das ist umgekehrt zur Intuition: Wer den
Decorator für „den Preis" hält und `line.price` ignoriert, verliert die
Ersparnis; wer es andersherum liest, verbucht den Rabatt als Aufschlag.

Ohne Rabatt fehlen beide Decorators und `line.price` ist schlicht der Preis.

Gegenprobe: 50 ct + 30 ct = 80 ct, und die Bestellung führt
`"total_savings": 80`. Die Deutung ist damit rechnerisch bestätigt.

### 2.2 `ORDER_ARTICLE.price` ist ein Müllwert

Bei **jedem** Artikel der Lieferung steht `"price": 432199`, im
Substitutions-Block `77777`. Offensichtlich Sentinel-Werte. Der echte Preis
steht ausschließlich an der Line. Diese Felder nie lesen.

### 2.3 Im Katalog ist die Semantik genau umgekehrt

Bei `s1021273` (Mazola Rapsöl, zum Prüfzeitpunkt im Angebot) liefert
`getProductDetails()`: `displayPrice: 349` und
`promotion: { label: "jetzt 3.49€" }`.

**`displayPrice` ist hier der rabattierte Preis** — anders als `line.price` in
§ 2.1, wo derselbe Betragstyp den Streichpreis trägt. Wer eine der beiden
Regeln auf die andere Quelle anwendet, rechnet den Rabatt verkehrt herum.

Den Streichpreis kennt `getProductDetails()` **nicht**. `search()` ebenso
wenig: Es liefert `display_price: 349`, `price_ranges: [{price: 349,
from_quantity: 1}]` und — live geprüft — **`decorators: []`, also leer**. Die
Suche ist für Rabatte damit endgültig unbrauchbar.

### 2.4 Der Streichpreis steht nur in der rohen Produktseite

`getProductDetailsPage()` enthält ihn, erkennbar an **`isCrossed`**:

```json
{ "type": "PRICE", "price": 349, "color": "#b40117", "fontSize": 28 }
{ "type": "PRICE", "price": 449, "color": "#c9c6c3", "fontSize": 22, "isCrossed": true }
```

Ersparnis also 449 − 349 = 1,00 €.

**Der Negativfall sieht völlig anders aus:** Bei `s1020625` (kein Angebot)
gibt es **gar keine `PRICE`-Komponente**; der Preis steckt dort in einer
`markdown.props`-Struktur, zusammen mit Staffelpreisen (249/239/229). Der
Parser darf sich also nicht auf eine einzige Seitenform verlassen.

Verifizierte Regel, **ein** Seitenabruf pro Produkt:

1. `getProductDetailsPage(id)` holen.
2. Aktueller Preis über `extractProductDetails(id, page)` aus
   `picnic-api/lib/domains/catalog/helpers` — die Bibliothek exportiert den
   Parser, der Zweitabruf über `getProductDetails()` entfällt damit.
3. Streichpreis: eigene, defensive Suche nach `{ type: "PRICE",
   isCrossed: true }`; nur gültig, wenn der Betrag **echt größer** ist als der
   aktuelle Preis.
4. Kein solcher Knoten → kein Rabatt.

End-to-end gegen beide Produkte geprüft:

| Produkt | `PRICE`-Komponenten | Ergebnis |
| --- | --- | --- |
| `s1021273` (Angebot) | `[{349,false},{449,true}]` | regular 449, promo 349, Ersparnis 100 |
| `s1020625` (kein Angebot) | `[]` | regular 249, promo `null`, Ersparnis 0 |

Nebenbefund: Mit `full=false` fällt `promotion` aus `getProductDetails()` weg.

### 2.5 Kein Bulk-Lookup

Es gibt keinen Abruf „Preise zu dieser Liste von Produkt-IDs". Ein Call pro
Produkt. Ein Rezept mit 10 Zutaten samt Alternativartikeln wären 10–30 Calls
pro Seitenaufruf — **Live-Abruf beim Rendern scheidet damit aus**, es braucht
einen Cache (§ 4).

### 2.6 Zwei Quellen, zwei Regeln

Zusammengefasst, weil die Verwechslungsgefahr der eigentliche Fallstrick ist:

| | Streichpreis (regular) | Aktueller Preis (promo) |
| --- | --- | --- |
| **ORDER_LINE** (Lieferung) | `line.price` | `PRICE`-Decorator |
| **Katalogseite** (Produkt) | `PRICE`-Komponente mit `isCrossed: true` | `displayPrice` |

Beide Regeln sind live gemessen. Sie sind **nicht** ineinander überführbar.

## 3. Datenmodell

Neue Tabelle `picnic_prices`. Preise **nicht** an `articles` hängen: jeder
Refresh würde sonst `updated_at`/`updated_by` des Artikels umschreiben und die
Audit-Spur entwerten („wer hat den Artikel geändert?" → „der Preis-Refresh").

Schlüssel ist die **Picnic-ID**, nicht die Artikel-ID: ein Abruf bedient damit
alle Artikel, die auf dasselbe Produkt zeigen, und der Eintrag überlebt das
Löschen eines Artikels.

| Spalte | Typ | Bedeutung |
| --- | --- | --- |
| `picnic_id` | text, PK | Produkt-ID |
| `regular_price` | integer, NOT NULL | Normalpreis in Cent (der Streichpreis) |
| `promo_price` | integer, nullable | Aktionspreis in Cent; `null` = kein Rabatt |
| `promo_label` | text, nullable | z.B. „10% Rabatt", reine Anzeige |
| `fetched_at` | integer, NOT NULL | Zeitpunkt des Abrufs |

Die Benennung trägt die invertierte Semantik aus § 2.1 im Schema statt nur in
einem Kommentar. **Ersparnis = `regular_price − promo_price`.**

**Bewusste Abweichung von der Audit-Konvention:** reiner Maschinen-Cache, kein
Nutzer editiert ihn — `fetched_at` *ist* die Audit-Information. Kommentar ins
Schema, Notiz in `CLAUDE.md`.

Migration per `npm run db:generate`. Neue Tabelle, kein `ALTER TABLE ADD
COLUMN` — der Default-Fallstrick aus `CLAUDE.md` greift hier nicht.

## 4. Module

### 4.1 `server/picnic/price.ts` — reiner Parser

Netzwerkfrei, ohne SvelteKit-Import, damit eigenständig testbar (wie
`checklist.ts` und `unitQuantity.ts`).

```
parseProductPrice(rawPage: unknown): { regularPrice, promoPrice, promoLabel } | null
lineSavings(line: unknown): { regularPrice, promoPrice, promoLabel } | null
```

`lineSavings` deutet die ORDER_LINE-Struktur aus § 2.1 (Lieferungs-Check),
`parseProductPrice` die Katalogseite nach der Regel aus § 2.4. Die beiden
Funktionen bleiben **bewusst getrennt** statt hinter einer gemeinsamen
Abstraktion — ihre Regeln sind gegenläufig (§ 2.6), und eine Zusammenlegung
lüde genau zur Verwechslung ein, die hier der Hauptfehler wäre.

**Defensiv:** unbekannte Struktur → `null`, nie geratene Zahlen. Ein
Streichpreis, der nicht **echt größer** ist als der aktuelle Preis, gilt als
Datenfehler und ergibt `promoPrice = null` (kein negativer Rabatt).

### 4.2 `server/picnic/index.ts` — Erweiterung

```
getProductPrices(ids: string[]): Promise<Map<string, ProductPrice>>
```

Ein Call pro ID über `getProductDetailsPage`, `Promise.allSettled`,
fehlgeschlagene ID wird übersprungen (kein Abbruch). Deckelung durch den
Aufrufer, nicht hier.

### 4.3 `server/prices.ts` — Cache-Zugriff

```
pricesFor(picnicIds): Map<string, CachedPrice>     // nur DB
refreshPrices(picnicIds, { maxAge, limit }): Promise<{ updated, failed }>
```

`refreshPrices` holt nur, was älter als `maxAge` ist, älteste zuerst, maximal
`limit` Stück. Picnic nicht verbunden → stillschweigend nichts tun (kein
Fehler; die Seite zeigt Cache-Werte).

### 4.4 `lib/recipeCost.ts` — reine Rechenlogik, mit Test

Laut `CLAUDE.md` gehört neue Rechenlogik in ein solches Modul, nicht in eine
Route.

```
recipeCost(ingredients, prices, portions, baseServings): {
  toOrder: CostBlock   // nur was der Vorrat nicht deckt
  all:     CostBlock   // als wäre kein Vorrat da
}

CostBlock = {
  total: number          // Cent
  savings: number        // Cent
  perPortion: number     // Cent, ungerundet
  complete: boolean      // false = Untergrenze
  unpriced: string[]     // Zutaten ohne Preis
}
```

Je Zutat: skalieren (`scaleAmount`), Gebinde bestimmen (`coverageMulti`),
Preis über `orderPicnicId` nachschlagen, mit der Gebindezahl multiplizieren.

**Wichtige Unterscheidung bei `complete`:** Eine Zutat, die der Vorrat voll
deckt, trägt in `toOrder` 0 € bei und macht den Block **nicht** unvollständig —
es ist ja wirklich nichts zu kaufen. In `all` trägt dieselbe Zutat dagegen
Gebinde bei; fehlt dort ein Preis, ist `all.complete = false`. Die zwei Blöcke
können also unterschiedlich vollständig sein.

`perPortion` bleibt ungerundet; gerundet wird ausschließlich in der Anzeige.

### 4.5 `lib/units.ts` — additive Erweiterung

`CoverageResult` bekommt ein Feld **`fullPackages`**: benötigte Gebinde, als
wäre kein Vorrat da. Gleiche Rundung und derselbe `sizingArticle` wie bei
`neededPackages`, nur ohne Abzug des Bestands. Rein additiv — bestehende
Aufrufer und Tests bleiben unberührt.

### 4.6 Portionsvorgabe — Naht für später

```
// server/settings.ts (vorerst minimal)
defaultPortions(): number   // liefert 3
```

`/rezepte/[id]` startet damit global auf 3. Das spätere Settings-Subsystem
(§ 9) ersetzt nur die Implementierung dieser einen Funktion — kein Aufrufer
ändert sich.

## 5. Refresh-Strategie

Cache mit Auto-Refresh und manuellem Button, aber **nicht überall
automatisch** — sonst zieht die Rezeptliste bei jedem Aufruf hunderte IDs:

| Fläche | Verhalten |
| --- | --- |
| Rezept-Detail, Bestellvorschlag | veraltete Preise (> 24 h) nachladen, max. 20 pro Request, älteste zuerst |
| Rezeptliste, Wochenplan | nur Cache lesen, mit Alters-Hinweis |
| Button „Preise aktualisieren" (`/bestellen`) | alle verknüpften Artikel, Ergebnis als Meldung |
| Lieferungs-Check | kein Cache nötig — die Ersparnis steht in den Lieferdaten selbst |

## 6. UI

Alle Texte nach `src/lib/i18n/messages/` (en als Quelle der Wahrheit, de/nl
typisiert nachziehen). Neue Farbtöne brauchen einen Dark-Override in
`layout.css`; vorrangig vorhandene Utility-Klassen verwenden.

- **`/bestellen`** — Preis je Zeile, Rabatt-Badge „−0,50 €", Summe und
  Gesamtersparnis. Button „Preise aktualisieren".
- **`/rezepte/[id]`** — Portionswahl auf 3 vorbelegt. Zwei Blöcke („Zu
  bestellen" / „Alle Zutaten") mit Gesamt, pro Portion und Ersparnis.
  Unvollständige Summen als „ab 12,40 €" mit Nennung der preislosen Zutaten.
- **`/rezepte`** — „ca. X €/Portion" je Kachel, aus dem Cache. Bewusst der
  **`all`-Block** bei `defaultPortions()`, nicht `toOrder`: Kacheln sollen
  Rezepte untereinander vergleichbar machen, und ein `toOrder`-Preis schwankte
  mit dem Vorrat — dasselbe Rezept wäre morgen billiger als heute, ohne dass
  sich am Rezept etwas geändert hat.
- **`/rezepte/wochenplan`** — Summe und Ersparnis der Einkaufsliste.
- **`/lieferung`** — erzielte Ersparnis je Position und gesamt.

Kopfbereiche mit Button-Gruppen: äußeren Container `flex-wrap`, **kein**
`shrink-0` — der bekannte 375px-Fallstrick.

**N+1 vermeiden:** Rezeptliste und Wochenplan laden Zutaten, Artikel und
Preise gebündelt (Vorbild: `tagsForArticles`), nicht je Rezept einzeln.

## 7. Tests

Neu, im Stil der vorhandenen reinen Modultests:

- `picnic/price.test.ts` — gegen eingefrorene Fixtures: Line mit Rabatt, Line
  ohne, kaputte Struktur, `promoPrice >= regularPrice`.
- `recipeCost.test.ts` — gedeckte/ungedeckte Zutat, Zutat ohne Preis
  (`complete`-Verhalten in beiden Blöcken), Skalierung, Ersparnis.
- `units.test.ts` — `fullPackages` ergänzen.

Verifikation vor dem Commit: `npm run check`, `npm test`, `npm run build`,
plus Dev-Server für die fünf UI-Flächen.

## 8. Dokumentation

Ohne gesonderte Aufforderung mitzuziehen: `CHANGELOG.md` (unter
`## [Unveröffentlicht]`, im selben Commit), die **drei READMEs**
(`README.md`/`.de.md`/`.nl.md`, inhaltsgleich), und das **Wiki**
(`Proviant.wiki.git`, englisch) — betroffen: Ordering, Recipes, Meal-plan,
Delivery-check.

Dazu die Fallen aus § 2 in den Picnic-Block von `CLAUDE.md`.

## 9. Bewusst später

- **Admin-Einstellung für die Portionsvorgabe.** Es gibt bislang **keinen**
  Settings-Store (15 Tabellen, keiner davon einer). Nötig wären Tabelle,
  Migration, `server/settings.ts`, eine neue Admin-Route `/einstellungen`,
  i18n ×3 und eine neue Wiki-Seite samt `_Sidebar.md`. Für sich überschaubar,
  neben dem Preis-Umfang aber ein zweites Subsystem im selben Durchgang. Die
  Naht aus § 4.6 macht den Nachzug billig.
- **Preis-Gewichtung im Rezeptvorschlag** (`suggest.ts`).

## 10. Risiken

- **PML-Parser sind brüchig** (Picnic ändert Seitenstrukturen). Das ist nach
  Klärung von § 2.4 das verbleibende Hauptrisiko: Ändert sich die Seitenform,
  verschwindet der `isCrossed`-Knoten und Rabatte fallen still aus. Deshalb
  defensiv, mit Fixture-Test und mit der Regel „im Zweifel kein Rabatt statt
  eines falschen" — ein fehlender Rabatt ist ein Schönheitsfehler, ein
  falscher eine Fehlinformation über Geld.
- **Verwechslung der beiden Regeln** aus § 2.6 — abgesichert durch getrennte
  Funktionen und je einen Test pro Quelle.
- **Ladezeit** durch Auto-Refresh — durch Deckelung auf 20 IDs begrenzt.
- **Ein Call pro Produkt** bleibt der Kostentreiber; der Cache ist deshalb
  nicht Optimierung, sondern Voraussetzung.
