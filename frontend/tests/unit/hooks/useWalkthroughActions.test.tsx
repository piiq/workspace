import { renderHook } from "@testing-library/react";
import * as router from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useWalkthroughActions } from "~/hooks/useWalkthroughActions";

vi.mock("~/lib/state/sidebar", () => ({
  useShallowSidebarStore: vi.fn((selector) =>
    selector({
      setIsHamburgerMenuOpen: vi.fn(),
    }),
  ),
}));

// Mock router
vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(),
  useParams: vi.fn(() => ({ id: "tab-1" })),
}));

describe("useWalkthroughActions", () => {
  it("should handle navigateToApps", () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);
    const { result } = renderHook(() => useWalkthroughActions());
    result.current.navigateToApps();
    expect(navigate).toHaveBeenCalledWith("/app");
  });

  it("should handle clickHamburgerMenu", async () => {
    const setIsHamburgerMenuOpen = vi.fn();
    const { useShallowSidebarStore } = await import("~/lib/state/sidebar");
    vi.mocked(useShallowSidebarStore).mockImplementation((selector: any) =>
      selector({ setIsHamburgerMenuOpen }),
    );

    const { result } = renderHook(() => useWalkthroughActions());
    result.current.clickHamburgerMenu();
    expect(setIsHamburgerMenuOpen).toHaveBeenCalledWith(true);
  });
});
