# OpenBB Add-in for Excel

## Installation

Use Node.js 24 or later with npm. Node.js 22.13 or later in the 22.x release line is also supported.

```bash
npm ci
```

## Development

```bash
npm run dev
```

### Link UI kit

- Clone the [design-system](https://github.com/OpenBB-finance/design-system) to neighbor directory
- Install dependencies
- Link the package:

```bash
cd ../design-system
npm link
```

Then every time after reinstalling dependencies in this project:

```bash
npm link @openbb/ui
```

### .env variables

Use [.env.local](https://vitejs.dev/guide/env-and-mode.html#env-files) file to override values while developing locally.

#### Analytics Configuration

- VITE_ENV: Deployment environment
  - `ONPREM`: Disables analytics for on-premise deployments
  - `DEVELOPMENT`: Disables analytics for development environments
  - `PRODUCTION`: Enables analytics (when PostHog variables are configured)
  - Other values: Enables analytics (when PostHog variables are configured)
- VITE_POSTHOG_API_KEY: PostHog API key (required for analytics)
- VITE_POSTHOG_API_HOST: PostHog API host (required for analytics)

For on-premise deployments, set `VITE_ENV=ONPREM`. Analytics requires both PostHog variables.

### Generate custom functions & integration tests

The functions code and tests generation is done in 2 steps:

1. `spec_generator.py`: generate `spec.json` file from `openapi.json` and `widgets.json`
  1.1. `openapi.json` contains the REST API specification
  1.2. `widgets.json` is a TerminalPro asset that is fetched from [Terminal Pro](https://github.com/OpenBB-finance/terminalpro). It contains the functions that will be exposed in Excel and the providers (source) to be included in each function. Since that is a private repository you need to setup `GITHUB_PAT` in .env - get one [on the settings/tokens page](https://github.com/settings/tokens).
2. `ts_generator.py`: generate `functions.ts` and `functions.full.test.ts` from the `spec.json`

> Note 1: Only endpoints referenced in widgets.json will be translated to spec.json, thus exposed in Excel UI.
> Note 2: When a new provider brings additional parameters (in relation to previous Excel UI version) they are (or should if manually edited) added last in the function signature to avoid breaking previous workbooks.

To generate run:

```bash
conda create -n xl python=3.10 python-dotenv requests
conda activate xl
npm run generate
```

To generate custom functions/tests and update `openapi.json` run:

> Make sure .env.local specifies `VITE_PLATFORM_URL=https://sdk.openbb.co` or other `openapi.json` base url you prefer.

```bash
npm run generate:update
```

## Documentation

The [documentation](https://docs.openbb.co/excel) website should be updated any time the custom functions change. To update the docs go to the [terminal repo](https://github.com/OpenBB-finance/openbb-docs) and run:

```bash
cd OpenBBTerminal/website
python scripts/generate_excel_markdown.py
```

Redeploy the documentation website after updating the reference.

## Deployment

Build, hosting, manifest distribution, and release instructions are in [deployment](DEPLOYMENT.md).

## Usage

Use the [development server](#development) for source edits. Production builds use the [deployment instructions](DEPLOYMENT.md).

To load the add-in in your desktop Excel, use any of the `start` scripts. e.g:

```bash
npm run start
```

> Note: If you are using Mac and need to enable the 'inspect' button in the taskpane, run `npm run office:tools-mac` and restart Excel. To see console and network for custom functions, inspect the taskpane from the sign-in page (before signing in) - the runtime is there and won't be available in other pages.

Alternatively, you can load the add-in manually to Excel on the web by following these steps:

1. Create a build using the [deployment instructions](DEPLOYMENT.md).
2. Go to Insert > Office Add-ins in Excel.
3. Click on the Manage My Add-ins dropdown.
4. Click on Upload My Add-in.
5. Select the manifest file from the `dist` folder.

## Tests

- Tests are split by projects, see `jest.config.js`, unit, integration-full, integration-smoke, etc.
- Running specific tests:

```bash
jest -i <path-to-test-file.ts> -t <partial-describe-content>

# Example
jest --verbose -i tests/integration/functions.smoke.test.ts -t OBB.G

# Output
PASS   integration-smoke  tests/integration/functions.smoke.test.ts
smokeTests
  OBB.GET
    ✓ Empty (4 ms)
    ✓ Full
    ✓ Partial (4 ms)
  OBB.EQUITY.PRICE.HISTORICAL
    ○ skipped 1 symbol
    ○ skipped 2+ symbols
    ○ skipped dates + provider
  OBB.EQUITY.FUNDAMENTAL.BALANCE
    ○ skipped 1 symbol
```

- To re-write snapshots, either delete them before running the test or use `--updateSnapshot`/`-u`

### Unit tests

```bash
npm run test:unit
```

### Integration tests

Set `TEST_PLATFORM_EMAIL` and `TEST_PLATFORM_PASSWORD` in .env.local. This token is the authorization token required to fetch data from OpenBB platform.

- Full

  ```bash
  npm run test:integration-full
  ```

- Smoke

  ```bash
  npm run test:integration-smoke
  ```

  > Smoke tests use the manual [Excel smoke workflow](../.github/workflows/excel-smoke-tests.yml), with credentials configured for its selected environment.

### All projects

```bash
npm run test
```

## Office Add-in React Vite Template

The add-in uses [Office.JS](https://learn.microsoft.com/en-us/office/dev/add-ins/), Vite, and React 18.

## Template origin

This template was generated using the [generator-office](https://www.npmjs.com/package/generator-office) generator which is based on the [Office-Addin-Taskpane-React](https://github.com/OfficeDev/Office-Addin-TaskPane-React) project.

## Browser support

IE11 is unsupported.
