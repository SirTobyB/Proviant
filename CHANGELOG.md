# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei
dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
und dieses Projekt hält sich an [Semantic Versioning](https://semver.org/lang/de/).

## [Unveröffentlicht]

## [2.1.0] - 2026-08-15

Diese Fassung dreht sich um den Lieferungs-Check. Zu tun ist beim Aktualisieren
nichts: keine Migration, keine neue Einstellung — `docker compose pull` genügt.

### Hinzugefügt

- **Von Picnic stornierte Positionen werden erkannt.** Meldet Picnic, dass ein
  Artikel nicht mitkommt (nicht vorrätig, Qualität, nicht verladen), zählt er
  beim Lieferungs-Check nicht mehr zum Soll und steht mit Grund als „nicht
  geliefert" in der Liste. Auf der Bestellseite gilt er nicht länger als
  „unterwegs" und wird wieder zum Nachbestellen vorgeschlagen — vorher blieb er
  bis zur nächsten Lieferung unsichtbar, obwohl er nie ankam.
- **Abschluss der Lieferungsprüfung mit Fehlbestand.** Fehlt am Ende etwas,
  lässt sich die Prüfung jetzt bewusst abschließen: Die fehlenden Gebinde
  werden aufgelistet und nach Bestätigung als neue Buchungsart „Nicht
  geliefert" ins Journal geschrieben (ohne Bestandswirkung). Vorher endete eine
  unvollständige Lieferung ohne jeden Abschluss.

### Behoben

- **Die −-Taste beim Lieferungs-Check bucht wieder aus.** Sie korrigierte nur
  den Zähler auf der Seite, während die mit + eingebuchte Menge im Lager stehen
  blieb — die Seite zeigte „0 geprüft", der Bestand war trotzdem da.
  Zurückgenommen wird genau die zuvor gebuchte Charge (nicht per FEFO
  irgendeine andere), damit im Journal der richtige Lagerplatz steht.

## [2.0.0] - 2026-08-14

Die App heißt ab dieser Fassung **Proviant**. Für bestehende Installationen ist
das die einzige Stelle, die Handarbeit braucht: Der Image-Pfad lautet jetzt
`ghcr.io/sirtobyb/proviant`, ein `docker compose pull` gegen den alten Pfad
liefert ab hier keine Aktualisierungen mehr. Übernimm dazu die neue
`docker-compose.prod.yml` (der Container heißt darin ebenfalls `proviant`) und
trage deine Domain und die Picnic-Zugangsdaten wieder ein. Datenbank, Bilder und
der Picnic-Auth-Key im Volume bleiben unverändert — zu migrieren gibt es nichts.

### Hinzugefügt

- **Mehrsprachige Oberfläche: Englisch, Deutsch und Niederländisch.** Die
  Sprache wird auf der Konto-Seite gewählt, je Benutzer gespeichert und gilt
  auf allen Geräten. Voreingestellt ist „Systemsprache" — dann folgt die App
  der Spracheinstellung des Browsers, ansonsten gilt Englisch. Übersetzt sind
  **alle Seiten** samt Meldungen, Platzhaltern und Screenreader-Beschriftungen;
  Datum, Wochentage, Zahlen, Preise und Ein-/Mehrzahl folgen der Sprache
  (en-GB: 14/08/2026, 0.7 l, €1.69). Nicht übersetzt werden bewusst die eigenen
  Daten — Artikel, Tags, Rezepte und Lagerortnamen bleiben, wie sie eingegeben
  wurden — sowie dieser Changelog.

### Geändert

- **Die App heißt jetzt „Proviant".** Der bisherige Name war nur auf Deutsch
  verständlich, während die Oberfläche englisch voreingestellt ist; „Proviant"
  steht so im Deutschen wie im Niederländischen und ist für Englischsprachige
  erschließbar. Betroffen sind Oberfläche, Homescreen-Symbol, Repository und
  Image-Pfad (`ghcr.io/sirtobyb/proviant`). Der Dateiname der Datenbank im
  Volume bleibt bewusst unverändert — sonst legte die App beim nächsten Start
  eine leere Datenbank an.
- Die fünf **vorgegebenen Lagerorte** heißen bei einer Neuinstallation jetzt
  englisch (Kitchen cupboard, Fridge, Freezer, Pantry shelf, Drinks cellar) —
  passend zur Standardsprache. Bestehende Installationen bleiben unberührt,
  und umbenennen lässt sich jeder Lagerort ohnehin unter „Lagerorte".

### Sicherheit

- **Schutz gegen Durchprobieren von Passwörtern.** Nach fünf Fehlversuchen wird
  die Anmeldung für den betroffenen Benutzernamen gesperrt — zunächst eine
  Minute, mit jedem weiteren Fehlversuch doppelt so lang, höchstens eine
  Viertelstunde. Eine erfolgreiche Anmeldung setzt die Zählung zurück, ebenso
  eine Stunde ohne weiteren Versuch; ein Vertipper bleibt also folgenlos. Die
  Sperre gilt bewusst nur auf Zeit: Eine dauerhafte ließe sich missbrauchen, um
  Familienmitglieder auszusperren.
- **Anmeldung verrät nicht mehr, welche Benutzernamen es gibt.** Bei einem
  unbekannten Namen kam die Antwort bisher sofort, bei einem bekannten erst nach
  der Passwortprüfung — an diesem Zeitunterschied ließen sich vorhandene Konten
  ablesen. Beide Fälle brauchen jetzt gleich lang.
- **Bilder werden am Inhalt geprüft, nicht an der Angabe des Absenders.** Bisher
  entschied der vom Browser mitgeschickte Dateityp darüber, wie eine hochgeladene
  Datei abgelegt wird — der ist frei wählbar, und SVG war erlaubt. Damit ließ
  sich eine Datei mit `<script>` als Artikelbild hinterlegen, die beim direkten
  Aufruf ihrer Adresse im Browser lief und dort im Namen der angemeldeten Person
  handeln konnte. Erlaubt sind jetzt JPEG, PNG, GIF und WebP, erkannt an ihrer
  Signatur; SVG gar nicht mehr. Bereits abgelegte SVG-Dateien werden nicht mehr
  als Bild ausgeliefert.
- **Die Bild-URL beim Artikelanlegen ist auf Open Food Facts beschränkt.** Das
  Feld ging ungeprüft in einen Server-Aufruf. Wer es von Hand füllte, konnte den
  Server Adressen im Heimnetz abfragen lassen, die von außen nicht erreichbar
  sind, und an den Fehlermeldungen ablesen, was dort antwortet. Weiterleitungen
  führen aus der erlaubten Quelle nicht mehr heraus.
- **Schutzheader für jede Antwort**: Content-Security-Policy (mit Nonce für die
  von SvelteKit erzeugten Scripte), `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options` und — nur bei Zugriff über TLS — HSTS.
- **Der Barcode-Scanner lädt seine WebAssembly-Datei aus dem eigenen Build.**
  Voreingestellt holt `zxing-wasm` sie zur Laufzeit von `fastly.jsdelivr.net`:
  die App führte damit Code aus einer fremden Quelle aus, jeder Scan meldete die
  IP-Adresse dorthin, und ohne Internetzugang blieb der Scanner überall dort
  stehen, wo es keinen eingebauten BarcodeDetector gibt (iPhone).
- Abhängigkeiten mit bekannten Schwachstellen aktualisiert (`@sveltejs/kit`,
  `postcss`, `nanoid`). Neue Abhängigkeiten hält ab jetzt Dependabot aktuell.

## [1.2.0] - 2026-08-14

### Hinzugefügt

- **Lagerorte als Stammdaten** unter „Lagerorte" (nur Admin): anlegen,
  umbenennen und in der Reihenfolge verschieben — bisher waren die fünf
  Lagerorte fest im Code hinterlegt. Statt zu löschen werden Lagerorte
  **stillgelegt**: sie verschwinden aus allen Auswahllisten und von der
  Startseite, ihre Bestandshistorie und die Journalzeilen bleiben aber
  lesbar. Stilllegen setzt einen leeren Lagerort voraus und entfernt den
  Standard-Lagerort bei betroffenen Artikeln. Der Lagerort-Filter im
  Buchungsjournal zeigt weiterhin auch stillgelegte Lagerorte, solange
  Buchungen zu ihnen existieren.

## [1.1.0] - 2026-08-14

### Hinzugefügt

- **Buchungsjournal** unter „Journal": Jede Bestandsveränderung wird mit
  Zeitpunkt, Benutzer, Artikel, Menge und Lagerort festgehalten — Zu- und
  Abgänge, Umlagerungen (mit Von-/Nach-Lagerort) und Chargen-Korrekturen
  inklusive MHD-Änderungen. Filterbar nach Artikel, Lagerort, Benutzer und
  Buchungsart; die Herkunft (Scanner, Inventur, Lieferung, Artikelliste,
  Charge) steht an jeder Zeile. Das Journal beginnt mit der Einführung —
  frühere Buchungen lassen sich nicht rekonstruieren, da sie nie
  gespeichert wurden.

## [1.0.0] - 2026-08-13

Erste versionierte Fassung — der bisherige Funktionsumfang als Ausgangspunkt.

### Hinzugefügt

- **Lagerverwaltung** mit fünf Lagerorten, geführt als Chargen mit eigenem MHD,
  MHD-Ampel und „Läuft bald ab"-Ansicht. Schnellkorrektur mit +/− in der
  Artikelliste und je Charge in der Lagerort-Ansicht, Umlagern zwischen
  Lagerorten.
- **Inventur** mit Lagerort-Aufschlüsselung: gezählten Bestand eintragen, die
  Differenz wird automatisch gebucht (Zugang in den Standard-Lagerort, Abgang
  nach nächstem MHD zuerst).
- **Artikelstamm** mit Bild, Gebindegröße, EAN, Mindestbestand,
  Standard-Lagerort und frei vergebbaren Tags. Neuanlage per Barcode-Scan,
  Vorbefüllung über Open Food Facts und Picnic.
- **Barcode-Scanner** zum Ein- und Ausbuchen, mit Signalton und Vibration bei
  erkanntem Code.
- **Bestellvorschläge** für Artikel unter Mindestbestand, abgeglichen mit dem
  Picnic-Warenkorb und noch nicht gelieferten Bestellungen. Bestellt wird nie
  automatisch — der Checkout bleibt in der Picnic-App.
- **Lieferungs-Check** zum Auspacken: Positionen scannen oder per Sichtprüfung
  bestätigen, noch unbekannte Produkte werden dabei automatisch als Artikel
  angelegt.
- **Rezepte** mit Zutaten aus dem Artikelstamm (mehrere Alternativartikel je
  Zutat möglich), Kochbarkeits-Prüfung gegen den Vorrat, Portionsskalierung,
  Tags, Zufallsvorschlag und Import aus Picnic.
- **Wochenplan** für sieben Tage mit gebündelter Einkaufsliste, die den Vorrat
  über die ganze Woche verrechnet.
- **Benutzerverwaltung** mit Rollen und Audit-Feldern auf allen Datensätzen.
- **Versionsanzeige** auf der Konto-Seite mit Build-Zeitpunkt und Commit,
  darunter dieser Changelog.
- **Fehlerprotokollierung** mit Zeitstempel, Pfad und Fehler-ID im
  Container-Log.

[Unveröffentlicht]: https://github.com/SirTobyB/Proviant/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/SirTobyB/Proviant/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/SirTobyB/Proviant/compare/v1.2.0...v2.0.0
[1.2.0]: https://github.com/SirTobyB/Proviant/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/SirTobyB/Proviant/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/SirTobyB/Proviant/releases/tag/v1.0.0
