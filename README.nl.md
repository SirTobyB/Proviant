[English](README.md) · [Deutsch](README.de.md) · **Nederlands**

# Proviant

Zelfgehoste webapp voor het beheren van de boodschappen van een gezin:
voorraadbeheer voor kelder en keuken, bestelsuggesties en leveringscontrole via
bezorgdienst Picnic, plus de receptenverzameling van het gezin. Gemaakt voor de
telefoon (PWA, licht & donker volgens de systeeminstelling), met een
desktopweergave.

> **Voor wie is dit?** Voor huishoudens die hun voorraad zelf willen beheren
> zonder die aan een dienst van iemand anders toe te vertrouwen — alles draait
> op je eigen server en de gegevens staan in één SQLite-bestand. De
> Picnic-functies vereisen een account bij bezorgdienst
> [Picnic](https://picnic.app) (Duitsland, Nederland, Frankrijk); zonder
> Picnic-account werkt al het andere — voorraad, inventarisatie, artikelbeheer,
> recepten, weekplanning, journaal — onveranderd. De koppeling gebruikt de
> onofficiële bibliotheek [picnic-api](https://github.com/MRVDH/picnic-api);
> Picnic biedt geen officiële API, dus wijzigingen aan hun kant kunnen deze
> functies op elk moment breken. Er wordt bewust nooit automatisch besteld.

📖 **[Handleiding in de wiki](https://github.com/SirTobyB/Proviant/wiki)**
(Engels) — installatie, dagelijks gebruik, recepten en weekplanning, de
Picnic-functies en een FAQ voor probleemoplossing.

## Schermafbeeldingen

<table>
  <tr>
    <td width="25%"><img src="doc/screenshots/lager_v1.2.0.png" alt="Voorraadoverzicht in het donkere thema" width="100%"></td>
    <td width="25%"><img src="doc/screenshots/lager_hell_v1.2.0.png" alt="Dezelfde weergave in het lichte thema" width="100%"></td>
    <td width="25%"><img src="doc/screenshots/rezepte_v1.2.0.png" alt="Receptenlijst met kookbaarheidslabel" width="100%"></td>
    <td width="25%"><img src="doc/screenshots/bestellen_picnic_v1.2.0.png" alt="Bestelsuggesties voor het Picnic-mandje" width="100%"></td>
  </tr>
  <tr>
    <td>Voorraad met THT-waarschuwing</td>
    <td>Licht thema</td>
    <td>Recepten, „kookbaar" gemarkeerd</td>
    <td>Bestelsuggesties</td>
  </tr>
</table>

## Functies

- **Interface in het Engels, Duits of Nederlands** — per gebruiker gekozen op
  de accountpagina en geldig op elk apparaat. Standaard staat het op
  „systeemtaal": de app volgt de instelling van de browser, anders geldt
  Engels. Datum, weekdagen, getallen, prijzen en enkel-/meervoud volgen de taal
  mee. Je eigen gegevens — artikelen, tags, recepten en locatienamen — blijven
  precies zoals je ze hebt ingevoerd.
- **Inloggen & gebruikers** — gebruikersnaam + wachtwoord (scrypt-hashing),
  rollen gebruiker/beheerder. Alleen beheerders beheren gebruikers; iedereen
  kan zijn eigen wachtwoord wijzigen. Elk record bevat de aanmakende/wijzigende
  gebruiker en tijdstempels (audit). De accountpagina toont onder **Versie** de
  app-versie, het buildmoment en de commit van de draaiende instantie — handig
  om te controleren of de server werkelijk de verwachte versie draait — en
  daaronder de **changelog**.
- **Voorraadbeheer** — voorraad in vrij te beheren voorraadlocaties (standaard
  keukenkast, koelkast, vriezer, voorraadrek en drankenkelder), bijgehouden als
  partijen met een eigen THT-datum. In- en uitboeken met de barcodescanner
  (FEFO bij uitboeken), THT-stoplicht en een overzicht „verloopt binnenkort".
  Snelle +/−-correctie met een vrij te kiezen aantal in de artikellijst, en per
  partij met één tik in de locatieweergave (0 verwijdert de partij); partijen
  zijn te bewerken en tussen locaties te verplaatsen.
- **Voorraadlocaties** (beheerder) — aanmaken, hernoemen en de volgorde
  wijzigen. Er wordt nooit verwijderd, alleen **buiten gebruik gesteld**: een
  buiten gebruik gestelde locatie verdwijnt uit elke keuzelijst, terwijl haar
  voorraadhistorie en journaalregels leesbaar blijven. Buiten gebruik stellen
  vereist een lege locatie en wist die als standaardlocatie bij de betrokken
  artikelen.
- **Boekingsjournaal** — elke voorraadwijziging wordt vastgelegd: tijdstip,
  gebruiker, artikel, aantal en locatie, plus waar de boeking vandaan kwam
  (scanner, inventarisatie, levering, artikellijst, partij). Bij- en
  afboekingen, verplaatsingen (met bron- en doellocatie) en partijcorrecties
  inclusief THT-wijzigingen; een afboeking over meerdere partijen verschijnt
  per partij met de bijbehorende locatie. Te filteren op artikel, locatie,
  gebruiker en boekingssoort. Verwijderde artikelen blijven op naam leesbaar.
- **Inventarisatie** — een compact overzicht van de volledige voorraad,
  uitgesplitst per locatie. Voer het getelde totaal in en het verschil wordt
  automatisch geboekt (overschot naar de standaardlocatie, tekort volgens FEFO
  uitgeboekt). Te filteren op zoekterm en artikeltags.
- **Artikelbeheer** — naam, afbeelding, verpakkingsgrootte met eenheid, EAN,
  optioneel Picnic-artikelnummer (via zoeken of rechtstreeks ingevoerd),
  minimumvoorraad, standaardlocatie en vrij te kiezen tags (met filters in de
  artikellijst en de inventarisatie). Nieuwe artikelen via barcodescan,
  voorgevuld met Open Food Facts en het Picnic-productzoeken. De artikelpagina
  toont alle partijen over alle locaties, direct te bewerken en te verplaatsen.
  **Import uit bestellingen:** neemt producten uit recente Picnic-leveringen
  over inclusief afbeelding, verpakkingsgrootte en koppeling (stuk voor stuk
  tijdens het uitpakken of gebundeld onder *Artikelen → Picnic-import*; EAN's
  levert Picnic niet).
- **Bestelsuggesties** — artikelen onder hun minimumvoorraad komen op de
  suggestielijst en gaan na bevestiging naar het Picnic-mandje
  ([picnic-api](https://github.com/MRVDH/picnic-api), onofficieel). Er wordt
  bewust nooit automatisch besteld — afrekenen blijft in de Picnic-app.
  Suggesties worden afgestemd op het **mandje en nog niet geleverde
  bestellingen**, tot op het aantal nauwkeurig: wat al gereserveerd is of
  onderweg, wordt alleen nog als resterend tekort voorgesteld (of helemaal
  niet meer). Alle suggesties zijn met één klik aan en uit te vinken.
- **Leveringscontrole** — tijdens het uitpakken van een Picnic-levering: regels
  scannen met de barcode (gekoppeld via het Picnic-artikelnummer) en meteen op
  de doellocatie inboeken, per stuk bevestigen met de +-knop, of na visuele
  controle alle openstaande regels in één keer. Nog onbekende producten worden
  daarbij automatisch als artikel aangemaakt (inclusief afbeelding en
  verpakkingsgrootte). Toont de productafbeeldingen van Picnic.
- **Recepten** — warme maaltijden en taarten, ingrediënten gekoppeld aan het
  artikelbeheer of als vrije tekst, vrij te kiezen tags. Eén ingrediënt kan
  meerdere alternatieve artikelen accepteren (bijvoorbeeld verschillende
  soorten eieren) — de voorraad van alle alternatieven wordt opgeteld.
  Kookbaarheidscontrole tegen de voorraad („wat kan ik vandaag koken?"),
  schalen van porties en „ontbrekende ingrediënten in het Picnic-mandje"
  (afgerond op verpakkingsgroottes). Willekeurige receptsuggestie met een
  blokkade van twee weken voor wat recent gekookt is, optioneel op tag.
  **Import uit Picnic:** neemt recepten van de Picnic-receptpagina's over
  inclusief porties, ingrediënten, stappen en tip (*Recepten →
  Picnic-import*).
- **Weekplanning** — maaltijden plannen voor de komende 7 dagen: dagen kiezen
  en suggesties dobbelen (geen recept twee keer in dezelfde week), dagen
  handmatig invullen, porties aanpassen — en de ontbrekende ingrediënten van
  **alle** geplande dagen in één keer in het Picnic-mandje leggen. De gedeelde
  voorraad wordt daarbij over de hele week verrekend (niets dubbel geteld, geen
  onnodige herhaalbestellingen van hetzelfde artikel).

## Versiebeheer

De app volgt [Semantic Versioning](https://semver.org). Wijzigingen worden
bijgehouden in [CHANGELOG.md](CHANGELOG.md) volgens [Keep a
Changelog](https://keepachangelog.com/en/1.1.0/); dezelfde inhoud verschijnt in
de app op de accountpagina.

## Stack

SvelteKit (adapter-node) · TypeScript · SQLite (better-sqlite3 + Drizzle ORM) ·
Tailwind CSS · PWA · Docker (amd64 + arm64)

Geoptimaliseerd voor smalle telefoons (iPhone 13 mini, Galaxy A34): safe areas
voor notch en home-indicator, invoervelden van 16px tegen de automatische zoom
van iOS, beginschermpictogrammen voor iOS en Android. Het donkere thema volgt
automatisch de instelling van het apparaat. Een herkende barcode wordt bevestigd
met een korte pieptoon (gegenereerd via Web Audio) en trillen — dat laatste
negeert iOS, vandaar het geluid. Staat de iPhone op stil, dan kan iOS ook het
geluid onderdrukken.

## Ontwikkeling

Vereist **Node.js ≥ 22.12** (Vite 8).

```sh
cp .env.example .env      # waarden aanpassen (zie hieronder)
npm install
npm run dev
```

De SQLite-database (`local.db`) wordt bij de eerste start aangemaakt en
gemigreerd. Bestaat er nog geen gebruiker, dan wordt uit
`ADMIN_USERNAME`/`ADMIN_PASSWORD` een beheerder aangemaakt — zonder die
variabelen kom je de app niet in.

Handige scripts:

| Commando             | Doel                                                |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Ontwikkelserver (poort 5173)                        |
| `npm run build`      | Productiebuild (adapter-node)                       |
| `npm run check`      | Typecontrole (`svelte-check`)                       |
| `npm test`           | Tests van de logicamodules (Vitest)                 |
| `npm run db:generate`| Migratie uit het schema genereren (na schemawijziging) |

## Draaien met Docker

```sh
docker compose up -d                              # lokaal bouwen
# of voor productie het kant-en-klare GHCR-image:
docker compose -f docker-compose.prod.yml up -d
```

De app luistert op poort 3000; alle persistente gegevens (database,
afbeeldingen, Picnic-auth-key) staan in het volume `./data`. Migraties en de
seed voor voorraadlocaties en beheerder draaien automatisch bij het starten van
de container.

Bij het opstarten schrijft de app een regel met commit en buildmoment naar het
containerlog (bijvoorbeeld zichtbaar in Portainer) — een onopgemerkte herstart
valt daardoor meteen op. Elke foutrespons vanaf status 500 wordt gelogd met
tijdstempel, pad, gebruiker en duur; bij onverwachte uitzonderingen bovendien
met stacktrace en een korte fout-ID die ook op de foutpagina staat. Blijft het
log stil bij een storing, dan lag het niet aan de app. Images worden via GitHub
Actions voor amd64 en arm64 naar GHCR gepubliceerd:
`ghcr.io/sirtobyb/proviant:latest`. `docker-compose.prod.yml` bevat
Traefik-labels (extern netwerk `proxy`, websecure, certresolver
`tls_resolver`).

### De eerste verbinding met Picnic

Verbind bij het eerste bezoek aan **Bestellen** eenmalig met Picnic (inloggen +
sms-2FA). De auth-key wordt in het volume opgeslagen en overleeft herstarts;
daarna is 2FA nog maar zelden nodig. Zonder verbinding werken
bestelsuggesties, leveringscontrole en het receptenmandje niet.

### Omgevingsvariabelen

| Variabele         | Beschrijving                                            | Standaard (container)         |
| ----------------- | ------------------------------------------------------- | ----------------------------- |
| `DATABASE_URL`    | Pad naar het SQLite-bestand                             | `/data/lebensmittelkumpel.db` |
| `DATA_DIR`        | Map voor afbeeldingen en de Picnic-auth-key             | `/data`                       |
| `ORIGIN`          | Publieke URL van de app (CSRF-bescherming adapter-node) | —                             |
| `ADMIN_USERNAME`  | Eerste beheerder (alleen bij eerste start zonder gebruikers) | —                        |
| `ADMIN_PASSWORD`  | Wachtwoord van de eerste beheerder                      | —                             |
| `ADMIN_EMAIL`     | E-mail van de eerste beheerder (optioneel)              | —                             |
| `PICNIC_USERNAME` | Picnic-inloggegevens voor mandje, leveringen, zoeken    | —                             |
| `PICNIC_PASSWORD` |                                                         | —                             |
| `BODY_SIZE_LIMIT` | Maximale requestgrootte (foto-uploads!)                 | `15M`                         |
| `GIT_SHA` · `BUILD_TIME` | Worden bij de CI-build als build-args in het image gezet en op de accountpagina onder **Versie** getoond — zo controleer je of de server de verwachte versie draait. Lokaal niet gezet → „lokale build". | — |

> **Wachtwoorden met speciale tekens** (`#`, `$` …) moeten in `.env` en in
> `docker-compose*.yml` altijd tussen aanhalingstekens staan — een `#` zonder
> aanhalingstekens wordt anders als commentaar afgekapt.

## Meedoen

Foutmeldingen en verbetervoorstellen zijn welkom als
[issue](https://github.com/SirTobyB/Proviant/issues). Draai vóór een
pull request `npm run check`, `npm test` en `npm run build`. Commentaar en
commitberichten zijn in het Duits; de conventies van het project staan in
[CLAUDE.md](CLAUDE.md).

## Licentie

[MIT](LICENSE) — vrij te gebruiken, aan te passen en te verspreiden, zonder
garantie. De pictogrammen komen van [Heroicons](https://heroicons.com) (MIT).
