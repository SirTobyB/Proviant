**English** · [Deutsch](README.de.md) · [Nederlands](README.nl.md)

# Proviant

Self-hosted web app for managing a family's groceries: stock control for the
pantry and the cellar, order suggestions and delivery check-in via the Picnic
delivery service, plus the family recipe collection. Built for phones (PWA,
light & dark following the system setting), with a desktop layout.

> **Who is this for?** Households that want to manage their own supplies
> without handing them to somebody else's service — everything runs on your own
> server and the data lives in a single SQLite file. The Picnic features
> require an account with the delivery service [Picnic](https://picnic.app)
> (Germany, Netherlands, France); without one, everything else — stock,
> stocktake, item catalogue, recipes, meal plan, journal — works unchanged. The
> integration uses the unofficial library
> [picnic-api](https://github.com/MRVDH/picnic-api); Picnic offers no official
> API, so changes on their side can break these features at any time. Orders
> are never placed automatically, by design.

📖 **[User guide in the wiki](https://github.com/SirTobyB/Proviant/wiki)** —
installation, everyday use, recipes and meal planning, the Picnic features and
a troubleshooting FAQ.

## Screenshots

<table>
  <tr>
    <td width="25%"><img src="doc/screenshots/lager_v1.2.0.png" alt="Stock overview in the dark theme" width="100%"></td>
    <td width="25%"><img src="doc/screenshots/lager_hell_v1.2.0.png" alt="The same view in the light theme" width="100%"></td>
    <td width="25%"><img src="doc/screenshots/rezepte_v1.2.0.png" alt="Recipe list with cookability badge" width="100%"></td>
    <td width="25%"><img src="doc/screenshots/bestellen_picnic_v1.2.0.png" alt="Order suggestions for the Picnic basket" width="100%"></td>
  </tr>
  <tr>
    <td>Stock with best-before warning</td>
    <td>Light theme</td>
    <td>Recipes, "cookable" flagged</td>
    <td>Order suggestions</td>
  </tr>
</table>

## Features

- **Interface in English, German or Dutch** — chosen per user on the account
  page and applied on every device. The default is "system language": the app
  follows the browser's setting, falling back to English. Dates, weekdays,
  numbers, prices and singular/plural follow the language too. Your own data —
  items, tags, recipes and location names — stays exactly as you typed it.
- **Login & users** — username + password (scrypt hashing), roles user/admin.
  Only admins manage users; everyone can change their own password. Every
  record carries the creating/modifying user and timestamps (audit). The
  account page shows the app version, build time and commit of the running
  instance under **Version** — handy for checking whether the server really
  runs the build you expect — and the **changelog** below it.
- **Stock management** — stock held in freely editable storage locations
  (kitchen cupboard, fridge, freezer, pantry shelf and drinks cellar out of the
  box), tracked as batches with their own best-before date. Book in and out by
  barcode scan (FEFO when booking out), best-before traffic light and an
  "expiring soon" view. Quick +/− correction with a freely chosen amount right
  in the item list, and per batch with a single tap in the location view (0
  removes the batch); batches can be edited and moved between locations.
- **Storage locations** (admin) — create, rename and reorder them. Nothing is
  ever deleted, only **retired**: a retired location disappears from every
  picker, while its stock history and journal entries stay readable. Retiring
  requires the location to be empty, and clears it as the default location of
  any affected items.
- **Stock journal** — every change to stock is recorded: time, user, item,
  quantity and location, plus where the booking came from (scanner, stocktake,
  delivery, item list, batch). Additions and removals, relocations (with source
  and target location), batch corrections including best-before changes, and
  packs ordered but **not delivered** (recorded without touching stock); a
  removal spanning several batches appears once per batch with its location.
  Filterable by item, location, user and booking type. Deleted items remain
  readable by name.
- **Stocktake** — a compact overview of everything in stock, broken down by
  location. Enter the counted total and the difference is booked automatically
  (surplus into the default location, shortfall booked out FEFO). Filterable by
  search and item tags.
- **Item catalogue** — name, picture, pack size with unit, EAN, optional Picnic
  product ID (via search or entered directly), minimum stock, default location
  and free-form tags (with filters in the item list and stocktake). Create
  items by barcode scan, pre-filled from Open Food Facts and the Picnic product
  search. The item page lists all batches across every location, editable and
  movable in place. **Import from orders:** pulls products out of recent Picnic
  deliveries including picture, pack size and the link (one by one while
  unpacking, or in bulk under *Items → Picnic import*; Picnic does not supply
  EANs).
- **Order suggestions** — items below their minimum stock appear on the
  suggestion list and, once confirmed, move into the Picnic basket
  ([picnic-api](https://github.com/MRVDH/picnic-api), unofficial). Orders are
  never placed automatically — checkout stays in the Picnic app. Suggestions
  are reconciled against the **basket and orders not yet delivered**, down to
  the quantity: whatever is already reserved or on its way is only suggested as
  the remaining shortfall (or not at all). Lines Picnic has cancelled do not
  count as on their way, so they are suggested again instead of quietly
  disappearing until the next delivery. All suggestions can be selected and
  deselected with one click.
- **Delivery check-in** — while unpacking a Picnic delivery: scan items by
  barcode (matched via the Picnic ID) and book them straight into the target
  location, confirm them individually with the + button, or confirm all
  remaining lines at once after a visual check. The − button takes the last
  booking back and books it out again — off the very batch it came from, so the
  journal keeps naming the right location. Products not yet known are created
  as items automatically (with picture and pack size). Lines that Picnic
  **cancelled** (out of stock, quality, not shipped) no longer count towards
  what is expected and are shown as *not delivered* with the reason. If
  something is missing at the end, the check can be closed deliberately: the
  missing packs are listed and recorded in the journal as *not delivered* — no
  stock is booked for them. Shows the product images from Picnic.
- **Recipes** — hot meals and cakes, ingredients linked to the item catalogue
  or as free text, free-form tags. One ingredient can accept several
  alternative items (say, different kinds of eggs) — the stock of all
  alternatives is added up. Cookability check against your stock ("what can I
  cook today?"), portion scaling and "missing ingredients into the Picnic
  basket" (rounded up to pack sizes). Random recipe suggestion with a two-week
  cooldown for anything cooked recently, optionally filtered by tag. **Import
  from Picnic:** pulls recipes off the Picnic recipe pages including portions,
  ingredients, steps and tip (*Recipes → Picnic import*).
- **Weekly meal plan** — plan meals for the next 7 days: pick the days and roll
  suggestions (no recipe twice in one week), fill days manually, adjust
  portions — and put the missing ingredients for **all** planned days into the
  Picnic basket in one go. Shared stock is accounted for across the whole week
  (no double counting, no needless repeat orders of the same item).

## Versioning

The app follows [Semantic Versioning](https://semver.org). Changes are kept in
[CHANGELOG.md](CHANGELOG.md) following [Keep a
Changelog](https://keepachangelog.com/en/1.1.0/); the same content is rendered
in the app on the account page.

## Stack

SvelteKit (adapter-node) · TypeScript · SQLite (better-sqlite3 + Drizzle ORM) ·
Tailwind CSS · PWA · Docker (amd64 + arm64)

Tuned for narrow phones (iPhone 13 mini, Galaxy A34): safe areas for notch and
home indicator, 16px inputs to stop iOS auto-zoom, home screen icons for iOS
and Android. The dark theme follows the device setting automatically. A
recognised barcode is acknowledged with a short beep (generated via Web Audio)
and vibration — iOS ignores the latter, hence the sound. With the iPhone on
silent, iOS may suppress the sound as well.

## Development

Requires **Node.js ≥ 22.12** (Vite 8).

```sh
cp .env.example .env      # adjust the values (see below)
npm install
npm run dev
```

The SQLite database (`local.db`) is created and migrated on first start. If no
user exists, an admin is created from `ADMIN_USERNAME`/`ADMIN_PASSWORD` —
without those variables there is no way into the app.

Useful scripts:

| Command              | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Dev server (port 5173)                              |
| `npm run build`      | Production build (adapter-node)                     |
| `npm run check`      | Type check (`svelte-check`)                         |
| `npm test`           | Tests of the logic modules (Vitest)                 |
| `npm run db:generate`| Generate a migration from the schema (after schema changes) |

## Running with Docker

```sh
docker compose up -d                              # build locally
# or pull the ready-made GHCR image for production:
docker compose -f docker-compose.prod.yml up -d
```

The app listens on port 3000; all persistent data (database, images, Picnic
auth key) lives in the `./data` volume. Migrations and the storage location /
admin seed run automatically on container start.

On start-up the app writes a line with commit and build time to the container
log (visible in Portainer, for instance) — an unnoticed restart stands out
immediately. Every error response of status 500 or above is logged with
timestamp, path, user and duration; unexpected exceptions additionally with a
stack trace and a short error ID that also appears on the error page. If the
log stays quiet during a failure, the app was not the cause. Images are
published to GHCR for amd64 and arm64 via GitHub Actions:
`ghcr.io/sirtobyb/proviant:latest`. `docker-compose.prod.yml` carries
Traefik labels (external network `proxy`, websecure, cert resolver
`tls_resolver`).

### Connecting to Picnic the first time

The first time you open **Order**, connect to Picnic once (login + SMS 2FA).
The auth key is stored in the volume and survives restarts; 2FA is rarely
needed afterwards. Without a connection, order suggestions, delivery check-in
and the recipe basket do not work.

### Environment variables

| Variable          | Description                                            | Default (container)           |
| ----------------- | ------------------------------------------------------ | ----------------------------- |
| `DATABASE_URL`    | Path to the SQLite file                                | `/data/lebensmittelkumpel.db` |
| `DATA_DIR`        | Directory for images and the Picnic auth key           | `/data`                       |
| `ORIGIN`          | Public URL of the app (adapter-node CSRF protection)   | —                             |
| `ADMIN_USERNAME`  | First admin (only on first start with no users)        | —                             |
| `ADMIN_PASSWORD`  | Password of the first admin                            | —                             |
| `ADMIN_EMAIL`     | Email of the first admin (optional)                    | —                             |
| `PICNIC_USERNAME` | Picnic credentials for basket, deliveries, search      | —                             |
| `PICNIC_PASSWORD` |                                                        | —                             |
| `BODY_SIZE_LIMIT` | Max request size (photo uploads!)                      | `15M`                         |
| `GIT_SHA` · `BUILD_TIME` | Set as build args during the CI build and shown on the account page under **Version** — that is how you check whether the server runs the build you expect. Unset locally → "local build". | — |

> **Passwords containing special characters** (`#`, `$` …) must be quoted in
> `.env` and in `docker-compose*.yml` — an unquoted `#` is otherwise cut off as
> a comment.

## Contributing

Bug reports and suggestions are welcome as an
[issue](https://github.com/SirTobyB/Proviant/issues). Before opening
a pull request, please run `npm run check`, `npm test` and `npm run build`.
Comments and commit messages are in German; the project conventions live in
[CLAUDE.md](CLAUDE.md).

## License

[MIT](LICENSE) — free to use, modify and redistribute, without warranty. The
icons come from [Heroicons](https://heroicons.com) (MIT).
