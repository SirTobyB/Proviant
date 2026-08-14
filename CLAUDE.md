# CLAUDE.md

Leitfaden für die Arbeit an diesem Repository (Claude Code & Mitentwickelnde).

## Projekt

Selbstgehostete Familien-Webapp zur Lebensmittelverwaltung: Lager (Chargen mit
MHD), Inventur, Artikelstamm (mit Tags), Rezepte (mit Alternativartikeln je
Zutat), Wochenplan und Picnic-Anbindung (Bestellvorschläge — abgeglichen mit
Warenkorb und offenen Bestellungen —, Lieferungs-Check mit Auto-Anlage
fehlender Artikel). SvelteKit + TypeScript + SQLite (Drizzle), als
Docker-Image für amd64/arm64. Kommentare und Commit-Messages sind **deutsch**,
die Oberfläche dagegen **dreisprachig** (Englisch als Standard, Deutsch,
Niederländisch) — neue Texte gehören deshalb nach `src/lib/i18n/messages/`
und nie fest in eine Komponente oder eine Server-Action.

## Befehle

```sh
npm run dev           # Dev-Server auf Port 5173
npm run build         # Produktions-Build (adapter-node)
npm run check         # Typecheck – nach Änderungen immer laufen lassen
npm test              # Vitest (reine Logik-Module), npm run test:watch zum Mitlaufen
npm run db:generate   # Migration aus dem Schema erzeugen (nach Schema-Änderung)
```

Voraussetzung: **Node.js ≥ 22.12** (Vite 8). Verifikation vor dem Commit:
`npm run check` + `npm test` + `npm run build`; für UI-Änderungen den
Dev-Server starten und im Browser prüfen.

**Tests** (`vitest.config.ts`, bewusst ohne SvelteKit-Plugin) decken die
reinen Logik-Module ab: `units.ts`, `suggest.ts`, `mhd.ts`, `format.ts`,
`journal.ts`, `i18n/` (Sprachaushandlung, Plurale, Vollständigkeit der
Wörterbücher), `picnic/unitQuantity.ts`, `picnic/checklist.ts`. Genau dort steckten die
schwersten Bugs — neue Rechenlogik gehört deshalb in ein solches Modul
**mit Test**, nicht in eine Route.

## Architektur

- **Routen** unter `src/routes/`. Server-Logik in `+page.server.ts` (Actions),
  UI in `+page.svelte`. JSON-Endpunkte unter `src/routes/api/`.
- **Serverseitige Module** in `src/lib/server/`:
  - `db/` – Drizzle-Setup und Schema. `db/index.ts` **wendet beim Start
    Migrationen an** (`migrate`) und seedet Lagerorte + ersten Admin (beides
    nur, solange die jeweilige Tabelle leer ist — siehe Fallstrick unten).
  - `picnic/` – **isolierter Adapter** um die inoffizielle `picnic-api`. Der
    Rest der App importiert Picnic **nur von hier**. Reine, eigenständig
    testbare Untermodule (ohne SvelteKit-Import): `checklist.ts`
    (Lieferdaten-Normalisierung), `recipeImport.ts` (Parser für die
    undokumentierten PML-/Fusion-Rezeptseiten), `unitQuantity.ts`
    (Gebindegrößen wie „6er Pack", „2 x 125g").
  - `auth.ts` / `password.ts` – Sessions (DB-gestützt, httpOnly-Cookie) und
    scrypt-Hashing. `audit.ts` – Helfer für die Audit-Felder. `log.ts` –
    Zeilen-Logging mit Zeitstempel (siehe Fallstrick unten).
  - `stock.ts` (Buchungen, FEFO, **Journal-Erfassung** — siehe Fallstrick
    unten), `locations.ts` (Lagerort-Stammsatz inkl. Aktiv-Regel — siehe
    Fallstrick unten), `tags.ts` (Rezept-Tags), `articleTags.ts`
    (Artikel-Tags — **eigener Tag-Pool**, bewusst getrennt von den
    Rezept-`tags`, inkl. Bulk-Map `tagsForArticles` gegen N+1 auf
    Listenseiten), `recipeData.ts`, `mealPlan.ts` (Wochenplan-Einkaufsliste:
    verrechnet den gemeinsamen Vorrat über alle geplanten Tage per
    Artikel-Pool, Rundungs-Überschüsse werden zurückgebucht),
    `articleForm.ts`, `recipeForm.ts`, `articleImport.ts` (Artikel aus
    Picnic-Produkt, **idempotent** per picnicId-Dedupe — wird auch vom
    Lieferungs-Check zum Auto-Anlegen fehlender Artikel genutzt), `images.ts`.
- **Sprachen** in `src/lib/i18n/`: `locales.ts` (Sprachliste, Aushandlung),
  `translate.ts` (`translator(locale)`), `messages/en.ts` als **Quelle der
  Wahrheit** — `de.ts`/`nl.ts` sind dagegen typisiert (`Messages`), ein
  fehlender Schlüssel bricht `npm run check`. Serverseitiges Drumherum
  (Cookie) in `server/locale.ts`. Siehe Fallstrick unten.
- **Reine Helfer** in `src/lib/` (client- und servertauglich): `units.ts`
  (Mengen/Einheiten; `coverageMulti` summiert Bestand über die
  Alternativartikel einer Zutat), `mhd.ts` (Restlaufzeit/Ampel), `suggest.ts`
  (gewichteter Rezeptvorschlag), `sound.ts` (Scan-Signalton per Web Audio),
  `format.ts` (`packageSize`, `formatPrice`, `tagFilterHref` — vor eigenen
  Formatierern erst hier nachsehen), `stock.ts` (`sumQuantity`), `forms.ts`
  (`keepValues`, siehe Formular-Fallstrick unten), `journal.ts`
  (Beschriftungen der Buchungsarten/-herkünfte).
- **Wiederverwendbare Komponenten** in `src/lib/components/`: `ArticleForm`,
  `RecipeForm`, `TagInput` (Chips + Autocomplete, rendert das
  `name="tags"`-Hiddenfield selbst), `BarcodeScanner`, `StockEntryRow`
  (Chargen-Zeile mit Schnellkorrektur/Bearbeiten/Umlagern — genutzt von der
  Lagerort- **und** der Artikelseite; die Server-Logik dazu liegt in
  `server/stock.ts` als `updateStockEntryFromForm`/`moveStockEntryFromForm`,
  parametrisiert über `{ articleId }` oder `{ locationId }`).
- **Auth-Enforcement** in `src/hooks.server.ts`: ohne Login → `/login`;
  `/benutzer` nur für Admins. `locals.user` (Typ in `src/app.d.ts`) trägt den
  angemeldeten Benutzer. Das Root-Layout zeigt die Navigation nur, wenn
  `data.user` gesetzt ist (deshalb rendert `/login` ohne App-Chrome). Dieselbe
  Datei protokolliert Fehler und schreibt die Startzeile.

## Wichtige Konventionen & Fallstricke

- **Audit-Felder:** Jede Tabelle hat `created_by/updated_by/created_at/updated_at`
  (Link-Tabelle nur Anlage). Bei **jedem** Insert/Update die Helfer aus
  `audit.ts` einspreizen und `locals.user?.username` durchreichen
  (`auditNew` / `auditEdit` / `auditLink`). Serverfunktionen wie `bookIn`,
  `bookOut`, `setRecipeTags` nehmen den Benutzernamen als Parameter.
- **Buchungsjournal:** `stock_movements` historisiert jede Bestandsänderung.
  Erfasst wird **ausschließlich in `server/stock.ts`** — dort liegen alle
  Schreibzugriffe auf `stock_entries`, dadurch ist das Journal lückenlos.
  Wer `stock_entries` künftig aus einer Route heraus schreibt, reißt genau
  dieses Loch. Jede Buchungsfunktion (`bookIn`, `bookOut`, `moveStockEntry`,
  `updateStockEntryFromForm`, `moveStockEntryFromForm`) nimmt dafür einen
  `source` (`scan` | `inventur` | `lieferung` | `artikelliste` | `charge`) —
  ohne den wäre im Journal nicht erkennbar, woher eine Buchung kam.
  `bookOut` schreibt **je verbrauchter Charge eine Zeile**, weil FEFO über
  mehrere Lagerorte laufen kann und „welcher Lagerplatz?" sonst nicht ehrlich
  zu beantworten wäre. Der Artikelname liegt als Schnappschuss in der Zeile
  und der FK steht auf `set null` (nicht `cascade` wie bei `stock_entries`),
  damit die Historie das Löschen eines Artikels überlebt.
- **Mehrsprachigkeit (en/de/nl):** Standard ist **Englisch**, `en-GB` beim
  Formatieren. Die geltende Sprache ermittelt `hooks.server.ts` einmal pro
  Anfrage (Benutzerwahl → Cookie → `Accept-Language` → Englisch) und legt sie
  in `locals.locale`; das Root-Layout reicht sie als `data.locale` weiter,
  Komponenten bilden daraus `translator(data.locale)`. Die Auswertung gehört
  **auf den Server** — im Browser (`navigator.language`) würde die Seite erst
  in der Standardsprache rendern und dann umspringen (Flackern plus
  Hydration-Abweichung). Die aktuelle Sprache darf **niemals** in einer
  Modul-Variablen liegen: Der Node-Prozess bedient alle Anfragen gleichzeitig,
  eine solche Variable vertauscht die Sprache zwischen parallelen Requests
  (fällt lokal nie auf). Server-Actions bilden ihren Übersetzer deshalb
  explizit aus `locals.locale`. `<html lang>` wird zweifach gepflegt: per
  `transformPageChunk` beim Server-Rendern **und** per `$effect` im Layout,
  weil ein Sprachwechsel ohne Neuladen sonst den alten Wert stehen ließe.
  Anwenderdaten (Artikel, Tags, Rezepte, Lagerortnamen) werden bewusst **nicht**
  übersetzt, ebenso wenig der Changelog.
- **Migrationen:** Nach Schema-Änderung `npm run db:generate`. SQLite erlaubt bei
  `ALTER TABLE ADD COLUMN` **keinen nicht-konstanten Default** (`unixepoch()`) —
  für nachgerüstete Zeitstempel-Spalten die generierte Migration von Hand auf
  `DEFAULT 0 NOT NULL` + `UPDATE … = unixepoch()` (Backfill) umstellen (siehe
  `drizzle/0002_*.sql`). Das Schema behält `default(sql\`(unixepoch())\`)`; da der
  Snapshot dem Schema entspricht, entsteht keine Drift.
- **Lagerorte** sind Stammdaten und werden unter `/lagerorte` gepflegt (nur
  Admin). Der Seed in `db/index.ts` greift **nur bei leerer Tabelle** — ein
  Abgleich über den Namen würde einen umbenannten Lagerort bei jedem Start
  unter seinem alten Namen zurückholen. Neue Lagerorte gehören deshalb in die
  App, nicht in die Seed-Liste. **Gelöscht wird nie**, sondern `active = 0`
  gesetzt: `stock_entries` und `stock_movements` verweisen auf Lagerorte, die
  Historie muss lesbar bleiben. Ein inaktiver Lagerort ist für den Anwender
  wie gelöscht — damit das lückenlos gilt, holt sich **jede** Auswahlliste
  ihre Lagerorte über `server/locations.ts` (`activeLocations`,
  `activeLocationsExcept`) und **jede** Buchung ihr Ziel über
  `activeLocation`/`bookingLocationId`; ausblenden allein genügt nicht, ein
  veraltetes Formular darf serverseitig nicht durchkommen. Stilllegen setzt
  einen leeren Lagerort voraus (sonst wäre Bestand unsichtbar, zählte aber in
  den Summen weiter) und leert den Standard-Lagerort betroffener Artikel.
  Einzige Ausnahme von der Ausblend-Regel ist der **Journal-Filter**: er
  listet die im Journal vorkommenden Lagerorte, sonst wäre die Historie eines
  stillgelegten Orts nicht mehr auffindbar. Ein Namens-Schnappschuss wie beim
  Artikel entfällt bewusst — derselbe physische Ort soll auch rückwirkend
  seinen aktuellen Namen zeigen.
- **Erster Admin** wird beim Start aus `ADMIN_USERNAME`/`ADMIN_PASSWORD`
  angelegt, solange kein Benutzer existiert.
- **Picnic:** Nur Warenkorb befüllen, **nie automatisch bestellen** — der
  Checkout bleibt in der Picnic-App. Erststart braucht Login + SMS-2FA; der
  Auth-Key liegt in `DATA_DIR/picnic-auth-key` (übersteht Neustarts).
  Grenzen der API (live geprüft): Suche findet **keine EANs**, Produktdetails
  enthalten **keine EAN/GTIN**, Rezept**bilder** sind nicht öffentlich abrufbar
  (S3 403) — Produktbilder dagegen schon. Die Rezept-/Übersichtsseiten sind
  dynamische PML-Strukturen; Parser dafür heuristisch und **defensiv** halten
  (lieber leer zurückgeben als Datenmüll importieren).
- **Picnic-Datenstrukturen** (alle live geprüft, sparen viel Rätselraten):
  - **Mengen stehen im `QUANTITY`-Decorator**, nie in der Länge von `items`:
    ein Produkt taucht je Zeile genau **einmal** auf. Vorkommen zählen ergibt
    also immer 1 — genau dieser Fehler steckte im ersten Warenkorb-Abgleich.
    `lineQuantity()` in `picnic/checklist.ts` macht es richtig.
  - **Warenkorb:** `analytics_context_data.items_list` (`product_id` +
    `quantity`) ist die bequemste Quelle, fehlt aber bei leerem Warenkorb —
    deshalb zusätzlich der Decorator-Weg als Fallback (`getCartQuantities`).
  - **Lieferungsliste enthält keine Positionen** (`orders[].items` fehlt), die
    kommen erst per `getDelivery(id)`. Offene Lieferungen deshalb per
    Ausschluss bestimmen (nicht `COMPLETED`/`CANCELLED`) und je Lieferung
    einzeln nachladen; auch Teilbestellungen können `CANCELLED` sein.
  - **Unbekannte Produkt-IDs quittiert Picnic ohne Fehler** — es landet
    nichts im Warenkorb, die App meldete trotzdem Erfolg. Nach dem Befüllen
    deshalb gegenprüfen (siehe `notInCart` auf der Bestellseite). Dasselbe
    Produkt existiert im Katalog teils unter mehreren IDs.
- **Anmeldung:** Fehlversuche zählt `login_attempts` **je eingegebenem
  Benutzernamen**, auch bei unbekannten — deshalb hat die Tabelle bewusst
  *keinen* Fremdschlüssel auf `users`: sonst wäre am Verhalten ablesbar, welche
  Namen existieren. Aus demselben Grund rechnet `authenticate` auch bei
  unbekanntem Namen einen Wegwerf-Hash durch (sonst verriete die Antwortzeit
  das Konto). Die Sperrregeln (Schwelle, Verdopplung, Deckel, Verfallsfenster)
  liegen als reines Modul in `lib/loginThrottle.ts` **mit Test**; gesperrt wird
  **nur auf Zeit**, eine dauerhafte Sperre wäre ein Weg, Familienmitglieder
  auszusperren. Die Prüfung gehört **vor** den Passwortvergleich, sonst ist sie
  nur eine Meldung und keine Bremse.
- **Bilder:** Der Dateityp wird in `server/images.ts` **aus dem Inhalt**
  bestimmt (Signatur der ersten Bytes), nie aus `File.type` oder einem
  `Content-Type` — beides kommt vom Absender und ist frei wählbar, das `accept`
  am Eingabefeld ist reine Oberfläche. **SVG ist bewusst nicht erlaubt**: es ist
  ein aktives Dokument und lief beim direkten Aufruf von `/api/images/…` auf der
  Origin der App. Externe Bild-URLs sind auf `openfoodfacts.org` beschränkt
  (`redirect: 'error'`, sonst führte eine Weiterleitung aus der Allowlist
  heraus) — sonst wäre der Server ein Sprungbrett ins Heimnetz.
- **CSP** steht in `vite.config.ts` unter `kit.csp`, **nicht** im Hook: nur dort
  bekommen SvelteKits Inline-Scripte ihren Nonce, ein selbst gesetzter Header
  müsste `'unsafe-inline'` erlauben und wäre wirkungslos. Die übrigen
  Schutzheader setzt `hooks.server.ts`. Neue externe Quellen (Schriften, Bilder,
  API-Aufrufe) brauchen dort einen Eintrag, sonst blockt der Browser sie
  stillschweigend. `wasm-unsafe-eval` ist für den Scanner nötig.
- **Barcode-Scanner:** `barcode-detector` (JS-Anbindung) und `zxing-wasm`
  (WASM-Datei) müssen **dieselbe Version** tragen; `zxing-wasm` ist nur deshalb
  eine direkte Abhängigkeit, weil die WASM-Datei mitgebaut statt von
  `fastly.jsdelivr.net` geladen wird. `src/lib/zxingVersion.test.ts` wacht
  darüber — ohne den Test fiele ein Auseinanderdriften erst am iPhone auf
  (Android Chrome nutzt den nativen BarcodeDetector und lädt gar kein WASM).
- **Dark Theme:** implementiert als gezielte Utility-Overrides in
  `src/routes/layout.css` unter `prefers-color-scheme: dark` (bewusst **nicht**
  die `--color-*`-Variablen global umbiegen — `text-white` auf Buttons muss
  hell bleiben). Neue Seiten in der bestehenden Farbwelt halten
  (gray/white/green/amber/red); neue Farbtöne brauchen einen Dark-Override.
- **Mobile (iPhone 13 mini / Galaxy A34):** `viewport-fit=cover` +
  Safe-Area-Paddings im Layout; Eingabefelder unter 768px mindestens **16px**
  Schrift (sonst zoomt iOS-Safari beim Fokussieren). Foto-Uploads brauchen
  `BODY_SIZE_LIMIT` (Default 512K von adapter-node → im Image auf 15M gesetzt).
  Kopfbereiche mit Button-Gruppen: äußeren Container `flex-wrap` lassen und
  **kein `shrink-0`** auf die Gruppe — sonst ragt sie bei 375px über den Rand
  bzw. erzwingt horizontales Scrollen (ist zweimal passiert: Rezept- und
  Artikelliste).
- **Ton (`sound.ts`):** Browser erlauben Audio erst nach einer
  Nutzerinteraktion — der AudioContext wird deshalb beim Öffnen des Scanners
  und beim ersten Tap freigeschaltet. Auf dem iPhone kann der Stummschalter
  den Ton trotzdem unterdrücken; dagegen setzt das Modul
  `navigator.audioSession.type = 'playback'` (nur Safari ≥ 16.4,
  feature-detected). `navigator.vibrate` ignoriert iOS komplett — Ton und
  Vibration ergänzen sich also, ersetzen einander nicht.
- **Android-Installierbarkeit:** `static/service-worker.js` (Passthrough, kein
  Caching) ist **Pflicht**, nicht optional — ohne registrierten Service Worker
  erkennt Chrome die Seite nicht als vollwertige PWA (WebAPK) und installiert
  stattdessen einen alten Fallback-Wrapper. Symptome davon: „für ein älteres
  Android erstellt"-Warnung beim Hinzufügen zum Startbildschirm **und**
  Kamera-Zugriff (Scanner) scheitert ohne Berechtigungsabfrage, auch nicht
  manuell in den Android-Einstellungen nachrüstbar. Icons fürs Manifest als
  PNG (192/512, `purpose: "any maskable"`) bereithalten — SVG-only wird von
  manchen Android-WebAPK-Mintern nicht zuverlässig akzeptiert.
- **Env:** Passwörter mit `#`/`$` in `.env` und `docker-compose*.yml` **quoten**
  (unquotiertes `#` wird als Kommentar abgeschnitten). Die App liest die `.env`
  im Projektstamm. Erster Admin via `ADMIN_USERNAME`/`ADMIN_PASSWORD`.
- **Nicht committen:** `local.db*`, `/data`, `/images`, `picnic-auth-key`, `.env`
  (alle gitignored). Testdaten in der lokalen DB nach Verifikation wieder
  aufräumen.
- **Versionierung & Changelog:** Die App folgt
  [Semantic Versioning](https://semver.org/lang/de/); die Version steht in
  `package.json` und wird auf der Konto-Seite angezeigt. **Jede nennenswerte
  Änderung gehört in `CHANGELOG.md`** (Format:
  [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), deutsche
  Kategorien „Hinzugefügt/Geändert/Behoben/…"): laufende Arbeit unter
  `## [Unveröffentlicht]`, beim Release daraus ein Versionsabschnitt mit Datum
  und `package.json` mitziehen. Der Eintrag gehört **in denselben Commit wie
  die Änderung** und ist ohne gesonderte Aufforderung zu pflegen (so vom
  Nutzer festgelegt) — reine Aufräumarbeiten ohne spürbare Wirkung bleiben
  außen vor. Die Datei wird per `?raw` ins Bundle gezogen
  und auf der Konto-Seite gerendert — das Docker-Image enthält nur `build/`,
  ein Lesen vom Dateisystem zur Laufzeit würde also fehlschlagen. Geparst wird
  mit `src/lib/changelog.ts` (bewusst eigener Mini-Parser, damit kein HTML aus
  der Datei in die Seite gelangt).
- **Doku wandert mit der Funktion:** Zu **jeder** Funktionsänderung oder
  -erweiterung gehören ohne gesonderte Aufforderung (so vom Nutzer festgelegt)
  drei Stellen — `CHANGELOG.md`, die **drei READMEs** (`README.md` englisch als
  Standard, `README.de.md`, `README.nl.md` — inhaltsgleich halten!) und das
  **Wiki**, sofern die Änderung für Anwender sichtbar ist. Reine
  Aufräumarbeiten ohne spürbare Wirkung bleiben überall außen vor. Das Wiki
  liegt in einem **eigenen Repository** (`Proviant.wiki.git`, klonen und
  pushen wie ein normales Repo) und ist **englisch**; es hat damit eine
  getrennte Historie und wandert nicht automatisch im selben Commit mit —
  genau deshalb steht es hier: es ist die Stelle, die beim Weiterbauen am
  leichtesten vergessen wird. Seitenstruktur: Home, Getting-started,
  Stock, Scanning, Stocktake, Items, Recipes, Meal-plan, Ordering,
  Delivery-check, Journal, Storage-locations, Users, Account, FAQ, dazu
  `_Sidebar.md` für die Navigation — eine neue Seite gehört auch dort hinein.
- **Deployment:** Push auf `main` baut per GitHub Actions das Multi-Arch-Image
  nach GHCR. `docker-compose.prod.yml` (Traefik) fürs Ziehen des Images. Der
  Workflow reicht `GIT_SHA`/`BUILD_TIME` als Build-Args ins Image; die
  Konto-Seite zeigt beides unter **Version** an. Bei „läuft mein Fix schon?"
  **immer zuerst dort nachsehen** — das war schon mehrfach die Ursache
  vermeintlicher Bugs. Ein einzelner Build dauert 3–6 Minuten; **parallele
  Runs blieben hängen** (gemeinsamer `type=gha`-Cache, überlappende
  GHCR-Tags) — einmal bis ins 6-Stunden-Timeout. Der Workflow serialisiert
  sich deshalb per `concurrency`-Gruppe; Branch und Version-Tag dürfen
  weiterhin zusammen gepusht werden, der zweite Run wartet dann einfach.
- **Logging:** SvelteKit ruft `handleError` **nur bei unerwarteten
  Ausnahmen** — alles, was per `error()` geworfen wird, gilt als „erwartet"
  und ginge sonst spurlos raus (deshalb blieb ein 500er im Betrieb einmal
  unauffindbar). `hooks.server.ts` protokolliert deshalb **am Statuscode**:
  jede Antwort ab 500 landet mit Methode, Pfad, Benutzer und Dauer im Log;
  `handleError` ergänzt Stacktrace und eine Fehler-ID, die auch auf der
  Fehlerseite steht. Neue Log-Ausgaben über `logInfo`/`logWarn`/`logError`
  aus `server/log.ts`, nicht per nacktem `console.*` — sonst fehlt der
  Zeitstempel, und im Container-Log ist nichts mehr zuzuordnen.
- **Formulare:** `use:enhance` macht standardmäßig ein `form.reset()` nach
  erfolgreichem Absenden. Svelte setzt `value`/`checked` nur als DOM-Property
  (ohne HTML-Attribut), Felder fallen dadurch auf **leer** zurück. Überall,
  wo ein Formular Daten trägt, die das Absenden überleben müssen (Mengen,
  versteckte Felder), deshalb `use:enhance={keepValues}` aus `$lib/forms`
  verwenden. Fällt beim Testen leicht durchs Raster: nach direktem
  Seitenaufruf liefert SSR echte `value`-Attribute, der Fehler zeigt sich nur
  nach App-interner Navigation.
- **„Beim testen gefundene Bugs.md":** Kommunikationskanal des Nutzers — dort
  landen beim Testen gefundene Bugs und Feature-Wünsche. Beim Abarbeiten den
  Eintrag durchstreichen und mit **✅ Behoben/Umgesetzt** samt kurzer Erklärung
  versehen, nicht löschen. Die Datei ist **gitignored** und bleibt lokal (sie
  enthält persönliche Notizen und gehört nicht ins öffentliche Repo) — sie
  fehlt also in einem frischen Klon, das ist kein Fehler.
