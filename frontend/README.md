# OpenBB Workspace

OpenBB Workspace is a React + TypeScript web application for financial data visualization and analysis.

Connect your own backends or OpenBB Platform instances to supply data. Workspace reads their `widgets.json`, `apps.json`, and `agents.json` declarations and provides generic renderers and utilities. Accounts start without sample dashboards or provider feeds; ticker parameters accept the symbols supplied by the user or backend.

## Tech Stack

- Framework: React 18 + TypeScript
- Build Tool: Vite
- Styling: Tailwind CSS + Radix UI
- State Management: Zustand + React Query (TanStack Query)
- Routing: React Router v6
- Testing: Vitest + Playwright + MSW
- Linting/Formatting: Biome

## Project Structure

```text
src/
├── api/                    # API client functions
├── components/             # React components by domain
│   ├── AI/                 # AI/Copilot features
│   ├── Auth/               # Authentication
│   ├── Charting/           # Chart renderers and controls
│   ├── DataConnectors/     # External data sources
│   ├── ds/                 # Design system (atoms, molecules)
│   ├── General/            # Shared UI components
│   ├── Icons/              # SVG icon components
│   ├── LayoutAuth/         # Authenticated layout
│   ├── Settings/           # User settings
│   └── Widgets/            # Dashboard widgets
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities and business logic
│   ├── contexts/           # React contexts
│   ├── providers/          # Context providers
│   ├── state/              # Zustand stores
│   └── types/              # TypeScript types
├── routes/                 # Page components
├── types/                  # Global types
└── utils/                  # Utility functions

tests/
├── unit/                   # Vitest unit tests
├── e2e/                    # Playwright E2E tests
└── mocks/                  # MSW mock handlers
```

## Documentation

| Document | Purpose |
|----------|---------|
| [TESTING.md](./TESTING.md) | Testing guide, TDD workflow, patterns |
| [REVIEW.md](./REVIEW.md) | PR review checklist |
| [AGENTS.md](../AGENTS.md) | Agent instructions |

## Getting started

To get started with the web application follow the steps below.

### Prerequisites

- [Node.js](https://nodejs.org/en/download/)
- If you are contributing code: Add [Biome](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) VSCode extension.
- [Bun](https://bun.sh/)

### Installation

```bash
bun install
```

### Building and running

Note: Use this if you are testing the application. If you are developing the application use the development section below.

```bash
bun run build
```

Advanced Charts is supplied by the optional `@piiq/tradingview` plugin. See [plugin installation](../docs/plugins.md) for bundled and runtime loading. Chart widgets require a connected UDF-compatible datafeed; Workspace includes no default chart feed.

```bash
bun run preview
```

This will start the web application on `http://localhost:4173`.

## Development

To start the web application:

```bash
bun run dev # or yarn dev, pnpm dev, npm dev
```

This will start the web application in development mode on `http://localhost:1420`.

The development configuration connects to `http://localhost:8000`. Set the backend's `PROURL` to `http://localhost:1420`; its CORS allowlist defaults to the origins of `PROURL` and `FRONTENDURL`. Set `VITE_BACKEND_URL`, other API URLs, OAuth client IDs, and analytics settings for your deployment in `.env.local`. Container deployments accept these settings at startup through environment variables; see [container configuration](../docker/README.md).

### Adding Icons

Workflow to add icons to the project:

1. Get the SVG source:

   - Option A: Export the icon from Figma - Right click on the icon and copy the SVG
   - Option B: Get the icon from [icones.js.org](https://icones.js.org/)

2. Convert the SVG to a sprite symbol:

   - [https://sprite-your-svgs.vercel.app/](https://sprite-your-svgs.vercel.app/) is recommended
   - Paste the SVG into the app
   - Choose an icon slug (e.g., 'bar-chart' for a bar chart icon). you need to make sure the slug is unique (see `app/components/sprite.svg` for existing slugs)
   - Click convert to optimize the SVG and create a symbol
   - Copy the generated symbol

3. Add to sprite file:

   - Open `app/components/sprite.svg`
   - Paste the generated symbol from step 2 inside the `<svg>` tag

4. Run the script to update the `Icon` type:

   - `bun run update-icons`

5. Use the icon:

   - Use the component with the slug name you chose:

   ```jsx
   <Icon id="bar-chart" className="w-4 h-4" />
   ```

This approach keeps icons optimized and easy to manage while maintaining a single sprite file for better performance.

## Special things to remember

- We overrode data-tooltip-delay in the TV files in the lib and assets folder - if grabbing new version need to do this again - 1.5s is too long
- TV classnames may also change, so every time we update TV we need to check the classnames match our selectors
- Custom class names prefixed with underscore (e.g., `_copy-chart-data-button`) are used to mark HTML elements for easy identification in selectors and testing. The underscore prefix indicates these are developer-defined classes rather than framework or library classes.

## Testing

We follow a Test-Driven Development (TDD) approach. See [TESTING.md](./TESTING.md) for the complete testing guide including patterns, examples, and best practices.

### Quick Reference

```bash
# Unit tests (Vitest)
bun run test:unit                    # Run all unit tests
bun run test:unit -- --coverage      # Run with coverage report
bunx vitest tests/unit                # Run in watch mode

# Integration tests
bun run test:integration

# E2E tests (Playwright)
bun run test:e2e                     # Run local browser tests
bun run playwright test tests/e2e --ui   # Run with interactive UI
```

See [the browser test setup](tests/e2e/README.md) for backend dependencies, Chromium installation, and deployment URLs.

### Test Structure

```text
tests/
├── unit/          # Unit tests (components, hooks, utils)
├── e2e/           # End-to-end tests (Playwright)
└── mocks/         # MSW mock handlers for API mocking
```

> For detailed information on writing tests, mocking patterns, TDD workflow, and coverage requirements, see [TESTING.md](./TESTING.md).
