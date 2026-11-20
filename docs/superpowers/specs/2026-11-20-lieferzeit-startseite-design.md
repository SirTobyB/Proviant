# Lieferzeit auf der Startseite

Stand: 20.11.2026 · Umfang: kleine Änderung

## Wozu

Die Familie will auf der Startseite sehen, wann die nächste offene
Picnic-Lieferung kommt: **vorher**, um den Tag zu planen (wer muss zu Hause
sein?), und **am Liefertag**, wann der Fahrer tatsächlich da ist.

Heute gibt es nur einen 🚚-Hinweis auf der Bestellseite. Der fragt
ausschließlich die Live-Position des Fahrers ab (`getDeliveryPosition`),
die Picnic erst bei laufender Tour liefert, und zeigt nur eine Uhrzeit ohne
Datum. In der Praxis sieht man ihn also fast nie.

## Ziele

- Startseite zeigt die nächste offene Lieferung mit **Tag + gebuchtem
  Fenster** („Fr, 22.11., 18:00–19:00“) — verfügbar ab der Bestellung, aus
  `getDeliverySummaries()` (`windowStart`/`windowEnd`).
- Sobald Picnic eine Live-ETA meldet, zeigt die Karte stattdessen die
  **genaue Zeit** („Heute ca. 18:24“), das Fenster klein dahinter.
- Am Liefertag aktualisiert sich die Karte selbst, solange die Seite offen
  und sichtbar ist.
- Der Hinweis auf der Bestellseite nutzt dieselbe Logik (zeigt damit auch
  das Datum).

## Nicht-Ziele / Anti-Ziele

- Die Startseite darf durch Picnic **nicht langsamer** werden und bei einer
  Picnic-Störung nicht leiden — fällt Picnic aus, fehlt nur die Karte.
- Kein Hinweis, wenn Picnic nicht verbunden/konfiguriert ist (die Startseite
  soll nicht zum Anmelden drängen).
- Keine Karte/Route des Fahrers, kein Push.

## Ansätze

1. **Nachladen (gewählt):** Load gibt die Lieferinfo als Promise zurück,
   SvelteKit streamt sie nach (`{#await}`, wie bei den Angeboten). Lager,
   MHD und Lagerorte erscheinen unverändert sofort.
2. Direkt im Load warten: weniger Code, aber jeder Startseitenaufruf wartet
   auf Picnic, bei Störung deutlich. Verworfen.
3. Eigener API-Endpunkt + Abruf im Browser: mehr Code, bringt gegenüber 1
   nichts. Verworfen.

Vom Nutzer gewählt: **1**.

## Entwurf

- **Picnic-Adapter** (`server/picnic/index.ts`): `getDeliveryEta()` wird zu
  einer Funktion, die die nächste offene Lieferung liefert (nicht
  `COMPLETED`/`CANCELLED`, frühestes `windowStart`) mit `windowStart`,
  `windowEnd` und optional `eta`. Die Positionsabfrage läuft **nur, wenn
  das Fenster nah ist** (Beginn in weniger als ~12 h oder schon begonnen),
  und ihr Fehlschlag ist kein Fehler — dann bleibt es beim Fenster.
- **Reines Modul mit Test** (`lib/deliveryEta.ts`): Auswahl der nächsten
  Lieferung, Entscheidung „Live-Abfrage nötig?“, Ob/wann neu laden
  (nur am Liefertag bzw. bei nahem Fenster) und die Anzeigeform
  (heute/morgen/Wochentag + Datum, Fenster vs. genaue Zeit).
- **Startseite**: `+page.server.ts` gibt `delivery` als Promise zurück (nur
  wenn `getConnectionState() === 'connected'`, Fehler → `null`). Die Karte
  steht oben, über „Bald ablaufend“. Am Liefertag ruft die Seite alle ~2
  Minuten `invalidate` für genau diese Daten auf, nur bei sichtbarem Tab.
- **Bestellseite**: nutzt dieselbe Funktion und Anzeigeform.
- Texte in `i18n/messages` (en/de/nl), Doku: CHANGELOG, drei READMEs, Wiki
  (Stock bzw. Ordering).

## Entscheidungen von Claude (bitte prüfen)

- Mehrere offene Lieferungen → nur die nächste.
- Live-Abfrage ab ~12 h vor Fensterbeginn, Auto-Aktualisierung alle ~2 min.
- Ohne Picnic-Verbindung: keine Karte, kein Hinweis.
