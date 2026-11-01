# Picnic-Ausbau – Design

Stand: 2026-11-01. Grundlage: picnic-api 5.3 (Branch `picnic-api-5`, PR #40).
Die neue Arbeit zweigt von diesem Branch ab, weil alles auf der 5.3-Umstellung
aufbaut.

## Absicht

Proviant soll beim **Planen einer Bestellung** mehr leisten als nur den
Picnic-Warenkorb zu befüllen: sehen, was schon drin liegt, aufräumen,
nicht Lieferbares erkennen, Angebote und Mengenrabatte mitnehmen. Dazu kommen
bessere Stammdaten aus Picnic (Produktdaten, Favoriten, Rezepte) und einige
kleinere Komfortpunkte. picnic-api 5.3 liefert dafür strukturierte Daten, die
es vorher nicht gab.

## Ziele (vom Nutzer gewünscht)

1. **Warenkorb in Proviant** (Variante A): aufklappbarer Block auf der
   Bestellseite über den Vorschlägen.
2. **Nicht lieferbare Produkte** im Warenkorb mit Picnics Ersatz.
3. **Artikel aus dem Artikelstamm in den Warenkorb** legen.
4. **Lieferfenster, Mindestbestellwert, Live-Ankunftszeit** auf der Bestellseite.
5. **Mengenrabatte** als Hinweis in den Vorschlägen.
6. **Angebote**: Artikelseite, Artikelliste, neue Seite „Angebote“.
7. **Mehr Produktdaten** am Artikel: Grundpreis, Marke, Herkunft, Bio,
   Nährwerte (nice-to-have, mitnehmen da wenig Aufwand).
8. **Favoriten** als Quelle im Artikelimport.
9. **Rezeptimport über `recipe.getRecipe()`** inkl. gespeicherter und eigener
   Picnic-Rezepte.
10. **Klarere Fehlermeldungen** bei Picnic-Fehlern.
11. **Filter „ohne Standard-Lagerort“** in der Artikelliste.

## Nicht-Ziele / Anti-Ziele

- **Nie bestellen**, kein Checkout, kein `checkout.*`. Auch das
  **Lieferfenster wird nicht gesetzt** – nur angezeigt (Entscheidung des
  Bauenden, vom Nutzer bestätigt). Ändern bleibt in der Picnic-App.
- **Mengen nie automatisch ändern.** Mengenrabatt ist ein Hinweis mit Knopf.
- **Lieber zu wenig als falsch:** Angebotsabgleich, Herkunft, Parser – im
  Zweifel nichts anzeigen statt etwas Falsches.
- Keine Picnic-Rezepte anlegen/ändern (`createUserDefinedRecipe` usw.).
- Grundpreis **nicht speichern** – er ändert sich mit dem Preis.

## Festgelegte Gestaltung

### 1–4 Bestellseite (`/bestellen`)

Reihenfolge von oben: Verbindungspanel → **Live-Ankunft** (nur wenn eine
Lieferung unterwegs ist) → **Warenkorb-Block** → Vorschläge (wie heute).

**Live-Ankunft:** Für offene Lieferungen `delivery.getDeliveryPosition(id)`;
angezeigt wird `eta` bzw. `etaWindowStart–etaWindowEnd`, nur wenn
`inProgress` oder eine ETA vorhanden ist. Kein Polling im Browser; die Zeit
gilt beim Laden der Seite (Neuladen aktualisiert). Fehler hier dürfen die
Seite nicht stören (still weglassen).

**Warenkorb-Block** (aufklappbar, standardmäßig offen wenn nicht leer):
- **Kopf:** Anzahl Produkte, Summe (`cart.totalPrice`), Abstand zum
  Mindestbestellwert (`cart.minimumOrderValue`; Hinweis in Amber, solange
  unterschritten), gewähltes Lieferfenster (`cart.selectedSlot`
  `windowStart–windowEnd`; fehlt es, „kein Lieferfenster gewählt“).
- **Nicht lieferbar** zuerst, rot markiert: Zeilen mit `isUnavailable`,
  Grund (`unavailableReason`) und Ersatz. Namen/Preise des Ersatzes kommen
  aus `cart.getReplacements(productId)` (die Cart-Antwort enthält nur
  Platzhalter). Knopf **„tauschen“** = altes Produkt komplett entfernen,
  Ersatz in gleicher Menge hinzufügen, danach gegenprüfen (siehe
  `notInCart`-Muster).
- **Zeilen:** Bild, Name, Menge, Preis, Rabatt-Label; **− / +** und **🗑**
  (entfernt die ganze Menge, `removeProductFromCart(id, menge)`).
  Produkte, die Proviant kennt (picnicId-Treffer), verlinken auf die
  Artikelseite; unbekannte erscheinen ohne Link.
- Mengenrabatt-Hinweis (s. 5) auch hier, Aktion dort = „+“.
- Alle Schreibaktionen sind Form-Actions mit `use:enhance={keepValues}`
  und laden danach den Warenkorb neu.

### 3 Artikelstamm → Warenkorb

Artikelliste und Artikelseite: Knopf **„🛒 +1“** für Artikel mit `picnicId`,
daneben „n im Warenkorb“. Ohne Verknüpfung stattdessen „mit Picnic
verknüpfen“ (Link auf die Artikelseite/den vorhandenen Verknüpfungsweg).
Ist Picnic nicht verbunden, Knopf ausgegraut bzw. ausgeblendet; die Liste
darf deshalb nicht langsamer werden oder scheitern – Warenkorbmengen
einmal pro Seitenaufruf (`getCartQuantities`), Fehler → ohne Anzeige.

### 5 Mengenrabatte

Quelle: `priceRanges` (an `Product`, Ersatz-/Rezept-Kacheln). Regel als
**reines Modul mit Test** (z.B. `src/lib/priceTiers.ts`):
Hinweis nur, wenn es eine Staffel gibt, deren Mindestmenge **genau
vorgeschlagene Menge + 1** ist und deren Stückpreis niedriger ist als der
aktuelle. Text etwa „Ab 3 Stück je 2,19 € – 1 mehr kostet nur 0,13 € extra“
(Mehrkosten = Gesamtpreis bei n+1 minus Gesamtpreis bei n). Knopf „auf 3
erhöhen“ setzt nur das Mengenfeld. Die genaue Form von `PriceRange` beim
Bauen in den Typen nachlesen und live prüfen.

### 6 Angebote

- **Datenquelle Liste/Seite:** `catalog.getPromotions()` plus
  `getPromotionGroup()` für Aktionsgruppen; Abgleich mit Artikeln über
  `picnicId`. **Serverseitiger Cache ~1 h** (Modulebene ist hier in Ordnung,
  da sprachunabhängige Daten pro Instanz – keine Locale darin!). Fehler →
  leer, Seite zeigt Hinweis „Angebote gerade nicht abrufbar“.
- **Artikelseite:** gezielt `catalog.getProduct(picnicId)` (wie heute beim
  Preis) → grünes Kästchen „Im Angebot: X statt Y“ + Picnics Label; ein
  Gültigkeitsende nur, falls live auffindbar.
- **Artikelliste:** grünes Abzeichen „Angebot“ + Filter „nur im Angebot“.
- **Neue Seite `/angebote`** (Navigation neben „Bestellen“): schlanke Liste
  der rabattierten eigenen Artikel – Bild, Name, Preis vorher/nachher,
  Bestand/Mindestbestand, „🛒 +1“. Sortierung: unter Mindestbestand zuerst,
  dann nach Ersparnis.
- **Mehrfachangebote zählen mit, einheitlich dargestellt (Nutzer):**
  Aktionen wie „2 für 3,99 €“, „1+1 gratis“ oder „2. zum halben Preis“
  werden auf einen **effektiven Stückpreis mit Streichpreis** umgerechnet,
  damit alle Angebote gleich aussehen und vergleichbar sind – z.B. „je
  2,00 € statt 2,49 € · bei 2 Stück“. Der Zusatz „bei n Stück“ erscheint
  nur, wenn die Ersparnis eine Mindestmenge braucht. Sortiert und bewertet
  wird nach diesem Stückpreis (Ersparnis in % und €). Die Umrechnung der
  Picnic-Beschriftungen ist ein **reines Modul mit Test**; was es nicht
  sicher deuten kann, wird **nicht** angezeigt (lieber zu wenig als falsch)
  und als unbekanntes Label geloggt, damit man nachbessern kann. Auch im
  Bestellvorschlag/Warenkorb wird so ein Angebot wie eine Mengenstaffel
  behandelt (Hinweis, wenn die Mindestmenge genau +1 ist).
- Bekannte Grenze: ein Angebot unter anderer Produkt-ID desselben Artikels
  wird nicht erkannt (akzeptiert).
- **Eine Preisquelle (Entscheidung des Bauenden):** Der bestehende Cache
  `picnic_prices` (24 h, genutzt von Bestell- und Rezeptseiten) bleibt die
  gemeinsame Ablage. Was `getPromotions()` und der Live-Abruf der
  Artikelseite über einen Artikel erfahren, wird dort hineingeschrieben,
  damit Artikelliste, Artikelseite und Bestellseite nicht auseinanderlaufen.
  Der 1-h-Cache betrifft nur den Abruf der Angebotsseite selbst.

### 7 Produktdaten am Artikel

- **Gespeichert** (neue Spalten an `articles`, Migration): `brand`
  (Text), `origin` (Text), `organic` (Boolean), `nutrition` (JSON-Text der
  Nährwertzeilen aus `nutritionRows`). Alle optional.
- **Grundpreis** (`unitPrice`, z.B. „4,81 €/l“) wird **nicht** gespeichert,
  sondern auf der Artikelseite mit dem Preis frisch geladen.
- **Bio (Entscheidung des Bauenden):** nur aus den Label-Abzeichen
  (`labels`), Abgleich als **ganzes Wort** („Bio“, „Biologisch“, „organic“,
  „Demeter“ u.ä.), nie als Teilstring im Namen oder in Beschreibungen
  (sonst träfe „Biotin“). Im Zweifel `false`.
- **Herkunft:** kein eigenes Feld bei Picnic; vermutlich in `infoSections`
  oder `highlightItems`. **Beim Bauen live prüfen**; findet sich nichts
  Verlässliches, bleibt das Feld nur manuell befüllbar (dann im Changelog
  so benennen).
- **Befüllung:** beim Artikelimport (`articleImport.ts`) und über einen Knopf
  **„Daten von Picnic aktualisieren“** auf der Artikelseite (überschreibt
  diese vier Felder). Kein Hintergrund-Abgleich.
- **Formular:** Marke, Herkunft, Bio im `ArticleForm` von Hand pflegbar;
  Nährwerte nur anzeigen (nicht editierbar), auf der Artikelseite als kleine
  Tabelle (aufklappbar).

### 8 Favoriten im Artikelimport (`/artikel/import`)

Zweite Quelle „Favoriten“ neben „Letzte Lieferungen“ (Reiter oder
Umschalter), gruppiert nach Regalbereich (`aisles[].title`). Unvollständige
Bereiche (`complete: false`) per `getFavoritesInAisle` nachladen. Bereits
angelegte Artikel markiert; Import bleibt idempotent über `articleImport.ts`.

### 9 Rezeptimport über `getRecipe()` (`/rezepte/import`)

- Ersetzt den PML-Parser für die **Zutaten und Portionen**: `getRecipe(id,
  { portions: defaultPortions })` o.ä., damit die Mengen immer zur
  gespeicherten Portionenzahl passen (behebt den Fehler „3 Portionen als 4
  gespeichert“). Genaue Optionen beim Bauen nachlesen.
- **Menge je Zutat:** aus `neededText` („(150 g benötigt)“) parsen – reines
  Modul mit Test; fällt das aus, `quantity` (= Gebinde-Anzahl) mit Einheit
  „Stück“ als Rückfall, lieber leer als Unsinn.
- **Verknüpfung:** gibt es einen Artikel mit `picnicId = sellingUnitId`,
  wird er als Alternativartikel der Zutat eingetragen.
- **Vorratszutaten** (`type` = `CUPBOARD`, ggf. `CORE_STOCKABLE`) erkennbar
  machen – mindestens im Import-Vorschau-Text markieren; wie sie im Rezept
  landen, entscheidet der Bauende im Rahmen des bestehenden Rezeptmodells.
- Schritte aus `steps`, Beschreibung aus `description`.
- Drei Reiter: „Picnic-Rezepte“ (wie heute), „Gespeichert“
  (`getSavedRecipes`), „Eigene“ (`getUserDefinedRecipes`; dort sind `steps`
  leer, `note` ist HTML → als Text übernehmen, kein HTML in die App).
- **Keine Reparatur** bereits importierter Rezepte (Nutzer: bisher nur
  eines, wird bei Bedarf von Hand korrigiert).
- Der bisherige PML-Parser darf bleiben, wo er noch gebraucht wird (z.B.
  Rezeptliste), sonst entfernen.

### 10 Fehlermeldungen

Eine Zuordnung `Picnic-Fehler → i18n-Schlüssel` im Adapter (reines Modul mit
Test): `PicnicApiError.code`/HTTP-Status, `ProductNotFoundError`,
`UnexpectedPageFormatError`, Netzwerk/Timeout. Mindestens: Anmeldung
abgelaufen → neu verbinden, Produkt nicht gefunden, Picnic nicht
erreichbar, unerwartetes Seitenformat. Rohtexte weiterhin ins Log
(`logWarn`), nicht in die Oberfläche.

### 11 Filter „ohne Standard-Lagerort“

Schalter in der Artikelliste, als URL-Parameter (lesezeichenfähig), mit
bestehenden Filtern (Tags) kombinierbar. Inaktive Lagerorte zählen als
„ohne“ (sie werden beim Stilllegen ohnehin geleert).

## Rahmenbedingungen (aus CLAUDE.md, verbindlich)

- Picnic nur über `src/lib/server/picnic/`; neue Rechenlogik in reine
  Module **mit Vitest-Test**.
- Alle Texte dreisprachig in `src/lib/i18n/messages/` (en Quelle, de/nl
  typisiert).
- Audit-Felder bei jedem Insert/Update; Migration per `npm run db:generate`.
- Dark-Theme-Overrides für neue Farbklassen prüfen; Mobile 375px, Inputs
  ≥16px, `flex-wrap` statt `shrink-0` in Kopfzeilen.
- Formulare mit `keepValues`; nach Warenkorb-Schreibaktionen gegenprüfen.
- Doku: CHANGELOG (Unveröffentlicht), drei READMEs, Wiki (Ordering, Items,
  Recipes, neue Seite „Offers“ + `_Sidebar.md`).
- Verifikation: `npm run check`, `npm test`, `npm run build`, UI im Browser.
- **Live-Tests am echten Warenkorb nur nach Rückfrage beim Nutzer** (er
  nutzt ihn real); lesende Live-Prüfungen sind in Ordnung.

## Dem Bauenden überlassen

- Aufteilung in Commits/PRs und Reihenfolge (Vorschlag: Fehlermeldungen →
  Rezeptimport → Favoriten + Filter → Produktdaten + Angebote → Warenkorb,
  Mengenrabatte, Slots/ETA).
- Konkrete Komponentenaufteilung, Cache-Implementierung, Texte im Detail.
- Wie Vorratszutaten im Rezept abgebildet werden (im bestehenden Modell).
