import { Outlet, useLocation, useNavigate } from "react-router-dom";
import NavbarForum from "../components/Forum/NavbarForum";
import MobileFooterNavbar from "../components/Forum/MobileFooterNavbar";
import { MobileGlobalSearchDrawer } from "../components/Forum/MobileGlobalSearchDrawer";
import { MobileShellContext } from "../context/MobileShellContext";
import { MOBILE_FOOTER_MAIN_PADDING_BOTTOM } from "../constants/mobileLayout";
import { Box } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import MessengerDock from "../components/Forum/Messenger/MessengerDock";
import { FloatingButtons } from "../components/Forum/FloatingButtons";
import GlobalNewPostModal, { OPEN_NEW_POST_MODAL_EVENT } from "../components/Forum/GlobalNewPostModal";
import GlobalMarketplaceModals from "../components/Marketplace/GlobalMarketplaceModals";
import { getStoredUser } from "../utils/helpers";
import { refreshUserSession } from "../utils/userSession";
import { AuthGateProvider } from "../context/AuthGateContext";

const HIDE_FLOATING_PATHS = new Set([
  "/prijava",
  "/registracija",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/o-nas",
]);

const MAIN_MIN_H = {
  base: "calc(100dvh - 56px)",
  md: "calc(100dvh - 72px)",
};

const MainLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const showMobileFooter = location.pathname !== "/o-nas";
  const isZaMamoRoute = location.pathname === "/za-mamo" || location.pathname.startsWith("/za-mamo/");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const openGlobalSearch = useCallback(() => {
    if (location.pathname !== "/") {
      navigate({ pathname: "/" });
    }
    setGlobalSearchOpen(true);
  }, [location.pathname, navigate]);
  const mobileShellValue = useMemo(() => ({ openGlobalSearch }), [openGlobalSearch]);

  const showFloatingActions = useMemo(() => {
    if (HIDE_FLOATING_PATHS.has(location.pathname)) return false;
    if (location.pathname === "/" && new URLSearchParams(location.search).get("post")) {
      return false;
    }
    return true;
  }, [location.pathname, location.search]);
  const [isMessengerOpen, setIsMessengerOpen] = useState(false);
  const [chatUserId, setChatUserId] = useState(null);
  const [chatDraft, setChatDraft] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      if (location.pathname === "/o-nas") return;
      const userId = e?.detail?.userId ? Number(e.detail.userId) : null;
      const draft = typeof e?.detail?.draft === "string" ? e.detail.draft : null;
      setChatUserId(userId && !Number.isNaN(userId) ? userId : null);
      setChatDraft(draft && draft.trim() ? draft : null);
      setIsMessengerOpen(true);
    };
    window.addEventListener("messenger-open", handler);
    return () => window.removeEventListener("messenger-open", handler);
  }, [location.pathname]);

  useEffect(() => {
    const sync = () => {
      const u = getStoredUser();
      if (!u) {
        setIsMessengerOpen(false);
        setChatUserId(null);
        setChatDraft(null);
      }
    };
    window.addEventListener("auth-changed", sync);
    return () => window.removeEventListener("auth-changed", sync);
  }, []);

  useEffect(() => {
    if (!getStoredUser()) return;
    refreshUserSession(false);
  }, []);

  return (
    <MobileShellContext.Provider value={mobileShellValue}>
    <AuthGateProvider>
    <Box
      flex="1"
      display="flex"
      flexDirection="column"
      minH="100dvh"
      w="100%"
      minW={0}
      maxW="100%"
      overflowX="hidden"
      bg="white"
    >
      <Box as="header" flexShrink={0} w="100%">
        <NavbarForum />
      </Box>
      <Box
        as="main"
        flex="1"
        display="flex"
        flexDirection="column"
        minH={isZaMamoRoute ? "auto" : MAIN_MIN_H}
        w="100%"
        minW={0}
        maxW="100%"
        alignSelf="stretch"
        alignItems="stretch"
        bg="white"
        overflowX="hidden"
        pb={{ base: showMobileFooter ? MOBILE_FOOTER_MAIN_PADDING_BOTTOM : "0", md: "0" }}
      >
        <Box
          flex="1"
          display="flex"
          flexDirection="column"
          minH={isZaMamoRoute ? "auto" : MAIN_MIN_H}
          w="100%"
          minW={0}
          maxW="100%"
          alignItems="stretch"
          bg="white"
        >
          <Outlet />
        </Box>
      </Box>
      {showMobileFooter && <MobileFooterNavbar />}
      <MobileGlobalSearchDrawer isOpen={globalSearchOpen} onClose={() => setGlobalSearchOpen(false)} />
      {showMobileFooter && (
        <MessengerDock
          isOpen={isMessengerOpen}
          initialUserId={chatUserId}
          initialDraft={chatDraft}
          onClose={() => {
            setIsMessengerOpen(false);
            setChatUserId(null);
            setChatDraft(null);
          }}
        />
      )}
      <GlobalNewPostModal />
      <GlobalMarketplaceModals />
      <FloatingButtons
        show={showFloatingActions}
        onNewPost={() => window.dispatchEvent(new CustomEvent(OPEN_NEW_POST_MODAL_EVENT))}
        onMessages={() => window.dispatchEvent(new CustomEvent("messenger-open"))}
      />
    </Box>
    </AuthGateProvider>
    </MobileShellContext.Provider>
  )
}

export default MainLayout
