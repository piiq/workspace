# Marketplace Admin Guide

Publish and manage apps in your Workspace deployment. See the [marketplace reference](marketplace.md) for lifecycle and API definitions, and the [developer guide](developer-marketplace.md) for app submission.

Use the HTTP API for marketplace administration. The admin CLI manages users, organizations, and their backend connections; it has no marketplace commands. All `/admin/marketplace/*` endpoints require a superuser session token.

## Getting Your Token

1. Log in to the frontend as a superuser
2. Open browser DevTools (`F12`)
3. Find your session token in network requests (`Authorization: Bearer <TOKEN>`)

---

## Publishing a Developer's App

A submitted app has `development` status.

### 1. List apps waiting for review

```bash
curl "http://localhost:8080/api/admin/marketplace/apps?status=development" \
  -H "Authorization: Bearer <TOKEN>"
```

Each version has its own `id`:

```json
[
  {
    "id": "77f0acf2-...",
    "name": "Acme Markets",
    "version": "1.0",
    "status": "development"
  },
  {
    "id": "84f8abda-...",
    "name": "Acme Markets",
    "version": "1.2",
    "status": "development"
  }
]
```

Find the version the developer asked you to publish and use its `id` in the next steps.

### 2. Verify the app

Re-run verification to make sure manifests are reachable and valid:

```bash
curl -X POST http://localhost:8080/api/admin/marketplace/apps/<APP_ID>/verify \
  -H "Authorization: Bearer <TOKEN>"
```

Check the response: `verification.status` should be `"ok"`. If there are errors, tell the developer to fix them.

### 3. Publish

```bash
curl -X POST http://localhost:8080/api/admin/marketplace/apps/<APP_ID>/publish \
  -H "Authorization: Bearer <TOKEN>"
```

The app must be in `verified` or `development` status.

If another version of the same app is already published, it gets auto-disabled. Only one version is live at a time.

### 4. Confirm it's live

```bash
curl http://localhost:8080/api/marketplace/apps
```

Confirm the app appears in the public list.

---

## Rolling Back a Version

If a published version has issues, roll back to the previous one:

```bash
# Find the old version (it'll be in "disabled" status)
curl "http://localhost:8080/api/admin/marketplace/apps?status=disabled" \
  -H "Authorization: Bearer <TOKEN>"

# Re-enable it (auto-disables the current published version)
curl -X POST http://localhost:8080/api/admin/marketplace/apps/<OLD_APP_ID>/enable \
  -H "Authorization: Bearer <TOKEN>"
```

---

## Creating Apps Directly (Without Developer)

Create the vendor and app directly:

### Create vendor + app

```bash
curl -X POST http://localhost:8080/api/admin/marketplace/apps \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_name": "Acme Data",
    "vendor_description": "Financial data provider",
    "vendor_website_url": "https://acmedata.com",
    "vendor_thumbnail_url": "https://acmedata.com/vendor-logo.png",
    "documentation_url": "https://docs.acmedata.com",
    "contact_email": "support@acmedata.com",
    "app_name": "Acme Markets",
    "version": "1.0",
    "short_description": "Real-time market data widgets",
    "category": "Real-time Data & Analytics",
    "tagline": "Keep a pulse on the markets with Acme's real-time data widgets.",
    "thumbnail_url": "https://acmedata.com/logo.png",
    "thumbnail_url_dark": "https://acmedata.com/logo-dark.png",
    "thumbnail_url_light": "https://acmedata.com/logo-light.png",
    "media": [
      "https://acmedata.com/screenshot1.png",
      "https://acmedata.com/walkthrough.mp4"
    ],
    "api_key_url": "https://acmedata.com/verify-key",
    "api_key_info_url": "https://acmedata.com/docs/api-keys",
    "more_information_url": "https://acmedata.com/about",
    "backend_base_url": "https://api.acmedata.com",
    "is_built_in": false,
    "auth_type": ["none"]
  }'
```

Common app fields, media formats, and authentication settings are defined in the [developer field reference](developer-marketplace.md#fields). Administrator-specific behavior is:

| Field | Notes |
| --- | --- |
| `vendor_name` | Reuses an existing vendor with the same name. |
| `is_built_in` | `true` skips URL verification for a first-party app. |
| `owner_email` | Assigns ownership to a developer by email. |

The response also includes `created_date` and `updated_date` (auto-populated, not settable). `created_date` is when the app was first submitted; `updated_date` is when any field was last modified or re-verification ran.

### App metadata

Display overrides follow the [manifest override rules](developer-marketplace.md#why-some-fields-override-your-appsjson). Media and authentication formats use the same [media](developer-marketplace.md#supported-media-urls), [API key](developer-marketplace.md#api-key-verification), and [custom authentication](developer-marketplace.md#custom-auth-fields) definitions as developer submissions.

### Add app to existing vendor

If the vendor already exists, use their `vendor_id`:

```bash
curl -X POST http://localhost:8080/api/admin/marketplace/vendors/<VENDOR_ID>/apps \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Acme Analytics",
    "version": "1.0",
    "short_description": "Portfolio analytics widgets",
    "backend_base_url": "https://analytics.acmedata.com",
    "auth_type": ["api_key"]
  }'
```

### Assign ownership to a developer

Set ownership for developer API access:

```bash
curl -X PATCH http://localhost:8080/api/admin/marketplace/apps/<APP_ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"owner_email": "developer@acmedata.com"}'
```

---

## Managing Published Apps

### List all apps

```bash
# All apps
curl http://localhost:8080/api/admin/marketplace/apps \
  -H "Authorization: Bearer <TOKEN>"

# Filter by status
curl "http://localhost:8080/api/admin/marketplace/apps?status=published" \
  -H "Authorization: Bearer <TOKEN>"
```

### Update app fields

All fields are optional. If `backend_base_url`, `apps_json_url`, or `widgets_json_url` change, re-verification runs automatically.

```bash
curl -X PATCH http://localhost:8080/api/admin/marketplace/apps/<APP_ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"short_description": "Updated description"}'
```

Updatable fields: `app_name`, `short_description`, `category`, `tagline`, `thumbnail_url`, `thumbnail_url_dark`, `thumbnail_url_light`, `media`, `api_key_url`, `api_key_info_url`, `more_information_url`, `backend_base_url`, `apps_json_url`, `widgets_json_url`, `is_built_in`, `auth_type`, `auth_fields`, `vendor_name`, `vendor_description`, `vendor_website_url`, `vendor_thumbnail_url`, `documentation_url`, `contact_email`, `owner_email`

> Switching `auth_type` away from `custom` (e.g. `["custom"]` to `["api_key"]`) clears any stored `auth_fields` automatically. Switching *to* `custom` requires `auth_fields` in the same PATCH.

### Disable (temporarily hide)

```bash
curl -X POST http://localhost:8080/api/admin/marketplace/apps/<APP_ID>/disable \
  -H "Authorization: Bearer <TOKEN>"
```

### Re-enable

```bash
curl -X POST http://localhost:8080/api/admin/marketplace/apps/<APP_ID>/enable \
  -H "Authorization: Bearer <TOKEN>"
```

### Remove permanently

Works from any status:

```bash
curl -X POST http://localhost:8080/api/admin/marketplace/apps/<APP_ID>/remove \
  -H "Authorization: Bearer <TOKEN>"
```

### Re-verify

Refresh manifest cache and re-check URLs:

```bash
curl -X POST http://localhost:8080/api/admin/marketplace/apps/<APP_ID>/verify \
  -H "Authorization: Bearer <TOKEN>"
```

---

## Subscription Stats

```bash
curl http://localhost:8080/api/admin/marketplace/apps/<APP_ID>/subscriptions \
  -H "Authorization: Bearer <TOKEN>"
```

Returns `active_count` and `total_count`.

---

## Quick Reference

| Action | Method | Endpoint |
|---|---|---|
| List all apps | `GET` | `/admin/marketplace/apps` |
| List by status | `GET` | `/admin/marketplace/apps?status=development` |
| Create vendor + app | `POST` | `/admin/marketplace/apps` |
| Add app to vendor | `POST` | `/admin/marketplace/vendors/<VENDOR_ID>/apps` |
| Update app | `PATCH` | `/admin/marketplace/apps/<APP_ID>` |
| Publish | `POST` | `/admin/marketplace/apps/<APP_ID>/publish` |
| Disable | `POST` | `/admin/marketplace/apps/<APP_ID>/disable` |
| Re-enable | `POST` | `/admin/marketplace/apps/<APP_ID>/enable` |
| Remove | `POST` | `/admin/marketplace/apps/<APP_ID>/remove` |
| Re-verify | `POST` | `/admin/marketplace/apps/<APP_ID>/verify` |
| Subscription stats | `GET` | `/admin/marketplace/apps/<APP_ID>/subscriptions` |
