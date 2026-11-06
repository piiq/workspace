# Frontend development

OpenBB Workspace is a React + TypeScript web application for financial data visualization and analysis.

For installation and data connections, use the [quickstart](../docs/quickstart.md).

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

### Prerequisites

- [Node.js](https://nodejs.org/en/download/)
- If you are contributing code: Add [Biome](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) VSCode extension.
- [Bun](https://bun.sh/)

### Installation

```bash
bun install --frozen-lockfile
```

`--frozen-lockfile` installs the versions in `bun.lock` and fails if the dependency declarations require a lockfile change. This keeps a checkout's dependencies consistent with CI. Use `bun add`, `bun remove`, or `bun update` for dependency changes.

### Building and running

Note: Use this if you are testing the application. If you are developing the application use the development section below.

```bash
bun run build
```

Optional renderers use the [plugin installation guide](../docs/plugin-installation.md).

```bash
bun run preview
```

This will start the web application on `http://localhost:4173`.

## Development

To start the web application:

```bash
bun run dev
```

This will start the web application in development mode on `http://localhost:1420`.

The development configuration connects to `http://localhost:8000`. Configure the backend's [frontend URL and CORS settings](../docs/deployment.md#deployment-urls-and-cors) for `http://localhost:1420`. Set `VITE_BACKEND_URL`, other API URLs, OAuth client IDs, and analytics settings for your deployment in `.env.local`. Container deployments accept these settings at startup through environment variables; see [container configuration](../docs/deployment.md).

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

## Special things to remember

- Custom class names prefixed with underscore (e.g., `_copy-chart-data-button`) are used to mark HTML elements for easy identification in selectors and testing. The underscore prefix indicates these are developer-defined classes rather than framework or library classes.

## Testing

Use [frontend unit and integration testing](TESTING.md) for commands, mocks, and test conventions, and [browser tests](tests/e2e/README.md) for Playwright setup and deployment checks.
