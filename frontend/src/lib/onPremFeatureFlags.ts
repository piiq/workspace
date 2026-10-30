import { getConfig } from "./runtimeConfig";

export type IdentityProvidersAvailable = "google" | "microsoft" | "okta";

export function getEnabledIdentityProviders(): IdentityProvidersAvailable[] {
  const providers = new Set(getConfig().authentication.identityProviders);
  return Array.from(providers).filter(
    (p): p is IdentityProvidersAvailable =>
      p === "google" || p === "microsoft" || p === "okta",
  );
}

export function getAllowedDBTypes(): string[] {
  return getConfig().data.allowedDbTypes;
}

export function getShowDemoRequestButton(): boolean {
  const cfg = getConfig();
  return cfg.ui.showDemoRequestButton && cfg.services.hubspotForms;
}
