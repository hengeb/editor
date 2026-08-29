# Browserbasierter Dateieditor

Einfacher, browserbasierter Dateieditor: PHP-8.5-Backend mit REST-API (CRUD auf
einem festen Wurzelverzeichnis im Container), ausgeliefert über nginx in einem
Docker-Container (nginx + php-fpm via supervisord), Zugriffsschutz über
Traefik-Forward-Auth. Client: statisches HTML/CSS/Vanilla-JS (zur Laufzeit
ungeneriert; das JS wird vorab per esbuild aus `frontend/` gebündelt) mit
lazy-geladenem Dateibaum und Tab-Editor (CodeMirror 6).

## Status

Vollständig implementiert und lokal end-to-end verifiziert (PHPUnit, curl
gegen die REST-API, Playwright-Smoke-Test im echten Browser gegen den
laufenden Container: Datei anlegen/öffnen/bearbeiten/speichern, Dirty-
Indikator, Kontextmenü-Rename/Delete, Mobile-Sidebar-Toggle). Drag & Drop
zum Verschieben ist implementiert, aber nicht automatisiert getestet (siehe
"Offene Punkte" unten).

## Architektur

```
compose.yml, .env.example, Dockerfile, Makefile   – Deployment
docker/                                            – nginx.conf, supervisord.conf, php.ini, entrypoint.sh
src/                                                – PHP-Backend (PSR-4 App\)
  Config.php                                        – ENV-Konfiguration
  Auth/ForwardAuth.php, AuthException.php           – Forward-Auth-Header-Prüfung
  FileSystem/PathResolver.php, FileRepository.php   – Pfad-Sicherheit + CRUD auf /files
  Api/Router.php, TreeController.php, FileController.php, ApiResponse.php, ApiException.php
  HttpStatusException.php                           – gemeinsames Interface für HTTP-Fehler
public/
  index.php                                         – Front-Controller für /api/*
  index.html                                        – SPA-Shell (lädt assets/js/bundle.js)
  assets/css/style.css                               – handgeschrieben, natives CSS-Nesting
  assets/js/bundle.js                                – esbuild-Output, wird beim Docker-Build erzeugt (nicht committet)
frontend/                                           – nur im Docker-Build-Stage benötigt (Node)
  src/app.js, tree.js, tabs.js, editor.js, api.js, icons.js, context-menu.js
tests/Unit/                                         – PHPUnit (PathResolver, FileRepository, ForwardAuth)
```

### Backend

- Wurzelverzeichnis ist **fest** `/files` im Container (kein ENV). Welcher
  Host-Pfad dort landet, wird ausschließlich über den Docker-Volume-Mount in
  `compose.yml`/`.env` (`HOST_DATA_DIR`) bestimmt.
- `PathResolver` verhindert Path-Traversal und Symlink-Escapes (jeder Pfad
  wird via `realpath()` gegen die Wurzel geprüft).
- `ForwardAuth` liest die von Traefiks `forwardauth@file`-Middleware
  gesetzten Header (Name konfigurierbar) und autorisiert optional gegen eine
  konfigurierbare Remote-Group.
- Alle mutierenden Requests (POST/PUT/PATCH/DELETE) verlangen den Header
  `X-Requested-With: XMLHttpRequest` als CSRF-Schutz (Forward-Auth setzt i. d. R.
  ein Session-Cookie; ohne diesen Check könnte eine fremde Seite darüber
  schreiben/löschen).
- `GET /api/file` erkennt nicht-UTF-8-Inhalte und liefert `binary: true` statt
  des Inhalts; der Client zeigt dann einen Hinweis statt eines Editors.
- `PUT /api/file` unterstützt optimistische Konflikterkennung über `mtime`
  (409 falls die Datei serverseitig zwischenzeitlich geändert wurde).

#### ENV-Variablen (siehe `.env.example`)

| Variable | Default | Bedeutung |
|---|---|---|
| `EDITOR_HOST` | – (erforderlich) | Domain für die Traefik-Route |
| `HOST_DATA_DIR` | `./data` | Host-Verzeichnis, gemountet nach `/files` |
| `PUID` / `PGID` | `1000` / `1000` | UID/GID, unter der der Container-Prozess auf `/files` zugreift (muss zu `HOST_DATA_DIR`-Besitzrechten passen) |
| `TRAEFIK_NETWORK` | `traefik` | Name des externen Docker-Netzwerks |
| `AUTH_ALLOWED_GROUP` | leer (= jeder authentifizierte User) | Nur Mitglieder dieser Remote-Group dürfen zugreifen |
| `AUTH_USER_HEADER` | `Remote-User` | Header-Name für den authentifizierten User |
| `AUTH_GROUPS_HEADER` | `Remote-Groups` | Header-Name für die (kommagetrennten) Gruppen |
| `EDITOR_IMAGE` / `EDITOR_TAG` | `ghcr.io/hengeb/editor` / `latest` | Welches Image `docker compose` zieht (überschrieben durch `make build`) |

#### REST-API

- `GET /api/tree?path=&depth=2` – Verzeichnisinhalt als Baum-JSON (Verzeichnisse
  vor Dateien, alphabetisch; `depth` bestimmt, wie viele Ebenen an
  Unterverzeichnissen direkt mitgeliefert werden, damit der Client eine Ebene
  vorladen kann)
- `GET /api/file?path=` – `{path, content, mtime, size}` oder `{..., binary: true}`
- `POST /api/file` `{path, type: "file"|"dir"}` – anlegen (409 falls Ziel existiert)
- `PUT /api/file` `{path, content, mtime}` – speichern (404/409)
- `PATCH /api/file` `{path, newPath}` – umbenennen/verschieben (409)
- `DELETE /api/file?path=` – löschen (rekursiv bei Verzeichnissen)

Fehler einheitlich als `{"error": "..."}` mit passendem HTTP-Status.

### Frontend

- Kein Framework, ES-Module, gebündelt mit esbuild (`frontend/build.mjs`) zu
  einer IIFE (`public/assets/js/bundle.js`), die als einziges `<script>` in
  `index.html` eingebunden wird. Keine Drittanbieter-Ressourcen zur Laufzeit
  (keine CDNs, keine Google Fonts) – alles inklusive Icons (`@tabler/icons`,
  als SVG-Strings gebündelt) liegt im Bundle.
- CodeMirror 6 für Syntax-Highlighting/Zeilennummern; Sprachauswahl anhand der
  Dateiendung in `frontend/src/editor.js` (u. a. yaml, markdown, js/ts, css,
  html/xml, php, sql, json).
- Dateibaum (`tree.js`): lazy-loaded via `/api/tree`, Cache im Speicher.
  Umbenennen/Löschen über Kontextmenü (Rechtsklick am Desktop, Long-Press auf
  Touch – `context-menu.js`). Verschieben per Drag & Drop: am Desktop ab
  Mausbewegung über Schwellwert, auf Touch nach Long-Press-Arming; einheitlich
  über die Pointer-Events-API implementiert (kein natives HTML5-DnD, da das
  auf Touch nicht funktioniert).
- Tabs (`tabs.js`): ein Tab pro offener Datei, Dirty-Punkt, Schließen mit
  Rückfrage bei ungespeicherten Änderungen, horizontal scrollbare Tab-Leiste.
- Layout mobile-first (`public/assets/css/style.css`, natives CSS-Nesting):
  Desktop (≥48rem) zweispaltig, Mobile nur Editor mit Dateibaum als
  Overlay/Drawer.

### Deployment

- Einzelner Container (nginx + php-fpm via supervisord), Multi-Stage-Dockerfile
  (Node-Stage nur zum Bündeln des Frontends, taucht im Laufzeit-Image nicht
  auf).
- `docker/entrypoint.sh` remapped `www-data` beim Containerstart auf
  `PUID`/`PGID` (via `usermod`/`groupmod`, Paket `shadow`), damit im Container
  angelegte Dateien auf dem Host dem erwartenden Nutzer gehören, ohne das
  Host-Verzeichnis manuell chmod/chown-en zu müssen.
- Container-Logs sind bewusst leise: nginx schreibt sein Access-Log nach
  `/dev/stdout`, aber nur für Responses mit Status ≥ 500 (`map $status
  $log_server_errors_only` in `docker/nginx.conf`; ohne diese Überschreibung
  würde die Alpine-nginx-Paketkonfiguration ohnehin in eine für `docker compose
  logs` unsichtbare Datei im Container schreiben). Das standardmäßig von
  offiziellen php-fpm-Docker-Images aktivierte, ungefilterte Per-Request-
  Access-Log (`docker.conf`) wird in `docker/php-fpm-pool.conf` deaktiviert,
  da php-fpm anders als nginx keine statuscode-abhängige Filterung
  unterstützt. Echte PHP-Fehler landen weiterhin über `error_log` (stderr).
- `docker/php.ini` deaktiviert `display_errors` (Warnungen dürfen nicht in
  JSON-Antworten der API landen und Status-Codes verfälschen) und aktiviert
  `log_errors`.
- CI (`.github/workflows/ci.yml`): PHPUnit-Tests laufen bei jedem Push/PR;
  bei Push auf `main` wird zusätzlich das Image gebaut und nach
  `ghcr.io/hengeb/editor` (Tags `latest` und Commit-SHA) gepusht.
- `compose.yml` referenziert dieses GHCR-Image als Standard; `make build`
  baut stattdessen lokal (unter demselben Image-Tag), sodass ein
  anschließendes `make up` das lokal gebaute Image verwendet, statt zu pullen.

## Makefile-Targets

`setup`, `up`, `down`, `logs`, `shell`, `test`, `build`, `help` – siehe
`make help` für Kurzbeschreibungen.

## Offene Punkte / für die nächste Session

- Drag & Drop (Maus + Touch-Long-Press) ist implementiert, aber nur manuell
  überflogen, nicht automatisiert getestet (Playwright kann Touch-Pointer-
  Events simulieren, wurde hier aus Zeitgründen nicht ergänzt).
- Rückfrage an den User offen: Für "als welcher User im Dateisystem der
  Editor läuft" wurden `PUID`/`PGID` (numerisch, Konvention à la
  linuxserver.io) statt eines einzelnen `USER=henrik`-Namens gewählt, da eine
  Username-zu-UID-Auflösung zur Laufzeit fragil wäre (der Name müsste auch im
  Container existieren). Falls eine andere Variablenbenennung gewünscht ist,
  einfach Bescheid geben.
- `EDITOR_HOST` in `.env` muss vor dem ersten produktiven `make up` gesetzt
  werden (kein sinnvoller Default möglich).
