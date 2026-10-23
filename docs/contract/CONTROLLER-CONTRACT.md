# The controller-client contract (version 1)

Status: **design for M1/M2 builders**, 09/10/2026. Nothing here is built yet.
It makes PLATFORM-PLAN §1.3 and §2 concrete under the BETA-PLAN
architecture (every app stands alone; the controller is optional; apps and
Remote are its clients). Where this file and PLATFORM-PLAN differ, this file
is later and wins; where it and BETA-PLAN differ, BETA-PLAN wins.
**[guess]** marks anything not verified in code or on a binary.

Readers: whoever builds the Dock360 OpenHamShack edition (`~/dock360`,
D1), the app servers, `shack_client` (SERVICES.md, SYNC.md) and OpenHamShack
Remote.

Contents: 1 Names and versions · 2 Discovery · 3 `/.well-known/openhamshack`
· 4 Pairing and tokens · 5 Levels and identity through the proxy · 6 The
transmit lease · 7 The hardware broker · 8 Manifest additions · 9 Errors ·
10 Where it lives in Dock360 · 11 Tests the platform must carry.

---

## 1. Names and versions

| Thing | Value |
|---|---|
| Contract version | `1` (major). Additive changes keep `1`; a breaking change is `2` and both are served for one release. |
| Controller | the Dock360 OpenHamShack edition, version `2.0.0` and up (D2) |
| Platform API prefix (clients and apps) | `/api/shack/` for pairing; `/api/shack/v1/` for services and the broker |
| Kinds | `qo100wb`, `qo100nb`, `datv`, `radio`, `atv`, `icom`, `flex`, `digimodes` |
| Module ids | `ohs-<kind>` (REPO-LAYOUT.md §4) |
| Device token prefix | `shackdev_` |
| App token prefix | `shackapp_` |
| Stream ticket prefix | `shacktk_` |

Kind names follow the decided product names, not PLATFORM-PLAN's working
ones: the wideband box app is `qo100wb` (PLATFORM-PLAN called it `datv`),
terrestrial DATV (ohsdatv, D7) is `datv`, StationFlow is `icom`. A client
that finds a Classic 0.9.x box (§2.3) treats it as one `qo100wb` app.

JSON on the wire is camelCase, as in `~/openhamshack/docs/REMOTE-API.md`. The two
exceptions are QSO fields, which use ADIF names (SERVICES.md §3), and
`module.yaml`, which is snake_case like every other Dock360 manifest key
(`raises_alerts`, `exclusive_devices`: `~/dock360/src/dock360/manifest.py:883-884`).

## 2. Discovery

### 2.1 The advert

One DNS-SD service per controller, published by avahi from a service file
the edition writes (a named privileged operation, §10):

| Field | Value |
|---|---|
| Service type | `_openhamshack._tcp`, domain `local.` |
| Instance name | the station callsign from the station profile (`GM4BRI`); the host name until a callsign is set |
| Port | `80` (Caddy, the front door: D4) |
| Interface | the LAN NIC, IPv4 only (shack has no IPv6; avahi there is eno1/IPv4: HANDOVER "Housekeeping") |

TXT keys (every value ASCII, the whole record under 400 bytes):

| Key | Example | Meaning |
|---|---|---|
| `platform` | `1` | **Always present.** Marks a controller, not a Classic box. |
| `contract` | `1` | Contract major version (§1). |
| `id` | `7f3c2a9e` | First 8 hex digits of `controllerId` (§3), so a client can tell two controllers with the same callsign apart before fetching anything. |
| `name` | `GM4BRI` | Same as the instance name. |
| `version` | `2.0.0-beta.1` | Platform version. |
| `kinds` | `qo100wb,icom` | Kinds of the installed OpenHamShack apps, comma-separated, sorted, no spaces. Installed, not necessarily running. |
| `path` | `/.well-known/openhamshack` | Where §3 lives. |
| `https` | `443` | Present only when LAN HTTPS is on (`proxy.lan_https`, `~/dock360/src/dock360/caddy.py:72`). |

The service file is regenerated whenever the callsign, platform version or
set of installed OpenHamShack apps changes. No per-app adverts: an app is
found through §3, never by a record of its own (the decision StationFlow's
`TV-API.md` §2 already assumes).

### 2.2 What a client does

1. Browse `_openhamshack._tcp` **and** `_openhamshack._tcp`.
2. Resolve; base URL is `http://<address>:<port>/` (or `https://…:<https>/`
   when `https` is present and the client trusts the certificate).
3. `GET <base>.well-known/openhamshack`. If it answers with
   `"openhamshack": 1`, that is the controller; key it by `controllerId`, not
   by address (DHCP moves it).
4. A typed address is always accepted as the fallback (REMOTE-API §1).

### 2.3 Legacy `_openhamshack._tcp`

- A `_openhamshack._tcp` record **without** `platform` is a Classic 0.9.x box
  (`~/openhamshack/docs/REMOTE-API.md` §1: TXT `name`, `version`, `port`).
  Clients keep supporting it unchanged (PIN session, port 8080) because
  workshop stays Classic. It is shown as one `qo100wb` app.
- A `_openhamshack._tcp` record **with** `platform=1` was PLATFORM-PLAN's draft
  name for this advert. No release ever shipped it; clients may treat it
  exactly as `_openhamshack._tcp` and must prefer the `_openhamshack` record
  when both resolve to one host.
- The controller does **not** announce `_openhamshack._tcp`, with one exception:
  D4's legacy `:8080` listener for the QO-100 WB app. D4 keeps it "until
  Remote 3.x"; the beta Remote is the release that learns the platform, so
  the listener ships **off by default**. If an admin turns it on, the
  QO-100 WB app gets fixed host port 8080 (PLATFORM-PLAN §3.1 item 4) and the
  controller adds a Classic-shaped `_openhamshack._tcp` record (no `platform`) for
  it. That listener bypasses levels (PIN only), so the Hardware page says so
  while it is on.

## 3. `GET /.well-known/openhamshack`

Open (no credentials), on the front door. Served by the control plane
through Caddy (§10). `Cache-Control: no-store`. Every URL in it is a
**relative reference**, resolved against the controller's **base URL** (the
URL the document was fetched from, minus `.well-known/openhamshack`), so it
is right under path routing, on a subdomain, over HTTP or HTTPS (the "never
build an absolute URL" rule). Not against the document's own URL: by RFC
3986 `api/shack/token` against `…/.well-known/openhamshack` is
`…/.well-known/api/shack/token` (corrected 09/10/2026, found while writing
ohs-libs `shack_client.discovery.well_known`).

```json
{
  "openhamshack": 1,
  "contract": "1.0",
  "controllerId": "7f3c2a9e-51d4-4c0b-9a51-2f7e3d1c4b60",
  "name": "GM4BRI",
  "version": "2.0.0-beta.1",
  "time": "2026-10-09T10:15:02Z",
  "station": {"callsign": "GM4BRI", "locator": "IO75", "country": "GB"},
  "auth": {
    "token": "api/shack/token",
    "pair": "api/shack/pair/start",
    "totp": "per-user",
    "anonymousView": ["shack-qo100wb", "shack-datv"]
  },
  "services": {
    "base": "api/shack/v1/",
    "profile": 1, "logbook": 1, "lookup": 1, "spots": 1, "sync": 1, "broker": 1,
    "bandplan": 1
  },
  "bandplan": {"dataVersion": "2026.10.1", "schema": 1},
  "apps": [
    {
      "id": "shack-qo100wb", "kind": "qo100wb", "name": "QO-100 WB",
      "version": "1.0.0", "base": "shack-qo100wb/",
      "running": true, "txCapable": true, "anonymousView": true,
      "icon": "shack-qo100wb/icon.svg"
    },
    {
      "id": "shack-icom", "kind": "icom", "name": "Icom",
      "version": "1.24.0", "base": "shack-icom/",
      "running": false, "txCapable": true, "anonymousView": false
    }
  ]
}
```

| Field | Rule |
|---|---|
| `openhamshack` | contract major; a client refuses a value it does not know and says "this controller is newer than this app" |
| `contract` | `major.minor`; minor rises with additive changes |
| `controllerId` | UUID minted at install, never changes (survives restore from backup, changes on reinstall). The sync cursor and pairing are keyed by it (SYNC.md §6). |
| `station` | public parts only: callsign (already the advert's name), **4-character** locator, country ISO code. The full profile needs `view` (SERVICES.md §2). |
| `auth.totp` | `"per-user"`: a user with TOTP on must send it to §4.1 |
| `services.*` | each a service major version, or absent when the service is off |
| `apps[]` | OpenHamShack apps only (manifest has `openhamshack:`, §8), sorted by name. `base` is `<route>/`, a relative reference. `name` is the manifest name. `icon` optional. |

**The `services` map lists only services that answer** (as built, 09/10/2026). `bandplan` is
not served by the controller in v1: apps use the `shack_bandplan` package,
so the example's `"bandplan": 1` and the `bandplan` block appear only once a
controller serves it.

Not in it: users, devices, settings, addresses, anything a stranger on the
LAN should not learn. The callsign is public by nature (it is the advert's
instance name).

## 4. Pairing and device tokens

### 4.1 Tokens

A **device token** is the credential a phone, tablet, TV, desktop app or the
local screen holds. Shape and storage follow Dock360's wall tokens
(`~/dock360/src/dock360/migrations/013_wall_tokens.sql`): prefixed so a
leaked one is recognisable, stored only as SHA-256, revoked rather than
deleted, last-used recorded.

- Format: `shackdev_` + 43 characters of base64url (32 random bytes).
- Tied to one platform user. Never expires by time; ends on revocation, on
  the user's deletion, or on the user's password change **only if** the
  user ticks "sign out every device" (a password change on its own must not
  silently unpair a TV on a wall).
- Sent as `Authorization: Bearer shackdev_…` on every request to the front
  door (apps and platform alike). Never in a URL; for players that cannot
  set headers see stream tickets (§4.6).
- Each token has a **cap** (`maxLevel`): the most it may ever do, whatever
  the user's levels (§5.1). TVs are capped at `control` and cannot be raised
  (the family rule "TV kinds never ask for transmit": GUIDE §2). The one
  exception is §5.5: an administrator may allow one TV digital-mode
  transmit. That is a flag beside the cap (`digital_tx`), not a higher cap,
  and no device token can set it.

Server table (edition migration, `~/dock360/src/dock360/migrations/`):

```sql
CREATE TABLE IF NOT EXISTS shack_devices (
    id             TEXT PRIMARY KEY,          -- "dev_" + 12 base32 chars; shown, not secret
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,             -- "Brian's iPad", from the client
    kind           TEXT NOT NULL,             -- phone|tablet|tv|desktop|local
    client_id      TEXT NOT NULL,             -- the client's install id (REMOTE-API §7 "remote")
    app            TEXT NOT NULL DEFAULT '',  -- "remote", "shack-qo100nb-desktop", ...
    max_level      TEXT NOT NULL,             -- view|control|transmit
    token_sha256   TEXT NOT NULL UNIQUE,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    created_via    TEXT NOT NULL,             -- password|tv-code|install
    last_used_at   TEXT, last_used_from TEXT,
    revoked_at     TEXT, revoked_by TEXT,
    digital_tx     INTEGER NOT NULL DEFAULT 0 -- §5.5; TVs only; as built 12/10/2026 (migration 018)
);
```

### 4.2 Phones, tablets and desktop apps: password exchange

```http
POST /api/shack/token
Content-Type: application/json

{"username": "brian", "password": "…", "totp": "123456",
 "deviceName": "Brian's iPad", "deviceKind": "tablet",
 "clientId": "0b5c1e7a-2f4d-4a51-9c3e-1d2f3a4b5c6d", "app": "remote"}
```

`201`:

```json
{"token": "shackdev_V3xq…", "deviceId": "dev_K4M2Q7Z9XW3A",
 "user": "brian", "admin": false, "maxLevel": "transmit",
 "controllerId": "7f3c2a9e-51d4-4c0b-9a51-2f7e3d1c4b60"}
```

- `deviceKind`: `phone`, `tablet` or `desktop` (a standalone desktop app
  pairing with the controller is a device like a phone). `tv` is refused
  here (`400 use_tv_pairing`). `maxLevel` is `transmit` for these kinds.
- `totp` is required when the user has TOTP on (`users.totp_enabled`,
  `~/dock360/src/dock360/migrations/001_init.sql:15-16`); without it `401
  {"code": "totp_required"}` and the client asks.
- Failed attempts count against Dock360's own lockout (`users.failed_logins`,
  `locked_until`); a locked account answers `429 account_locked` with
  `retryAfter`.
- The token appears in this response once and never again.
- One `clientId` holds one live token per user: pairing again revokes the
  previous token for that `clientId` (re-installs do not pile up devices).

### 4.3 TVs: a 6-digit code an admin or the user approves

A TV has no keyboard worth typing a password on (Dock360's wall display was
built on the same reasoning, `013_wall_tokens.sql`).

```http
POST /api/shack/pair/start
{"deviceName": "Living room TV", "deviceKind": "tv",
 "clientId": "5d0f…", "app": "remote"}
```

```json
{"pairId": "pr_9QF3T1", "pairSecret": "q8V…43 chars…", "code": "482913",
 "expiresIn": 300, "pollEvery": 2}
```

The TV shows `482913` and the controller's name. A person approves it either
in the controller's web UI (**Devices › Approve a TV**) or in Remote on a
signed-in phone:

```http
POST /api/shack/v1/pair/approve
Authorization: Bearer shackdev_<phone's token>
{"code": "482913", "user": "brian", "maxLevel": "control"}
```

- Any user may approve a TV **for themselves**; only an admin may name
  another `user`. `maxLevel` is `view` or `control` (default `view`).
- 5 wrong codes against one controller in 10 minutes block approvals for 10
  minutes (`429 too_many_codes`); the code alone is not a credential.

The TV polls with the secret only it holds:

```http
POST /api/shack/pair/poll
{"pairId": "pr_9QF3T1", "pairSecret": "q8V…"}
```

`200 {"state": "pending"}` · `200 {"state": "approved", "token": "shackdev_…",
"deviceId": "dev_…", "user": "brian", "maxLevel": "control"}` (once; the
pair request is then spent) · `200 {"state": "denied"}` · `410 {"code":
"pair_expired"}`.

### 4.4 Revocation

```http
GET    /api/shack/v1/devices             -> the caller's devices (admin: ?all=1)
DELETE /api/shack/v1/devices/dev_K4M2Q7Z9XW3A
```

- A user revokes their own devices; an admin revokes anyone's. The web UI
  has the same on **Devices**. Audited (Dock360 `audit.py`).
- A revoked token gets `401 {"code": "token_revoked"}` on its next request,
  including through `forward_auth` (§5.3), so it can hold a transmit lease
  for at most the lease time (5 s, §6).
- **Long-lived responses** (a video stream, PCM audio, a websocket) were
  authorised once, when they opened. The platform tells apps about
  revocations: `GET /api/shack/v1/devices/revoked?since=<seq>` (app token,
  §5.4) returns `{"seq": 42, "devices": ["dev_K4M2Q7Z9XW3A"]}`; `shack_client`'s
  server helper polls it every 10 s and closes that device's open streams.
- `POST /api/shack/v1/devices/self/revoke` lets a client unpair itself (Remote's
  "Forget this controller").

### 4.5 The local screen

The kiosk host service (PLATFORM-PLAN §1.1 "Local screen") is a device like
any other, of kind `local`:

- Minted by the installer: user `local` (a platform user that cannot sign in
  with a password), device kind `local`, `maxLevel: transmit`, created_via
  `install`. The token is written to `/etc/openhamshack/local-screen.token`,
  `root:shack-kiosk 0640`, and nowhere else.
- The kiosk exchanges it for a browser cookie so Chromium never needs custom
  headers: `POST /api/shack/session {"token": "shackdev_…"}` on loopback only →
  `Set-Cookie: shack_session=…; HttpOnly; SameSite=Lax; Path=/` (no `Secure`:
  the front door may be plain HTTP, CLAUDE.md "Do not assume HTTPS").
- The `local` user's levels default to `transmit` for every app (the Classic
  screen could always transmit), still subject to the callsign rule (§5.1).
- Settings only the box's own screen may change today (`remotePin`,
  `plutoPassword`, `youtubeUrl`: PLATFORM-PLAN §2.3) become manifest
  `local_only` rules (§8).

This replaces Classic's `is_local()` loopback trust
(`Classic's archived appliance/openhamshack.py:11824`, PLATFORM-PLAN §0.4). An app in
platform mode trusts **only** verified identity headers (§5.3), never a
source address.

### 4.6 Browser sessions and stream tickets

- **Browsers** sign in at `GET /api/shack/login` (a form on the front door, the
  same users and TOTP as Dock360) and receive `shack_session`, an HttpOnly
  cookie with Dock360's 60-minute idle timeout. `forward_auth` accepts a
  bearer token or that cookie.
- **Players that cannot send headers** (libVLC, MobileVLCKit, mpv) ask for a
  ticket: `POST /api/shack/v1/tickets {"path": "shack-qo100wb/api/rx/stream.ts"}`
  → `{"ticket": "shacktk_…", "expiresIn": 60}`, then open
  `…/api/rx/stream.ts?shack_ticket=shacktk_…`. A ticket is good for one path
  prefix, one opening, 60 s, and the level of the device that asked. Today's
  Remote opens the stream with no credential at all (`REMOTE-CONTRACT.md` §6)
  and keeps doing so wherever `anonymousView` is on.

### 4.7 From the internet: the tunnel door (as built 13/10/2026)

A controller can be reached from outside its LAN through Cloudflare Tunnel
(Brian's ohs-box: `https://shack.dock360.net`). cloudflared delivers from
loopback, so it must never be pointed at port 80 (which trusts loopback) or
8800. It goes to the edition's tunnel site (`[proxy] tunnel_port`, loopback
only; dock360 `feature/ohs-tunnel`, `caddy._tunnel_sites`), which states the
client from `CF-Connecting-IP`, sets `X-Dock360-Via: tunnel`, and publishes
only OpenHamShack apps (behind forward_auth), `/.well-known/openhamshack`
and `/api/shack/*` minus `/api/shack/session`. For requests that arrive that
way:

- **No anonymous view** (§5.1's "from a trusted network" is now enforced):
  every app request needs a device token, a session or a ticket.
- **Password exchange (§4.2) and the sign-in form need TOTP** on the
  account: `403 {"code": "totp_not_enrolled"}` otherwise, checked before the
  password. A TV pairs by its code (§4.3) as usual.
- **Only an administrator approves a TV code** from the internet
  (`403 not_admin`); any user still may on the LAN.
- **The local screen's token and session exchange are refused**
  (`403 local_only` / 404).
- **Per-address limits, everywhere** (not only the tunnel): failed sign-ins,
  `totp_not_enrolled` and wrong TV codes, 10 in 15 min block that address
  for 15 min (`429 too_many_attempts`, `retryAfter`); pairing starts, 20 per
  10 min (`429 too_many_pairings`). The account lockout (5 → 15 min,
  `account_locked`) still applies.
- **Websockets:** Cloudflare closes one that carries nothing for ~100 s;
  clients ping (Remote: OkHttp `pingInterval`).
- Clients take `https://name` as a base URL, default port 443, `wss://` for
  every stream, system CAs only (no LAN TOFU pin), and never fall back to
  plain HTTP for a non-LAN name.

## 5. Levels and identity

### 5.1 Levels

Per user and per app: `none | view | control | transmit`, ordered. Platform
admin is a separate flag (`users.is_admin`; the edition must start enforcing
it, since today nothing checks it: PLATFORM-PLAN §0.3).

| Level | May |
|---|---|
| `none` | nothing; the app is hidden from that user's `apps[]` view in Remote |
| `view` | read: status, pictures, audio, scope, decodes, logbook read |
| `control` | `view` plus receive-side changes: tune, mode, receivers, record |
| `transmit` | `control` plus keying and transmit settings |

**Effective level** for a request = min(user's level for the app, the
device's `maxLevel`), then capped at `control` when the station profile has
no callsign (PLATFORM-PLAN §2.3), then raised to at least `view` for an
unsigned request to an app with `anonymous_view` (D3) from a trusted network.
A level never overrides an app's own transmit switch (`TX_ENABLED` in Icom:
`icom/docs/TV-API.md` §3).

Defaults at install: the first admin has `transmit` on every app; new users
`view`; the `local` user `transmit`. `anonymous_view` is on for `shack-qo100wb`
and `shack-datv` (D3) and off elsewhere.

```sql
CREATE TABLE IF NOT EXISTS shack_levels (
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id TEXT NOT NULL,
    level     TEXT NOT NULL CHECK (level IN ('none','view','control','transmit')),
    PRIMARY KEY (user_id, module_id)
);
```

### 5.2 Route rules: the proxy enforces the minimum

Every request to an OpenHamShack app passes `forward_auth`, and the auth
endpoint refuses a request whose effective level is below the route's
minimum. So "view-only can't control" (BETA-PLAN gate 3) is held by the
platform and tested once there, not re-proven in eight apps. Apps still
check the level themselves (defence in depth, and for websocket messages).

Rules come from the manifest (§8), first match wins, then the defaults:

| Default | Minimum |
|---|---|
| `GET`, `HEAD`, websocket upgrade | `view` |
| any other method | the manifest's `default_write_level` (`control` unless set; Icom sets `transmit` and lists its control routes, as its allow-list design already does: `TV-API.md` §3) |

A refusal is the auth endpoint's answer, which Caddy returns to the client:

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{"error": "This needs the Transmit level; your level for QO-100 WB is Control.",
 "code": "level_too_low", "level": "control", "needs": "transmit"}
```

(the field names are Icom's existing refusal shape, `TV-API.md` §3).

### 5.3 How identity reaches an app

For each OpenHamShack app route the edition's Caddy generator emits
(`<hop secret>`, `<proxy secret>` and `<port>` are filled in by the
generator; `{remote_host}` and `{host}` are Caddy's own placeholders):

```caddy
handle_path /shack-qo100wb/* {
	forward_auth 127.0.0.1:8800 {
		uri /internal/shack/auth?app=shack-qo100wb
		header_up X-Dock360-Peer {remote_host}
		header_up X-Dock360-Auth <hop secret>
		copy_headers X-OpenHamShack-User X-OpenHamShack-Level X-OpenHamShack-Device X-OpenHamShack-Auth X-OpenHamShack-Admin X-OpenHamShack-Reason X-OpenHamShack-Transmit
	}
	encode zstd gzip
	reverse_proxy 127.0.0.1:<port> {
		header_up X-Forwarded-Host {host}
		header_up X-Forwarded-Prefix /shack-qo100wb
		header_up X-Dock360-Module shack-qo100wb
		header_up X-OpenHamShack-Proxy-Secret <proxy secret>
	}
}
```

The headers the app receives, **every one always present and non-empty**:

| Header | Values |
|---|---|
| `X-OpenHamShack-User` | platform username, or `-` (anonymous) |
| `X-OpenHamShack-Level` | `view`, `control` or `transmit` (`none` never reaches an app) |
| `X-OpenHamShack-Device` | `dev_…` (paired device), `session:<16 hex>` (a person signed in with a browser: a SHA-256 prefix of the session id, never the id itself), or `-` (anonymous) |
| `X-OpenHamShack-Auth` | `device`, `session`, `local`, `ticket` or `anonymous` |
| `X-OpenHamShack-Admin` | `1` or `0` |
| `X-OpenHamShack-Reason` | why the level is what it is: `ok`, `no_callsign`, `device_cap`, `anonymous` |
| `X-OpenHamShack-Transmit` | what the request may transmit: `full` (the level is `transmit`), `digital` (a TV allowed digital-mode transmit, §5.5; the level stays `control`) or `none`. Added 12/10/2026; an app that sees no such header is behind an older controller and decides by the level alone |
| `X-OpenHamShack-Proxy-Secret` | this app's proxy secret |

Rules, each from a trap already paid for:

- **Set, never strip-then-set.** Caddy applies header deletes after sets, so
  `header_up -X` followed by `header_up X v` delivers nothing (memory
  "Caddy applies header delete last"; the full story at
  `~/dock360/src/dock360/caddy.py:686-723`). `header_up X v` is a set that
  replaces a client's forged value (checked there against caddy v2.11.4).
- **Always non-empty.** `copy_headers` copies from the auth response with a
  set. Whether it also deletes a client-sent header when the auth response
  lacks it is **[guess]** version-dependent, so the auth endpoint always
  returns every identity header on a 2xx (seven since §5.5) and the
  question never arises.
- **Per-app proxy secret**, not one host secret: one leaked container must
  not be able to impersonate the proxy to another app (the reasoning in
  `~/dock360/src/dock360/web/routes/alerts_api.py` header comment against
  "one shared secret for the whole host"). Issued like the alert token: in
  the app's environment as `DOCK360_SHACK_PROXY_SECRET`, merged at render time
  (`modules._issued_env`, `~/dock360/src/dock360/modules.py:380-412`), and in
  the Caddy fragment written with the same lock-down as the SSO hop secret
  (`RESTRICTED_SITES`, `caddy.py:683`).
- **The app compares the secret before reading any other header**, in
  constant time, exactly as `sso.trusted_peer` does
  (`~/dock360/src/dock360/sso.py:111-127`). No secret, or a wrong one: `401
  {"code": "proxy_required"}` for everything. An app in store mode never
  falls back to trusting a source address.
- **Tested against the real binary**, not the emitted text, in the style of
  Dock360's `tests/test_sso_proxy_hop.py`: a client forging each header,
  twice, in other casings, must never reach the app with its value.
- **Long-lived streams go through these Caddy routes**, never the 8800
  Python relay (PLATFORM-PLAN §2.4); websockets get the existing
  `read_timeout 0` transport (`caddy.py:131-138`).

**The admin interface's `/app/<id>/` proxy (port 8800)** (as built, 09/10/2026) applies the
same gate as `forward_auth` and sends the same identity headers. It strips
forged `X-OpenHamShack-*` headers, `Authorization` and platform session
cookies before the request reaches the app, so the 8800 route is no way
round the gate.

`web.protect` in today's manifests is declared but "not yet enforced"
(`~/dock360/src/dock360/buildstatus.py:396`). The edition implements it as
this `forward_auth` for every route whose manifest has `openhamshack:`;
non-OpenHamShack apps keep today's behaviour.

### 5.4 The app's own credential to the platform

An app calls platform services and the broker as itself, not as a user:

- Env (issued, never a setting: `DOCK360_` keys are reserved,
  `manifest.py:38-41`): `DOCK360_SHACK_URL=http://dock360-host:8800/api/shack/v1`
  and `DOCK360_SHACK_TOKEN=shackapp_…`, issued to every module whose manifest has
  `openhamshack:`. Same storage and rotation as the alert token
  (`~/dock360/src/dock360/alerts.py:205-268`: digest lookup, encrypted copy
  for re-rendering, rotate on demand). Reached through `dock360-host`, never
  published through Caddy (as `alerts_api.py` explains).
- (as built, 09/10/2026): the token has the `shackapp_` prefix and `DOCK360_SHACK_URL` is in
  the app's environment alongside it; the per-app proxy secret (§5.3) is
  `DOCK360_SHACK_PROXY_SECRET`.
- When the app acts for a person, it says who: `X-OpenHamShack-Acting-Device:
  dev_…`, `session:…` or `-`, copied from the `X-OpenHamShack-Device` of the
  request it is serving. The platform looks that identity's level up itself;
  it never trusts a level an app reports.
- Desktop (standalone) apps have no app token. When paired they call the
  same services with their **device** token (§4.2), over the front door.

### 5.5 A TV allowed digital-mode transmit (as built 12/10/2026)

Brian's decision (11/10/2026, `docs/REMOTE-KEYS.md` "Decided"): a TV may
transmit digital modes - NB/Radio's Enable TX, and sending the station's own
source on WB, DATV and ATV - never voice, opt-in per TV, off by default.

- **The switch.** `shack_devices.digital_tx`, set on the controller's
  **Devices** page by an **administrator** only, through the interface's
  own session and CSRF token, and audited (`shack.device.digital_tx`). No
  route that takes a device token can change it, so a TV - even one paired
  for an administrator - cannot switch itself on. Only a TV carries it; a
  re-paired TV is a new device row and starts off. `GET
  /api/shack/v1/devices` shows it as `digitalTx`.
- **When it counts.** All of: the device is a TV with the switch on, its
  effective level is `control` (a TV limited to `view` stays watching), the
  person's own level for the app is `transmit`, and the station has a
  callsign. Then `X-OpenHamShack-Transmit: digital`; otherwise `none` (or
  `full` at the `transmit` level).
- **Why a flag and not a level.** The TV's `X-OpenHamShack-Level` stays
  `control`. An app that knows only levels refuses it every transmit route,
  so an app nobody has taught about this fails closed.
- **Routes.** A manifest level rule may say `digital: true` (only with
  `level: transmit`, §8). The proxy lets a `digital` request through such a
  route and no other transmit route. Mark only routes that serve digital
  transmit: Enable TX's arm heartbeat, a picture-source "send" - never PTT
  key-up or TX audio. A controller older than this ignores the key and keeps
  the route at plain `transmit`, which refuses the TV.
- **The app.** Admits `digital` only where it sends a digital mode, and
  still runs every key-up check of §6.2 from step 2 on.
- **The broker.** On-air for such a TV is admitted only when the app's
  request carries `"digital": true` (§6.2 step 5); the audit records
  `(digital)`. The broker cannot hear what is sent, so this is the app's
  word, but it makes a voice key-up from that TV a refusal in two places.
  An app sends `"digital": true` only for an over its own code generates
  as a digital mode, never for PTT.
- **Remote.** A TV learns it has the switch from `digitalTx` on its own
  device (`GET /api/shack/v1/devices`) and from the app's refusals; the TV
  transmit gesture is REMOTE-KEYS.md's (hold Play/Pause 1 s, confirm within
  5 s, any key stops it).

## 6. The transmit lease (per app) and how it meets the broker

### 6.1 The lease: unchanged, and now every transmitting app's

Every app whose manifest says `tx_capable: true` implements REMOTE-API §7
**field for field** at its own base: `POST <base>api/ptt {"on": true,
"remote": "<client-id>"}`, heartbeat `POST <base>api/ptt/heartbeat` every
**1 s** after the key-up answers, server unkeys after **5 s** of silence,
`409` when the caller no longer holds it, any unkey ends it, and status
carries `onAir` and `tx.remote`. Icom's planned transmit section is already
this lease (`TV-API.md` §11). The pad library (CONTROLLER-PAD.md) and Remote
are just clients of it.

Both the key-up and each heartbeat are requests through `forward_auth`
(§5.3) at the declared `transmit` minimum, so a revoked or downgraded device
loses the lease within 5 s.

### 6.2 What an app checks before keying, in order

1. Effective level `transmit` (`X-OpenHamShack-Level`).
2. Its own transmit switch (`TX_ENABLED` or equivalent) is on.
3. **Licence and band plan:** `shack_bandplan.check(...)` with the station
   profile (BANDPLAN-DATA.md §6) says allowed. A refusal is `200` with
   `onAir: false` and `txError` set (REMOTE-API §7: a refused key-up is
   still `200`).
4. It holds a broker claim on every device in the chain, in `tx` mode (§7).
5. `POST /api/shack/v1/broker/claims/{id}/onair {"on": true, …}` answered
   `200`. Only then does it key.

Going on air needs an **acting identity** with the `transmit` level for that
app (decided 09/10/2026, as built the same day). The acting identity is the
*person*, with their device when there is one:

- a paired device (`dev_…`): the person's level for the app, capped by the
  device's own limit - so a TV (capped at `control`) is refused, unless it
  has the §5.5 switch and the request says `"digital": true`;
- a browser session (`session:…`, as the gate put it in
  `X-OpenHamShack-Device`): the signed-in person's level for the app. The
  broker resolves it to the live session at every `onair`; a session that has
  been signed out, idled out or revoked acts for nobody (`level: none`).

Both get the gate's other cap: no station callsign, no `transmit`. `view` and
`control` can never go on air. The Hardware page and the audit name the
person and how they are here (`for alice (browser)`).

Automated transmitting (no person, so no acting identity) is not supported
in v1: `requester: auto` can claim `rx` only.

Unkey runs the other way: stop RF, then `onair {"on": false}`.

### 6.3 Who stops a transmission, and when

| Failure | Stopped by | Within |
|---|---|---|
| Client goes quiet (app backgrounded, Wi-Fi lost, phone locked) | the app's lease | 5-6 s (REMOTE-API §7) |
| Pad unplugged while keyed | the pad library, at once (CONTROLLER-PAD.md §7) | < 0.5 s |
| Device revoked or downgraded | `forward_auth` refuses the next heartbeat, so the app's lease expires | 5-6 s |
| App hangs or crashes while on air | the broker: on-air claim lease expires, safe-off runs | 6-8 s (§7.3) |
| App's container stops | the broker sees the unit stop (systemd) and runs safe-off at once | < 2 s **[guess: needs the unit-state watch]** |
| Broker restarts | apps re-claim within the 15 s grace; nothing is forced off in the grace unless its lease lapses | — |
| Transmit time-out (`txTimeoutMin`) | the app, as today | per setting |
| Admin presses **Stop all transmitting** | the broker: refuses new `onair`, sends `release_request` with `stop: true`, runs safe-off after 3 s | 3-5 s |

The broker is the **second** line of defence and never initiates a
transmission (PLATFORM-PLAN §2.5). The one thing it actuates towards
transmit is a broker-owned PTT output, and only as the last step of a
holder's own `onair` request (§7.4).

## 7. The hardware broker (v1)

Inside `dock360-api` as `broker.py` (PLATFORM-PLAN §1.3), beside `claims.py`.
Apps reach it at `$DOCK360_SHACK_URL/broker/...` with their app token. The web
UI's **Hardware** page and the local screen's status strip read the same
state.

### 7.1 Devices

```http
GET /api/shack/v1/broker/devices
```

```json
{"devices": [
  {"id": "pluto-1", "class": "pluto", "label": "Pluto (PlutoDVB2)",
   "identity": {"mac": "00:05:f7:12:34:56", "address": "192.168.2.1"},
   "reach": "network", "exclusive": true, "txCapable": true,
   "present": true,
   "holder": {"app": "shack-qo100wb", "claimId": "cl_8H2K", "mode": "tx",
              "onAir": false, "since": "2026-10-09T10:01:12Z"},
   "queue": [{"app": "shack-atv", "claimId": "cl_9P1Q", "mode": "rx",
              "requester": "person"}],
   "safeOff": "mqtt-ptt-0+tx-lo-powerdown"},
  {"id": "gpu", "class": "render", "reach": "devices", "exclusive": false,
   "present": true, "holders": ["shack-qo100wb", "shack-datv"]}
]}
```

Device ids are stable names the broker assigns from identity (USB id plus
serial or bus path, MAC, or configured address), shown and editable on the
Hardware page. Inventory classes and safe-off recipes are PLATFORM-PLAN
§1.3's table; v1 implements safe-off for `pluto`, `libresdr`, `ptt-*` (relay
outputs) and `minitiouner` (LNB supply off). Others release without a
recipe and say so.

### 7.2 Claiming

```http
POST /api/shack/v1/broker/claims
Authorization: Bearer shackapp_…
X-OpenHamShack-Acting-Device: dev_K4M2Q7Z9XW3A

{"device": "pluto-1", "mode": "rx", "wait": true,
 "requester": "person", "reason": "Receive QO-100 beacon"}
```

`mode` is `rx` or `tx`. `requester` is `person` (someone pressed something)
or `auto` (a schedule, a start-up). `wait` asks to queue if not free.

Answers:

```json
201 {"claimId": "cl_8H2K", "device": "pluto-1", "mode": "rx",
     "lease": {"seconds": 10, "heartbeatEvery": 2},
     "access": {"reach": "network", "address": "192.168.2.1"}}
```

```json
202 {"claimId": "cl_8H2K", "state": "queued", "position": 1,
     "holder": {"app": "shack-qo100nb", "mode": "rx", "onAir": false}}
```

```json
409 {"error": "QO-100 NB has the Pluto and is on the air.",
     "code": "device_on_air", "holder": {"app": "shack-qo100nb", "mode": "tx", "onAir": true}}
```

`access` says how to reach the device: `{"reach": "network", "address": …}`,
`{"reach": "usb", "usbId": "0403:6010", "serial": "…", "busPath":
"/dev/bus/usb/001/007"}` or `{"reach": "devices", "paths": ["/dev/dri/renderD128"]}`.
A PTT output never has an `access`: it is never passed to an app.

Heartbeat, mode change, release:

```http
POST   /api/shack/v1/broker/claims/cl_8H2K/heartbeat    -> 200 {"state": "granted", "leaseSeconds": 10, "releaseRequested": false}
POST   /api/shack/v1/broker/claims/cl_8H2K/mode {"mode": "tx"}
DELETE /api/shack/v1/broker/claims/cl_8H2K              -> 200 {"released": true, "safeOff": "ran"}
GET    /api/shack/v1/broker/events                      (server-sent events: grants, queue moves, release requests, on-air)
```

As built, 09/10/2026:

- A claim on a device the app's manifest did not declare (`broker_devices`,
  `exclusive_devices`) is `403 device_not_declared`.
- A heartbeat answer carries `releaseRequested` (bool), true when someone
  asked for the device (§7.5), so an app that misses the `release_request`
  POST still learns of it.
- After a broker restart, `{"reclaim": true}` on a claim re-takes a device
  the app held before. During the 15 s grace (§7.3) any other claim is
  `503 broker_restarting` (+ `retryAfter`).

**Reservations** (proposed 20/10/2026 for Packet Radio's controller BBS;
built on dock360 `feature/ohs-edition-030-c`, not yet merged): a claim with
`"reserve": true` is a standing claim. Its device row carries `reserved:
{"app", "name", "claimId", "reason", "since"}` beside `holder`; a person's
claim against it is `409 device_reserved` with `canAsk: false`, and a
hand-over request never reaches the holder (§7.5 rule 2 does not apply).
Administrators' hand-over, Stop all transmitting and lease loss free it as
any claim. A desktop app never opens a reserved radio and names
`reserved.name` as the reason.

A queued claim learns it was granted from `events` (`{"type": "granted",
"claimId": …, "access": …}`) or by polling its heartbeat (`state` becomes
`granted`).

### 7.3 Timings

| | Value | Why |
|---|---|---|
| Heartbeat | every 2 s | PLATFORM-PLAN §1.3 |
| Lease, not on air | 10 s | PLATFORM-PLAN §1.3 |
| Lease, on air | **6 s** | one second behind the app's own 5 s client lease, so the broker only acts when the app itself has failed; the carrier is off 6-8 s after the app's last heartbeat |
| Release request deadline (receive holder, person asked) | 60 s, then forced | PLATFORM-PLAN §1.3 arbitration 2 |
| Grace after broker restart | 15 s | PLATFORM-PLAN §1.3 arbitration 5 |
| PTT relay lead / tail | 50 ms / 100 ms default, per output on the Hardware page | sequencing so a relay never switches with RF on |

### 7.4 On air

```http
POST /api/shack/v1/broker/claims/cl_8H2K/onair
X-OpenHamShack-Acting-Device: dev_K4M2Q7Z9XW3A

{"on": true, "freqHz": 2405250000, "bandwidthHz": 450000, "mode": "dvbs2",
 "powerW": 2.0, "chain": ["pluto-1", "ptt-relay-1"]}
```

`200 {"onAir": true, "lease": {"seconds": 6, "heartbeatEvery": 2}}`, or:

| Status / code | When |
|---|---|
| `403 tx_inhibited` | **Stop all transmitting** is on (admin or local screen) |
| `403 level_too_low` | the acting identity (device or browser session) lacks `transmit` on this app (the broker looks it up itself) |
| `403 licence_refused` | the broker's own `shack_bandplan.check` refuses (same profile, same data); the body carries the verdict |
| `409 not_holder` | the claim is not `tx` on every device in `chain` |
| `412 safe_off_running` | a safe-off on a device in the chain has not finished |

The broker records ON AIR (Hardware page, status strip, audit), marks the
platform busy (the busy gate: PLATFORM-PLAN §3.1 item 11), then closes any
broker-owned PTT output in `chain`, waits its lead time, and only then
answers `200`. On `{"on": false}` it waits the tail, opens the output and
clears ON AIR. A lapsed on-air lease runs the device's safe-off **before**
opening the relay.

### 7.5 Arbitration and release requests

PLATFORM-PLAN §1.3's rules, made concrete:

1. Free: granted at once.
2. Held for receive, request from a `person`: `409 device_held` with
   `canAsk: true`; the asking app shows "QO-100 NB has the Pluto (receiving).
   Give it to ATV?" and on yes calls `POST /api/shack/v1/broker/handover
   {"device": "pluto-1", "to": "cl_9P1Q"}`. The broker then POSTs to the
   holder's declared `release_request` endpoint (§8):

   ```json
   {"device": "pluto-1", "claimId": "cl_8H2K", "for": "shack-atv",
    "deadlineSeconds": 60, "stop": false}
   ```

   The holder answers `202` and releases, or `409 {"onAir": true}`. At the
   deadline the broker forces: safe-off, then grant.
3. Held for receive, `auto` request: queued.
4. **On air: never pre-empted automatically** (D6). Only **Stop transmitting
   and hand over** on the Hardware page (admin, audited) does it: safe-off
   first.
5. Holder gone (lease lapsed, unit stopped): safe-off, then the next in the
   queue. (as built, 09/10/2026): at the end of the restart grace, any transmitter nobody
   re-claimed is made safe (safe-off) and then freed.

### 7.6 Relation to `claims.py`

`claims.py` stays for settings-driven apps (SigScope, SIGINT, datv-rx): its
holder is derived from settings and unit state, never stored
(`~/dock360/src/dock360/claims.py` docstring). Broker claims are runtime
state and are stored in memory only, rebuilt by re-claim after a restart
(the 15 s grace). A manifest opts in per device with `claim: runtime` on its
`exclusive_devices` entry (§8); both kinds appear in one list on the
Hardware page and a device may not be declared both ways by two apps without
the page saying so. Enforcement stays cooperative in v1 (D6): `usb_bus` plus
libusb's own refusal, and the radio-side marker for network radios
(`~/openhamshack-datv/docs/radio-lock.md`).

## 8. Manifest additions

One new top-level key, `openhamshack:`, spelled exactly as the dataclass
field so it survives Dock360's store-as-JSON-and-reparse round trip (the
trap noted at `~/dock360/src/dock360/manifest.py:954-957`).

```yaml
apiVersion: dock360/v1
id: shack-qo100nb
name: QO-100 NB
version: 1.0.0
license: GPL-3.0-or-later
openhamshack:
  kind: qo100nb                 # one of the kinds in §1
  tx_capable: true              # implements §6.1; shown as txCapable in §3
  anonymous_view: false         # D3 default per app; the admin can change it
  default_write_level: control  # control (default) | transmit
  levels:                       # first match wins; then the §5.2 defaults
    - {path: "/api/ptt*", level: transmit}
    - {path: "/api/tx/*", method: POST, level: transmit}
    - {path: "/api/settings/radio", method: POST, level: transmit, local_only: false}
    - {path: "/api/settings/pluto-password", method: POST, level: transmit, local_only: true}
  release_request: /api/shack/release   # broker asks here before forcing (§7.5)
  busy: /api/shack/busy         # busy endpoint, consulted by the busy gate
  broker_devices: [pluto]       # classes this app may claim; others are refused
  actions: pad-actions.json     # file in the package (CONTROLLER-PAD.md §3)
  controller_layout: pad-layout.json
exclusive_devices:
  - name: pluto-1
    label: Pluto
    claim: runtime              # broker-managed, not settings-driven
```

| Key | Type | Rule |
|---|---|---|
| `kind` | string | required; one of §1's kinds; two installed apps may not share a kind in v1 |
| `tx_capable` | bool | default false; true requires `levels` to name at least one `transmit` path |
| `anonymous_view` | bool | default false |
| `default_write_level` | `control` \| `transmit` | default `control` |
| `levels[]` | list | `path` is a glob relative to the app's base; `method` optional (default any); `level` required; `local_only` default false (only the `local` device kind passes); `digital` default false, only with `level: transmit`: a §5.5 digital-only right also passes |
| `release_request` | path | required when any `exclusive_devices` entry has `claim: runtime` |
| `busy` | path | (as built, 09/10/2026): the app's busy endpoint. The busy gate consults it before platform, app and OS updates and reboots. `--even-if-busy` overrides an app's busy answer, never a transmission. |
| `broker_devices` | list of classes | the broker refuses claims outside it |
| `actions`, `controller_layout` | file path in the package | validated at install against CONTROLLER-PAD.md's schema |
| `exclusive_devices[].claim` | `settings` \| `runtime` | default `settings` (today's `claims.py` behaviour); `runtime` hands the device to the broker (§7.6) and needs `release_request` |
| `host_libraries` | list of names | (as built, platform 2.0.0-beta.9, module spec 1.4): each name must be on the edition's allow-list (`src/dock360/shack/hostlibs.json`: `faad2`, `sdrplay-api`). Each one is mounted read-only from `/var/lib/dock360/hostlibs/<name>` at `/opt/hostlibs/<name>`, and the container gets `SHACK_HOSTLIBS=/opt/hostlibs`. The folders exist, empty, from install, so a library an administrator installs later (Station › Optional libraries, admin-only) appears without a restart. RADIO-SDR-PLAN §5.6. |

Validation is strict and human-worded like the rest of `manifest.py`. The
generated authoring prompt (`authoring.py`) gains a paragraph for the block.
`SPEC_VERSION` rises (`manifest.py:26`).

**Unknown keys (from platform 2.0.0-beta.9).** A controller refuses to install or update an app whose `openhamshack:` block uses a key it does not know, naming the key and its own version. Controllers before beta.9 **ignore** unknown keys silently, and `min_dock360` is parsed but enforced nowhere. So an app that depends on a newer key must still work, or say clearly what is missing (for `host_libraries`: no `SHACK_HOSTLIBS` means "update the controller"), on an older one.

**`runtime.extra_args` is refused** (from beta.9) in any `shack-` app or any app with an `openhamshack:` block. It was written verbatim as `PodmanArgs=`, so it could mount any host path. A real need gets its own validated key.

## 9. Errors

Every error from the platform or an app follows GUIDE §2's rule
(`{"error": "…"}` with an HTTP status) and adds a machine code:

```json
{"error": "This device has been removed from GM4BRI.", "code": "token_revoked"}
```

- `error`: one whole English sentence, from a catalog (I18N.md), safe to
  show. Never assembled from fragments.
- `code`: snake_case, stable. A client shows its own translation for codes
  it knows and `error` for the rest.
- Extra fields as each section gives (`level`, `needs`, `holder`,
  `retryAfter`, `verdict`).

| Status | Codes |
|---|---|
| 400 | `bad_request`, `use_tv_pairing`, `bad_client_id` |
| 401 | `credentials_required`, `bad_credentials`, `totp_required`, `token_revoked`, `proxy_required`, `ticket_expired` |
| 403 | `device_not_declared`, `level_too_low`, `local_only`, `tx_inhibited`, `licence_refused`, `not_admin` |
| 404 | `not_found`, `app_not_installed` |
| 409 | `device_held`, `device_reserved` (proposed, §7.2), `device_on_air`, `not_holder`, `not_lease_holder` (REMOTE-API §7's two 409s keep their existing bodies and gain this code) |
| 410 | `pair_expired` |
| 412 | `safe_off_running` |
| 429 | `account_locked`, `too_many_codes`, `rate_limited` (+ `retryAfter` seconds) |
| 503 | `app_stopped`, `service_unavailable`, `broker_restarting` (+ `retryAfter`) |

## 10. Where it lives in Dock360

Edition overlay, not a fork (D1). Proposed layout in `~/dock360`:

| Piece | Where |
|---|---|
| Pairing, devices, levels, tickets | `src/dock360/shack/devices.py`, routes in `web/routes/shack_api.py` |
| `forward_auth` endpoint | `GET /internal/shack/auth`, loopback only like `/internal/tls-ask` (`caddy.py:86`), reading the hop identity (`sso.trusted_peer`) |
| Caddy generation | `caddy._proxy_block` gains the §5.3 lines for routes with `openhamshack:`; the front door adds `handle /.well-known/openhamshack` and `handle /api/shack/*` → `_control_plane_proxy_block` (`caddy.py:726`) on the `:80` LAN site (`_lan_sites`, `caddy.py:362`) and the tailnet sites. Only those paths: the admin UI stays on 8800. |
| Reserved module ids | `api`, `ohs`, `internal` (they would shadow front-door paths) |
| mDNS | helper op `ohs.mdns.publish {name, version, kinds, id, https}`: validated, writes `/etc/avahi/services/openhamshack.service` (anything needing root is a named op: CLAUDE.md) |
| Session exemptions | `/api/shack/` and `/.well-known/openhamshack` join `security.PUBLIC_PREFIXES` (`security.py:335`), each route carrying its own authentication, with a test over the prefix as for `/api/alerts/` (`web/app.py:175-185`) |
| Broker | `src/dock360/shack/broker.py`; safe-off recipes `src/dock360/shack/safeoff/<class>.py` |
| Services | `src/dock360/shack/services/` (SERVICES.md), database `/var/lib/dock360/shack/services.db` with its own migrations, backed up with Dock360's |
| `trusted_networks` | edition default adds `100.64.0.0/10` (PLATFORM-PLAN §2.4) |

### 10.1 Update feeds (as built, 09/10/2026)

Feeds are documented in `~/dock360` `docs/openhamshack-feeds.md` (branch
`feature/ohs-edition`). In short: a feed is signed (the master key signs the
platform feed, the modules key the catalogue feed), carries a rising
sequence number, an expiry and a SHA-256 per package. `dock360ctl release
sign-feed` signs one. Feeds never auto-apply in v1.

## 11. Tests the platform must carry

Each executes behaviour (CLAUDE.md house rule), none reads source text.

1. A client forging each `X-OpenHamShack-*` header (once, twice, other
   casing) through the real Caddy binary never reaches the app with its value.
2. A `view` device's `POST` to a control route gets `403 level_too_low` from
   the proxy, for every app in the store catalogue.
3. A request reaching an app's port directly (not through Caddy) gets `401
   proxy_required`.
4. A revoked token: next request `401`; an open stream closes within 10 s; a
   held lease lapses within 6 s.
5. TV pairing: wrong codes rate-limited; poll without `pairSecret` refused;
   the token is delivered once.
6. Broker: an on-air holder is never pre-empted by `auto` or `person`; a
   lapsed on-air lease runs safe-off before the relay opens; a fake app
   killed mid-transmission is safe-off within 8 s (fake devices only).
7. `/.well-known/openhamshack` from a subdomain and from a path route
   resolves every `base` to the right app; contains no user, device or
   address.
8. The mDNS service file changes when an app is installed and when the
   callsign changes.
9. §5.5 (as built 12/10/2026, `tests/test_shack_levels.py`,
   `test_shack_broker.py`, `test_shack_proxy.py`): a TV without the switch
   transmits nothing; with it, a `digital: true` route passes and PTT and TX
   audio do not, through the real Caddy too; the switch needs everything
   else in §5.5; only an administrator's session can set it, never a device
   token; the broker admits the TV only for `"digital": true`.
