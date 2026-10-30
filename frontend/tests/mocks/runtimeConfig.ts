/**
 * Runtime Config Test Mock
 *
 * Provides a mutable config object for tests. Components that call getConfig()
 * at module level will read from this shared reference, so mutations take effect
 * immediately without needing module re-imports.
 *
 * Usage:
 *   import { mockConfig } from "tests/mocks/runtimeConfig";
 *   // in beforeEach or per-test:
 */
import { vi } from "vitest";

export const mockConfig = {
  urls: {
    backend: "http://localhost:3000",
    ai: "http://localhost:3000/ai",
    database: "",
  },
  authentication: {
    allowEmailLogin: true,
    allowRegistration: true,
    allowForgotPassword: true,
    identityProviders: [] as string[],
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
    openbbCopilot: true,
    documentationLinks: true,
    webSearch: true,
    secFilings: false,
    jinaAi: true,
    aiEnhancements: true,
    saveSkillFromChat: true,
    showCustomKey: true,
  },
  ui: {
    showCompanionMode: false,
    showMinimizeWidget: true,
    showChartGeneration: true,
    showFeedbackButton: false,
    showInviteButton: true,
    showDemoRequestButton: false,
    showEnterpriseTags: true,
    showExternalDocLinks: true,
    showHelpDocumentation: true,
    showChangelog: true,
    showOnboardingQuestions: true,
    showTos: true,
    showCopilotSwitcher: true,
    showRemoveFromOrg: true,
    defaultTheme: "dark" as const,
    odpDownloadInstaller: true,
    showSalesEmail: false,
    showMarketplace: true,
  },
  services: {
    posthog: false,
    hubspotForms: false,
    email: true,
    cloudflareWorker: true,
  },
  data: {
    allowedDbTypes: [] as string[],
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
    description: "",
    keywords: "",
    mainColor: "#0088CC",
    fontFamily: "Inter",
    showFloatingThemePreview: false,
  },
};

vi.mock("~/lib/runtimeConfig", () => ({
  getConfig: () => mockConfig,
  _resetConfig: vi.fn(),
}));
