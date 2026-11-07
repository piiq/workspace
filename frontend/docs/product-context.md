# Workspace architecture

The browser application renders dashboards, data connections, and agent conversations. Users supply their own data; the first-launch experience is documented in the [quickstart](../../docs/quickstart.md).

## Components

- [Frontend](../README.md): React, Zustand, and TanStack Query manage the interface, widget state, and browser requests.
- [Workspace backend](../../backend/README.md): FastAPI handles accounts, organizations, permissions, saved dashboards, uploads, and background work. The API and RQ worker share database, storage, and Redis settings.
- Connected data backends: external services declare widgets and app layouts, then serve their endpoint data. These services are configured per deployment or account.
- External agents and MCP servers: connected services provide agent conversations and tools. Workspace's own MCP implementation is under [backend/workspace_mcp](../../backend/workspace_mcp/).
- [Plugins](../../docs/plugins.md): installed browser modules provide widget renderers and grid capabilities through the SDK.

## Data and state

Widget declarations select an endpoint, renderer, parameters, and optional data-processing settings. The backend stores uploads, dashboard definitions, and widget settings.

The [widget specification](../../backend/workspace_mcp/app_builder/resources/specs/widgets-json.md) and [app specification](../../backend/workspace_mcp/app_builder/resources/specs/apps-json.md) define backend declarations. [Plugin development](../../docs/plugins.md) defines renderer IDs and host interfaces, including widget state and agent data publication.

Database, storage, URLs, and runtime configuration are documented in [deployment](../../docs/deployment.md). Code-review criteria belong in [review guidelines](../REVIEW.md).
