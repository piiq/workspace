/**
 * Runtime Configuration — Development Environment
 *
 * This file is loaded via a <script> tag in index.html BEFORE the app bundle,
 * so `window.__APP_CONFIG__` is available when the app initialises.
 *
 * These are NOT canonical defaults — they are values specific to the dev
 * environment (API keys, URLs, feature flags). Canonical defaults live in
 * `src/lib/runtimeConfigSchema.ts` (the Zod schema).
 *
 * For on-prem / self-hosted deployments, replace the values below (or mount a
 * volume over this file) to customise behaviour without rebuilding.
 *
 * For runtime builds (`vite build --mode runtime`), this file is auto-generated
 * from .env vars via the same Zod schema, so it's always in sync.
 */
window.__APP_CONFIG__ = {
  urls: {
    backend: "http://localhost:8000",
    ai: "",
    database: "",
  },
  authentication: {
    allowEmailLogin: true,
    allowRegistration: true,
    allowForgotPassword: true,
    identityProviders: [],
    sendMicrosoftIdToken: false,
    sendOktaIdToken: false,
    sendUserEmailAsHeader: false,
  },
  authProviders: {
    googleClientId: "",
    azureClientId: "",
    azureTenantId: "",
    oktaClientId: "",
    oktaDomain: "",
  },
  copilot: {
    enabled: true,
    openbbCopilot: false,
    documentationLinks: true,
    webSearch: true,
    secFilings: false,
    jinaAi: true,
    aiEnhancements: false,
    saveSkillFromChat: false,
    showCustomKey: true,
  },
  ui: {
    showCompanionMode: false,
    showMinimizeWidget: true,
    showChartGeneration: true,
    showFeedbackButton: true,
    showInviteButton: true,
    showDemoRequestButton: true,
    showEnterpriseTags: true,
    showExternalDocLinks: true,
    showHelpDocumentation: true,
    showChangelog: true,
    showOnboardingQuestions: true,
    showTos: true,
    showCopilotSwitcher: true,
    showRemoveFromOrg: true,
    defaultTheme: "dark",
    odpDownloadInstaller: true,
    showSalesEmail: true,
    showMarketplace: true,
  },
  services: {
    posthog: false,
    hubspotForms: true,
    email: true,
    cloudflareWorker: true,
  },
  data: {
    allowedDbTypes: ["database", "snowflake", "databricks", "clickhouse"],
    openDataPlatformInstallerEnabled: true,
    allowHtmlJsExecution: false,
  },
  mcp: {
    defaultServerEnabled: true,
  },
  plugins: {
    runtimeEnabled: false,
    manifestUrl: "",
  },
  analytics: {
    posthogKey: "",
    posthogUrl: "",
  },
  whiteLabel: {
    name: "OpenBB Workspace",
    shortName: "OpenBB",
    loginImage: "/assets/images/openbb_lettering.svg",
    loginImageDark: "/assets/images/openbb_lettering_light.svg",
    leftSidebarLogo: "",
    leftSidebarLogoDark: "",
    favicon: "/favicon/favicon.ico",
    description: "OpenBB is the only open, AI-native workspace that unifies data, streamlines workflows, and delivers enterprise-grade collaboration and control for teams of all sizes.",
    keywords: "OpenBB Workspace, ai, finance, investment research, financial analysis, data visualization, teams, enterprise, collaborative platform, customizable research tools, financial technology, fintech, market insights",
    mainColor: "#0088CC",
    fontFamily: "Inter",
    showFloatingThemePreview: false,
  },
};
