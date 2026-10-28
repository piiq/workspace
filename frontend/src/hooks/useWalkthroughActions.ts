import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useShallowSidebarStore } from "~/lib/state/sidebar";

export function useWalkthroughActions() {
  const navigate = useNavigate();
  const setIsHamburgerMenuOpen = useShallowSidebarStore(
    (state) => state.setIsHamburgerMenuOpen,
  );

  return useMemo(
    () => ({
      clickHamburgerMenu: () => setIsHamburgerMenuOpen(true),
      navigateToApps: () => navigate("/app"),
    }),
    [navigate, setIsHamburgerMenuOpen],
  );
}
