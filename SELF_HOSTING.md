# Self-Hosting

This document covers all the ways to self-host MiniQR.

## With Docker 🐋

### Quick Start (prebuilt image)

Pull the prebuilt image from GitHub Container Registry and start the app:

```bash
wget https://github.com/lyqht/mini-qr/raw/main/docker-compose.yml
docker compose up -d
```

The app will be available at [http://localhost](http://localhost) (port 80, proxied by Nginx).

> **Note:** The `docker-compose.yml` embeds its own Nginx config — you only need this one file for the Quick Start. No other files are required.

### Build Locally

To build from source, clone the repository and replace the `image:` line in `docker-compose.yml` with a `build:` section pointing to the local Dockerfile. Then run:

```bash
docker compose up -d --build
```

Or build and run manually:

```bash
docker build -t mini-qr .
docker run -d -p 80:8080 mini-qr
```

## Without Docker 🌐

Compile the application directly using NPM and Vite:

```bash
git clone https://github.com/lyqht/mini-qr.git
cd mini-qr
npm install
npm run build
```

The application builds into the `dist` folder, which can be served from any web server.

Example using PHP's built-in web server:

```bash
cd dist
php -S localhost:8080
```

## Environment Variables

All `VITE_*` variables are **build-time** arguments — they are baked into the static assets at build time and cannot be changed at runtime without rebuilding the image.

| Variable                      | `docker-compose.yml` alias | Description                                                                                       | Default   |
| ----------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------- | --------- |
| `BASE_PATH`                   | `BASE_PATH`                | URL sub-path for deployment (e.g., `/mini-qr` for `domain.com/mini-qr`)                           | `/`       |
| `VITE_HIDE_CREDITS`           | `HIDE_CREDITS`             | Set to `"true"` to hide the footer credits                                                        | `"false"` |
| `VITE_DEFAULT_PRESET`         | `DEFAULT_PRESET`           | Name of the default QR code style preset (e.g., `"plain"`, `"lyqht"`)                             | `""`      |
| `VITE_DEFAULT_DATA_TO_ENCODE` | `DEFAULT_DATA`             | Default text/URL pre-filled in the QR code input field when the app loads                        | `""`      |
| `VITE_QR_CODE_PRESETS`        | `PRESETS`                  | JSON array of custom QR code presets. See [Custom Presets](#custom-presets) below                 | `"[]"`    |
| `VITE_FRAME_PRESET`           | `FRAME_PRESET`             | Name of the default frame preset to apply (e.g., `"Default Frame"`)                              | `""`      |
| `VITE_FRAME_PRESETS`          | `FRAME_PRESETS`            | JSON array of custom frame presets. See [Custom Presets](#custom-presets) below                   | `"[]"`    |
| `VITE_DISABLE_LOCAL_STORAGE`  | `DISABLE_LOCAL_STORAGE`    | Set to `"true"` to prevent the app from loading previously saved settings on startup             | `"false"` |

### Passing Variables via docker-compose

The `docker-compose.yml` maps shorter environment variable names to the full build arg names. Set them on the host before running:

```bash
BASE_PATH=/mini-qr DEFAULT_PRESET=plain DISABLE_LOCAL_STORAGE=true docker compose up -d --build
```

Or create a `.env` file alongside `docker-compose.yml`:

```dotenv
BASE_PATH=/mini-qr
DEFAULT_PRESET=plain
HIDE_CREDITS=false
DISABLE_LOCAL_STORAGE=true
```

Then run:

```bash
docker compose up -d --build
```

### Passing Variables via `docker build`

When building directly, pass each variable as a `--build-arg`:

```bash
docker build \
  --build-arg BASE_PATH=/mini-qr \
  --build-arg VITE_DEFAULT_PRESET=plain \
  --build-arg VITE_DISABLE_LOCAL_STORAGE=true \
  -t mini-qr .
```

## Optional: File-Sharing Feature (Supabase)

MiniQR can optionally let users upload files and share them via a QR code. This
feature is **disabled unless you configure Supabase**. It relies on Supabase
Storage, Postgres (with Row-Level Security), and four Edge Functions that hold
all privileged logic server-side.

> **Security model:** The browser bundle only ever receives the **anon** key.
> Uploads go through short-lived signed URLs minted by an Edge Function, every
> share is validated and expires automatically, and admin actions are gated by
> a server-only `ADMIN_SECRET`. No service-role key or admin password is ever
> shipped to the client.

### 1. Client (build-time) variables

| Variable                 | Description                                                          | Default |
| ------------------------ | -------------------------------------------------------------------- | ------- |
| `VITE_SUPABASE_URL`      | Your Supabase project URL (e.g. `https://xxxx.supabase.co`)          | `""`    |
| `VITE_SUPABASE_ANON_KEY` | Supabase **anon/public** key (safe to expose; never the service key) | `""`    |
| `VITE_SHARE_EXPIRY_DAYS` | Number shown in the upload privacy notice (cosmetic only)            | `7`     |

### 2. Edge Function secrets (server-side only)

Set these with `supabase secrets set` — they are **never** exposed to the browser:

| Secret                      | Description                                                       | Default      |
| --------------------------- | ----------------------------------------------------------------- | ------------ |
| `ADMIN_SECRET`              | Long random string required to access the admin panel             | _(required)_ |
| `SHARE_EXPIRY_DAYS`         | Days before a share auto-expires                                  | `7`          |
| `MAX_UPLOAD_BYTES`          | Max total upload size per share (bytes)                           | `10485760`   |
| `MAX_FILES_PER_SHARE`       | Max number of files per share                                     | `20`         |
| `ORPHAN_GRACE_MINUTES`      | Grace period before abandoned `pending`/`failed` shares are reaped | `60`         |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the
Supabase platform for deployed functions.

### 3. Apply the database migration

Run the migration to create the hardened schema, RLS policies, storage policies,
and the admin audit log:

```bash
supabase db push
# or paste supabase/migrations/0001_harden_qr_files_log.sql into the SQL Editor
```

### 4. Deploy the Edge Functions

```bash
supabase secrets set ADMIN_SECRET="<long-random-secret>" SHARE_EXPIRY_DAYS=7 \
  MAX_UPLOAD_BYTES=10485760 MAX_FILES_PER_SHARE=20

supabase functions deploy share-session
supabase functions deploy share-finalize
supabase functions deploy admin-shares
supabase functions deploy cleanup-expired-shares
```

### 5. Schedule cleanup

Invoke `cleanup-expired-shares` on a schedule (e.g. hourly) to delete expired
shares and reap orphaned uploads. Use Supabase's scheduler / `pg_cron`, or any
external cron hitting the function URL with the `x-admin-secret` header.

## Custom Presets

### QR Code Presets (`VITE_QR_CODE_PRESETS`)

A JSON array of preset objects. Each preset overrides the visual style of the QR code. Required fields: `name`. All standard `qr-code-styling` options are supported.

```json
[
  {
    "name": "My Brand",
    "dotsOptions": { "color": "#ff0000", "type": "rounded" },
    "cornersSquareOptions": { "color": "#ff0000", "type": "extra-rounded" },
    "cornersDotOptions": { "color": "#ff0000" },
    "backgroundOptions": { "color": "#ffffff" }
  }
]
```

Pass as a build arg (escape the JSON or use a `.env` file):

```bash
PRESETS='[{"name":"My Brand","dotsOptions":{"color":"#ff0000","type":"rounded"}}]' docker compose up -d --build
```

### Frame Presets (`VITE_FRAME_PRESETS`)

A JSON array of frame preset objects. Each preset defines the style and optional default text for the frame surrounding the QR code.

```json
[
  {
    "name": "Red Frame",
    "text": "Scan me",
    "position": "bottom",
    "style": {
      "textColor": "#ffffff",
      "backgroundColor": "#cc0000",
      "borderColor": "#cc0000",
      "borderWidth": "2px",
      "borderRadius": "8px",
      "padding": "12px"
    }
  }
]
```

## Deployment Scenarios

### Deploy at root path (default)

```bash
docker compose up -d
```

### Deploy at a subdirectory

```bash
BASE_PATH=/mini-qr docker compose up -d --build
```

### Fixed preset with localStorage disabled

Useful when embedding MiniQR in a branded context where users should always see the configured preset:

```bash
DEFAULT_PRESET=plain DISABLE_LOCAL_STORAGE=true docker compose up -d --build
```

### Hide footer credits

```bash
HIDE_CREDITS=true docker compose up -d --build
```

## Nginx Proxy

The `docker-compose.yml` includes an `nginx-proxy` service that proxies traffic to the MiniQR app container. The Nginx configuration is embedded inline in `docker-compose.yml` under the `configs:` key, so no extra files are needed for the Quick Start.

To override the Nginx config (e.g. for subdirectory deployment or custom headers), replace the `configs.nginx-proxy-conf.content` block in `docker-compose.yml` with your own configuration, or switch to a file-based mount:

```yaml
    volumes:
      - ./nginx-proxy.conf:/etc/nginx/nginx.conf:ro
```

## Customization Example

An example of a self-hosted website with a modified MiniQR app with specific language and preset: https://qrcode.outils.restosducoeur.org/
