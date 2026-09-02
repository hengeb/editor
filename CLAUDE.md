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
Indikator, Kontextmenü-Rename/Delete, Mobile-Sidebar-Toggle, Bild-/PDF-
Vorschau, Datei-Upload per Drop inkl. Überschreiben/Mehrfach-Upload/Auto-
Expand). Drag & Drop zum Verschieben sowie das rekursive Traversieren
gedroppter Ordner sind implementiert, aber nicht automatisiert testbar (siehe
"Offene Punkte" unten).

## Architektur

```
deploy/                                            – alles zum Betreiben (siehe unten); für ein reines Deployment
                                                      genügt dieses Verzeichnis, der Rest liegt nur auf GitHub
  compose.yml, .env.example, Makefile
Dockerfile                                          – Build (Kontext = Repo-Root, referenziert von deploy/compose.yml)
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
  `deploy/compose.yml`/`.env` (`HOST_DATA_DIR`) bestimmt.
- `PathResolver` verhindert Path-Traversal und Symlink-Escapes (jeder Pfad
  wird via `realpath()` gegen die Wurzel geprüft).
- Authentifizierung selbst übernimmt ausschließlich Traefiks
  `forwardauth@file`-Middleware; die App prüft keinen User-Header. `ForwardAuth`
  liest optional nur den (konfigurierbaren) Gruppen-Header und verweigert den
  Zugriff (403), falls `AUTH_ALLOWED_GROUP` gesetzt ist und der Nutzer nicht
  Mitglied dieser Gruppe ist.
- Alle mutierenden Requests (POST/PUT/PATCH/DELETE) verlangen den Header
  `X-Requested-With: XMLHttpRequest` als CSRF-Schutz (Forward-Auth setzt i. d. R.
  ein Session-Cookie; ohne diesen Check könnte eine fremde Seite darüber
  schreiben/löschen).
- `GET /api/file` erkennt nicht-UTF-8-Inhalte und liefert `binary: true` statt
  des Inhalts; der Client zeigt dann einen Hinweis statt eines Editors.
- `PUT /api/file` unterstützt optimistische Konflikterkennung über `mtime`
  (409 falls die Datei serverseitig zwischenzeitlich geändert wurde).

#### ENV-Variablen (siehe `deploy/.env.example`)

| Variable | Default | Bedeutung |
|---|---|---|
| `EDITOR_HOST` | `editor.docker.localhost` | Domain für die Traefik-Route |
| `HOST_DATA_DIR` | `./data` (relativ zu `deploy/`) | Host-Verzeichnis, gemountet nach `/files` |
| `USER` | aktueller Nutzer von `make up` | Systembenutzer, dessen UID/GID der Container verwendet; `make up` löst den Namen per `id -u`/`id -g` **auf dem Docker-Host** in `PUID`/`PGID` auf und reicht diese als Prozessumgebung an `docker compose` durch (muss zu `HOST_DATA_DIR`-Besitzrechten passen). `compose.yml` selbst hat zusätzlich einen Fallback `PUID`/`PGID` = `1000`, falls `docker compose` direkt ohne `make` aufgerufen wird. |
| `TRAEFIK_NETWORK` | `traefik` | Name des externen Docker-Netzwerks |
| `AUTH_ALLOWED_GROUP` | leer (= keine Gruppenprüfung) | Nur Mitglieder dieser Remote-Group dürfen zugreifen |
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
- `GET /api/raw?path=` – liefert den Rohinhalt einer Datei mit per `fileinfo`
  erkanntem `Content-Type` (kein JSON); Basis für Bild-/PDF-Vorschau und
  Download-Links im Client
- `PUT /api/upload?path=` – Request-Body = rohe Bytes (kein JSON); legt die
  Datei an oder überschreibt sie, falls sie existiert (Upsert, im Gegensatz zu
  `POST /api/file`). Übergeordnetes Verzeichnis muss existieren.

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
  Rückfrage bei ungespeicherten Änderungen (auch per Strg+Alt+W – Strg+W selbst
  ist ein von Browsern reservierter, nicht abfangbarer Shortcut), horizontal
  scrollbare Tab-Leiste. Binärdateien: Bilder als `<img>`, PDFs als `<embed>`,
  alles andere als Download-Button – jeweils über `/api/raw`.
- Datei-Upload per Drag & Drop von Dateien/Ordnern des Betriebssystems in den
  Dateibaum (`tree.js`, natives HTML5-DnD via `dragenter`/`dragover`/`drop`,
  parallel zum internen Pointer-Events-Verschieben). Ordner werden über
  `webkitGetAsEntry()`/`createReader()` rekursiv traversiert; benötigte
  Unterverzeichnisse werden vorab (flach zuerst) angelegt, vorhandene Dateien
  gleichen Namens überschrieben. Gleiche Auto-Expand-beim-Verweilen-Logik wie
  beim internen Verschieben (gemeinsam genutzt über `scheduleHoverExpand`).
  Zusätzlich ein Upload-Button in der Baum-Toolbar (nativer Datei-Dialog,
  flach ohne Unterordner) für den Fall ohne Drag & Drop.
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
  Host-Verzeichnis manuell chmod/chown-en zu müssen. Die eigentliche
  UID/GID-Auflösung von `USER=name` passiert im `up`-Target von
  `deploy/Makefile`, nicht in Docker selbst.
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
- `deploy/compose.yml` referenziert dieses GHCR-Image als Standard; `make
  build` baut stattdessen lokal aus dem Repo-Root (`context: ..`, unter
  demselben Image-Tag), sodass ein anschließendes `make up` das lokal gebaute
  Image verwendet, statt zu pullen. `make build` setzt daher einen vollen
  Repo-Checkout voraus; ein reines Deployment mit nur dem `deploy/`-Ordner
  nutzt ausschließlich das GHCR-Image.

## Makefile-Targets (in `deploy/`)

`setup`, `up`, `down`, `logs`, `shell`, `test`, `build`, `help` – siehe
`make help` für Kurzbeschreibungen. Alle Befehle werden aus `deploy/` heraus
ausgeführt (`cd deploy && make up`).

## Offene Punkte / für die nächste Session

- Drag & Drop (Maus + Touch-Long-Press) ist implementiert, aber nur manuell
  überflogen, nicht automatisiert getestet (Playwright kann Touch-Pointer-
  Events simulieren, wurde hier aus Zeitgründen nicht ergänzt).
- Das rekursive Hochladen ganzer Ordner (per Drop von außerhalb des Browsers)
  lässt sich nicht automatisiert testen: `DataTransferItem.webkitGetAsEntry()`
  liefert nur bei echten, vom Betriebssystem stammenden Drags echte
  Verzeichnis-Einträge; synthetische `DataTransfer`-Objekte (wie sie
  Playwright/JS erzeugen) geben dafür `null` zurück. Einzel-/Mehrfachdatei-
  Uploads sind dagegen per synthetischem `drop`-Event verifiziert (über den
  `getAsFile()`-Fallback im Code). Die Traversierungslogik selbst wurde
  manuell durchgerechnet, aber nicht per echtem Ordner-Drop im Browser
  getestet.
