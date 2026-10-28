import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../mocks/runtimeConfig";
import MenuHomePage from "~/routes/appHome";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});



vi.mock("~/components/LayoutAuth/Skeleton/SettingsLayout", () => ({
  SettingsLayout: ({
    children,
    title,
  }: {
    children: ReactNode;
    title?: string;
  }) => (
    <div data-testid="settings-layout">
      {title && <h1>{title}</h1>}
      {children}
    </div>
  ),
}));

vi.mock("@radix-ui/react-tabs", () => ({
  Content: ({ children, value }: { children: ReactNode; value: string }) => (
    <div role="tabpanel" data-value={value}>
      {children}
    </div>
  ),
}));

describe("MenuHomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.ui.showExternalDocLinks = true;
  });

  it("renders the Help and Documentation title", () => {
    render(
      <BrowserRouter>
        <MenuHomePage />
      </BrowserRouter>,
    );

    expect(screen.getByText("Help and Documentation")).toBeInTheDocument();
  });







  it("renders documentation link when FF is enabled", () => {
    mockConfig.ui.showExternalDocLinks = true;

    render(
      <BrowserRouter>
        <MenuHomePage />
      </BrowserRouter>,
    );

    expect(screen.getByText("Workspace Documentation")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /read documentation/i }),
    ).toBeInTheDocument();
  });

  it("renders external link icon on documentation button", () => {
    mockConfig.ui.showExternalDocLinks = true;

    render(
      <BrowserRouter>
        <MenuHomePage />
      </BrowserRouter>,
    );

    const docLink = screen.getByRole("link", { name: /read documentation/i });
    expect(docLink).toHaveAttribute("href", "https://docs.openbb.co/workspace");
    expect(docLink).toHaveAttribute("target", "_blank");

    const externalIcon = screen.getByTestId("icon-external-link-icon");
    expect(externalIcon).toBeInTheDocument();
    expect(docLink).toContainElement(externalIcon);
  });
});
