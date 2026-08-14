# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei
dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
und dieses Projekt hält sich an [Semantic Versioning](https://semver.org/lang/de/).

## [Unveröffentlicht]

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

- Die fünf **vorgegebenen Lagerorte** heißen bei einer Neuinstallation jetzt
  englisch (Kitchen cupboard, Fridge, Freezer, Pantry shelf, Drinks cellar) —
  passend zur Standardsprache. Bestehende Installationen bleiben unberührt,
  und umbenennen lässt sich jeder Lagerort ohnehin unter „Lagerorte".

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

[Unveröffentlicht]: https://github.com/SirTobyB/LebensmittelKumpel/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/SirTobyB/LebensmittelKumpel/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/SirTobyB/LebensmittelKumpel/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/SirTobyB/LebensmittelKumpel/releases/tag/v1.0.0
