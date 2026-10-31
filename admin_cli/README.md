# OpenBB Hub Admin CLI & Python Client

A single-file Python tool for managing OpenBB Hub entities and users. It requires Python 3.8 or later and uses the standard library.

Two ways to use:

1. CLI - Command-line interface for shell scripts and manual operations
2. Python Client - `HubAPIClient` class for programmatic access

## Quick Start

Note: On Windows, replace `./openbb-admin` with `py openbb-admin` or `python openbb-admin` in all commands below.

```bash
# Authenticate
./openbb-admin auth login --api-url https://your.backend.url

# Check status
./openbb-admin auth status
```

## Configuration

Auth credentials (token) persisted in `~/.openbb-hub/config.json` (automatically created on first login).

Set `OPENBB_CONFIG_FILE` to use a separate configuration file. Browser tests keep this file inside the checkout's ignored test directory.

Config file structure:

```json
{
  "base_url": "https://your.backend.url",
  "access_token": "your-token-here"
}
```

Available fields:

- `base_url` - API endpoint URL
- `access_token` - Authentication token (set automatically by `auth login`)

Manual configuration:

You can manually edit the config file or set environment variables:

```bash
# Set custom base URL via environment variable
export OPENBB_BASE_URL=http://localhost:8000

# Or edit the config file directly
cat > ~/.openbb-hub/config.json <<EOF
{
  "base_url": "http://localhost:8000",
  "access_token": null
}
EOF

# Then login
./openbb-admin auth login
```

Note: The config file value takes precedence over variable `OPENBB_BASE_URL`.

## Documentation

The CLI is self-documenting. Use `-h` for details on any command.

```bash
./openbb-admin -h
./openbb-admin entity -h
```

## Common Operations

### 1. List Entities

```bash
# List all entities
./openbb-admin entity list

# With pagination
./openbb-admin entity list --page 2 --size 50

# JSON output
./openbb-admin entity list --json
```

### 2. Create an Entity

First, get available entity types:

```bash
./openbb-admin entity-type list
```

Create a config file `new-entity.json`:

```json
{
  "name": "Acme Corp",
  "entity_type_uuid": "your-entity-type-uuid-here",
  "email": "billing@acme.com",
  "company_type": "Investment Firm",
  "organization_size": "10-50",
  "aum": 10000000,
  "country": "USA",
  "admin_email": "admin@acme.com"
}
```

Available Entity Fields:

- `name` (string, required) - Entity name
- `entity_type_uuid` (UUID, required) - Entity type identifier
- `email` (email, required) - Billing/general contact email
- `admin_email` (email, required) - Primary admin email
- `company_type` (string, required) - e.g., "Investment Firm", "Hedge Fund"
- `organization_size` (string, required) - e.g., "10-50", "50-100"
- `aum` (integer, required) - Assets Under Management
- `country` (string, required) - ISO country code or name

Then create:

```bash
./openbb-admin entity create --config new-entity.json
```

Or generate a template:

```bash
./openbb-admin entity sample > new-entity.json
```

Organization roles control administration and sharing. Backend settings `COPILOT_CALLS_PER_DAY` and `FILE_UPLOAD_LIMIT_GB` define the same limits for every user. Usage is counted separately for each account; a 10 GB setting gives each user 10 GB. Individual limit overrides are not supported.

### 3. Update an Entity

Simple update (inline JSON):

```bash
# Set assets under management
./openbb-admin entity update <entity-uuid> --data '{"aum": 20000000}'

# Update multiple fields
./openbb-admin entity update <entity-uuid> --data '{"country": "USA", "aum": 15000000}'
```

Update from file:

Create `update-entity.json`:

```json
{
  "aum": 20000000,
  "country": "USA"
}
```

```bash
./openbb-admin entity update <entity-uuid> --config update-entity.json
```

Available Update Fields (all optional, only include what you want to change):

- `name` - Entity name
- `entity_code` - Entity type UUID
- `email` - Billing email
- `company_type` - Company type
- `organization_size` - Organization size
- `aum` - Assets Under Management
- `country` - Country
- `allow_custom_backends` - Whether members can connect personal backends (default `true`)

### 4. List Users

```bash
# List all users
./openbb-admin user list

# Filter by email
./openbb-admin user list --email john@acme.com

# With pagination
./openbb-admin user list --page 1 --size 50
```

### 5. Add a User

```bash
# Add regular user
./openbb-admin user create <entity-uuid> \
  --email analyst@acme.com \
  --first-name John \
  --last-name Doe \
  --role user

# Add admin user
./openbb-admin user create <entity-uuid> \
  --email admin@acme.com \
  --first-name Jane \
  --last-name Smith \
  --role admin
```

User Creation Fields:

- `entity_uuid` (UUID, required) - Target entity
- `--email` (email, required) - User email
- `--first-name` (string, required) - First name
- `--last-name` (string, required) - Last name
- `--role` (admin|user, optional) - Role assignment (default: user)

The command returns a temporary password for the new user.

### 6. Remove a User

```bash
./openbb-admin user delete analyst@acme.com
```

Note: Regular admins can only delete users within their own entity. Superadmins can delete users from any entity.

### 7. Move User Between Entities

```bash
# Move user to different entity
./openbb-admin user move \
  --entity-uuid <target-entity-uuid> \
  --email user@example.com \
  --role user

# Move and promote to admin
./openbb-admin user move \
  --entity-uuid <target-entity-uuid> \
  --email user@example.com \
  --role admin
```

### 8. Reset User Password

```bash
./openbb-admin user reset-password user@example.com
```

Returns a new temporary password.

### 9. Export a User's Data

Downloads a complete copy of somebody's account as a zip, which they can import
into Workspace.

Exports include current chat history. Re-export older account archives before importing.

```bash
./openbb-admin user export analyst@acme.com --out ./exports
```

Export requires `is_superuser` because the archive contains the account's backend and copilot credentials in plaintext. Entity admins and other non-superusers receive `401`.

Options:

| Flag | Effect |
| --- | --- |
| `--out` | Directory or file path for the archive (default: current directory) |
| `--with-files` | Download the account's uploaded files. See the timing example below. |
| `--include-history` | Include dashboard version history. Much larger archive. |
| `--json` | Print `{"path": ..., "bytes": ...}` instead of the human summary |

#### Why files are opt-in

By default the archive carries the *record* of the user's uploads but not the
files themselves. Downloading blobs dominates the export: on a real account,
160 files took 47 seconds of a 53-second export. That is close enough to a
typical 60-second proxy idle timeout that a user with more uploads would see the
request die mid-flight.

Pass `--with-files` when you want the files, and expect it to be slow. If it
times out over HTTP, run the export directly on the backend instead:

```bash
python -m scripts.export_user_data --email user@example.com --with-files --out ./exports
```

#### Running it against a specific environment

The CLI reads its token from `~/.openbb-hub/config.json`. Log in or save an existing bearer token in that file. The CLI accepts tokens through this file, with no `--token` flag or token environment variable.

```bash
# Option A: log in as your superuser account
./openbb-admin auth login --api-url https://dev.your-backend.url

# Option B: reuse a bearer token you already have
mkdir -p ~/.openbb-hub && cat > ~/.openbb-hub/config.json <<'EOF'
{
  "base_url": "https://dev.your-backend.url",
  "access_token": "<your session token>"
}
EOF

# Confirm which environment and account you are pointed at
./openbb-admin auth status
```

The token is the session UUID issued at login. If the account is not a
superuser the export returns `401`, even though other `user` commands work.

To see exactly which tables travel, what is dropped, and what the import resets,
run this on a backend checkout:

```bash
python -m scripts.user_data_scope
```

The same text ships inside every archive as `SCOPE.txt`.

#### Handling the archive

The zip contains plaintext auth headers for the user's custom backends and copilots because the destination instance uses a different encryption key. Treat the file as a secret and delete it once the user has it.

The archive also contains a `files/` folder with everything the user uploaded.
Those files are not imported into Workspace; they are there so the user
keeps their own copy.

#### Importing into Workspace

The import runs as a local command inside the user's Workspace container and requires no session token.

```bash
docker run -d --name openbb -p 8080:80 \
    -v openbb-data:/data \
    -v /path/to/exports:/import \
    workspace:dev

docker exec openbb openbb-import /import/openbb-export-<email>-<stamp>.zip
docker exec openbb credentials   # admin login, then set the user's password
```

The archive excludes passwords. The Workspace admin must set a password for the imported account.

## Bulk Provisioning

Create Entity + Users in one operation:

Generate template:

```bash
./openbb-admin provision sample > provision.json
```

Edit `provision.json`:

```json
{
  "entity": {
    "name": "Acme Corp",
    "entity_type_uuid": "<entity-type-uuid>",
    "email": "billing@acme.com",
    "company_type": "Investment Firm",
    "organization_size": "10-50",
    "aum": 10000000,
    "country": "USA",
    "admin_email": "admin@acme.com"
  },
  "admins": [
    {
      "email": "admin@acme.com",
      "first_name": "Admin",
      "last_name": "User"
    }
  ],
  "users": [
    {
      "email": "analyst1@acme.com",
      "first_name": "Analyst",
      "last_name": "One"
    },
    {
      "email": "analyst2@acme.com",
      "first_name": "Analyst",
      "last_name": "Two"
    }
  ]
}
```

Validate and apply:

```bash
# Validate configuration
./openbb-admin provision check --config provision.json

# Apply
./openbb-admin provision apply --config provision.json
```

### 9. Manage Data Backends

Data backends are API sources connected by default to an entity. Users in the entity will have these backends available automatically.

```bash
# Add a data backend to an entity
./openbb-admin data-backend add <entity-uuid> \
  --name "my-backend" \
  --url "https://api.example.com"

# Add with authentication headers
./openbb-admin data-backend add <entity-uuid> \
  --name "my-backend" \
  --url "https://api.example.com" \
  --header "Authorization:Bearer token123:headers" \
  --header "api-key:mykey123:query"

# List data backends for an entity
./openbb-admin data-backend list <entity-uuid>

# JSON output
./openbb-admin data-backend list <entity-uuid> --json

# Delete a data backend
./openbb-admin data-backend delete <entity-uuid> --name "my-backend"
```

Header format: `key:value` or `key:value:location` where location is `headers` (default) or `query`.

To restrict members to administrator-configured backends:

```bash
./openbb-admin entity update <entity-uuid> --data '{"allow_custom_backends": false}'
```

Set `allow_custom_backends` to `true` to allow personal backends. The setting applies to every member of that organization, including admins using personal connections. Superusers manage organization backends with `data-backend add`, `list`, and `delete`. Disabling personal backends hides saved personal connections and blocks their creation and updates; their records remain stored. File uploads, single-endpoint widgets, and database connections are unaffected.

## Advanced Examples

### Get Entity Details

```bash
# Human-readable format
./openbb-admin entity show <entity-uuid>

# JSON format
./openbb-admin entity show <entity-uuid> --json
```

## CLI Tips

- Use `--json` flag on any command to get machine-readable output
- All update operations support partial updates (only specify fields you want to change)
- Use `--data` for quick inline updates, `--config` for complex multi-field updates
- Generate templates with `sample` commands to see all available fields

---

## Python Client (`HubAPIClient`)

The `HubAPIClient` class provides programmatic access to the OpenBB Hub API. It's embedded in the same `openbb-admin` file and can be imported directly.

### Import the client

```python
from pathlib import Path

# Load the client from the CLI file
cli_path = Path("admin_cli/openbb-admin")
cli_source = cli_path.read_text()
exec(compile(cli_source[:cli_source.find("def auth_login(args:")], cli_path, "exec"))

# Create client and authenticate
client = HubAPIClient("https://payments.openbb.dev")
token = client.auth_login("your-email@example.com", "your-password")
client.access_token = token

# Now use the client
entities = client.entity_list()
print(entities)
```

## Client Methods

### Authentication

```python
# Login and get access token
token = client.auth_login(email, password)
client.access_token = token
```

### Entity Operations

```python
# List all entities
entities = client.entity_list(page=1, size=100)

# Get entity by UUID
entity = client.entity_get("entity-uuid")

# Create an organization
entity = client.entity_create({
    "name": "Acme Corp",
    "entity_type_uuid": "entity-type-uuid",
    "email": "billing@acme.com",
    "admin_email": "admin@acme.com",
    "company_type": "Investment Firm",
    "organization_size": "10-50",
    "aum": 10000000,
    "country": "USA"
})

# Update entity (smart partial update - only specify changed fields)
client.entity_update("entity-uuid", aum=20000000)
client.entity_update("entity-uuid", country="USA", aum=15000000)
```

### Entity Type Operations

```python
# List entity types
types = client.entity_type_list(page=1, size=100)

# Create entity type
client.entity_type_create(name="Enterprise", code="ENT")
```

### User Operations

```python
# Create user with role name (no need to look up permission UUIDs)
user = client.user_create(
    entity_uuid="entity-uuid",
    email="analyst@acme.com",
    first_name="John",
    last_name="Doe",
    role="user",  # or "admin"
)
print(f"Temp password: {user['temporary_password']}")

# List users
users = client.user_list(page=1, size=100)

# Find user by email
user = client.user_get_by_email("analyst@acme.com")

# Reset password
result = client.user_reset_password("user-uuid")
print(f"New password: {result['temporary_password']}")

# Delete user
client.user_delete("user-uuid")

# Move user to different entity
client.user_update_entity("user-uuid", "new-permissions-uuid")
```

### Permission Map Operations

```python
# List permission maps for an entity
maps = client.permission_map_list("entity-uuid")

# Get permission map by role name
admin_map = client.get_permission_map_by_role("entity-uuid", "admin")
user_map = client.get_permission_map_by_role("entity-uuid", "user")
```

### Data Backend Operations

```python
# Add a data backend to an entity
client.data_backend_add(
    entity_uuid="entity-uuid",
    name="my-backend",
    url="https://api.example.com",
)

# Add with authentication headers
client.data_backend_add(
    entity_uuid="entity-uuid",
    name="my-backend",
    url="https://api.example.com",
    endpoint_headers=[
        {"key": "Authorization", "value": "Bearer token123", "location": "headers"},
        {"key": "api-key", "value": "mykey123", "location": "query"},
    ],
)

# List data backends for an entity
backends = client.data_backend_list("entity-uuid")

# Delete a data backend
client.data_backend_delete("entity-uuid", "my-backend")
```

### Bulk Provisioning

```python
# Create entity + multiple users in one call
results = client.provision_full({
    "entity": {
        "name": "Acme Corp",
        "entity_type_uuid": "entity-type-uuid",
        "email": "billing@acme.com",
        "admin_email": "admin@acme.com",
        "company_type": "Investment Firm",
        "organization_size": "10-50",
        "aum": 10000000,
        "country": "USA"
    },
    "users": [
        {"email": "admin@acme.com", "first_name": "Admin", "last_name": "User", "role": "admin"},
        {"email": "analyst1@acme.com", "first_name": "Analyst", "last_name": "One", "role": "user"},
        {"email": "analyst2@acme.com", "first_name": "Analyst", "last_name": "Two", "role": "user"},
    ]
})

print(f"Entity: {results['entity']['entity_uuid']}")
for user in results["users"]:
    print(f"Created: {user['email']} ({user['role']})")
for failed in results["failed_users"]:
    print(f"Failed: {failed['email']} - {failed['error']}")
```

## Complete Example

```python
from pathlib import Path
import getpass

# Load client
cli_path = Path("admin_cli/openbb-admin")
cli_source = cli_path.read_text()
exec(compile(cli_source[:cli_source.find("def auth_login(args:")], cli_path, "exec"))

# Authenticate
client = HubAPIClient("https://payments.openbb.dev")
email = input("Email: ")
password = getpass.getpass("Password: ")
client.access_token = client.auth_login(email, password)

# Get entity type
entity_types = client.entity_type_list()
entity_type_uuid = entity_types["items"][0]["uuid"]

# Create an organization
entity = client.entity_create({
    "name": "My New Entity",
    "entity_type_uuid": entity_type_uuid,
    "email": "billing@example.com",
    "admin_email": "admin@example.com",
    "company_type": "Investment Firm",
    "organization_size": "10-50",
    "aum": 10000000,
    "country": "USA"
})
print(f"Created entity: {entity['entity_uuid']}")

# Add users
admin = client.user_create(
    entity_uuid=entity["entity_uuid"],
    email="admin@example.com",
    first_name="Admin",
    last_name="User",
    role="admin",
)
print(f"Admin password: {admin['temporary_password']}")

analyst = client.user_create(
    entity_uuid=entity["entity_uuid"],
    email="analyst@example.com",
    first_name="Analyst",
    last_name="One",
    role="user",
)
print(f"Analyst password: {analyst['temporary_password']}")

# Update entity
client.entity_update(entity["entity_uuid"], aum=20000000)
print("Updated assets under management")
```

## Error Handling

```python
try:
    user = client.user_get_by_email("nonexistent@example.com")
except APIError as e:
    print(f"Error {e.status_code}: {e.message}")
```

## CLI vs Python Client

| Operation | CLI | Python Client |
|-----------|-----|---------------|
| Create user with role | `--role admin` | `role="admin"` |
| Partial entity update | `--data '{"aum": 20000000}'` | `entity_update(uuid, aum=20000000)` |
| Bulk provisioning | `provision apply --config file.json` | `provision_full(config_dict)` |
| Find user by email | `user list --email X` | `user_get_by_email(email)` |
| Add data backend | `data-backend add <uuid> --name X --url Y` | `data_backend_add(uuid, name, url)` |

Python client behavior:

- Use role names in place of permission UUIDs: (`"admin"` or `"user"`)
- `entity_update()` fetches the current state and merges partial updates
- `provision_full()` creates entity + all users in a single call
- API failures raise `APIError` exceptions

## Testing

Run the test scripts to verify everything works:

```bash
# Test CLI
bash admin_cli/test-workflow.sh

# Test Python client
python admin_cli/test-api-client.py
```
