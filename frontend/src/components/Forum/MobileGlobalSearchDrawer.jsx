import { useCallback, useMemo } from "react";
import { Drawer, DrawerBody, DrawerCloseButton, DrawerContent, DrawerHeader, DrawerOverlay, Flex, Text } from "@chakra-ui/react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { GlobalSearch } from "../Search/GlobalSearch";
import { mergeForumPostIntoParams, mergeForumSearchQueryIntoParams, mergeForumSearchTypeIntoParams, parseForumSearchFromSearchParams } from "../../utils/forumSearchParams";

export function MobileGlobalSearchDrawer({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const onForumHome = location.pathname === "/";

  const { searchQuery, searchType } = useMemo(
    () => parseForumSearchFromSearchParams(searchParams),
    [searchParams]
  );

  const applyForumSearchUrl = useCallback(
    (nextParams) => {
      const s = nextParams.toString();
      if (onForumHome) {
        setSearchParams(nextParams, { replace: true });
      } else {
        navigate(s ? `/?${s}` : "/");
      }
    },
    [onForumHome, navigate, setSearchParams]
  );

  const setQuery = useCallback(
    (next) => {
      const base = onForumHome ? new URLSearchParams(searchParams) : new URLSearchParams();
      const st = parseForumSearchFromSearchParams(
        onForumHome ? searchParams : base
      ).searchType;
      applyForumSearchUrl(mergeForumSearchQueryIntoParams(base, next, st));
    },
    [onForumHome, searchParams, applyForumSearchUrl]
  );

  const setType = useCallback(
    (nextType) => {
      const base = onForumHome ? new URLSearchParams(searchParams) : new URLSearchParams();
      const q = parseForumSearchFromSearchParams(
        onForumHome ? searchParams : base
      ).searchQuery;
      applyForumSearchUrl(mergeForumSearchTypeIntoParams(base, q, nextType));
    },
    [onForumHome, searchParams, applyForumSearchUrl]
  );

  const onSelectPost = useCallback(
    (p) => {
      const base = onForumHome ? new URLSearchParams(searchParams) : new URLSearchParams();
      applyForumSearchUrl(mergeForumPostIntoParams(base, p));
    },
    [onForumHome, searchParams, applyForumSearchUrl]
  );

  const onNavigatePath = useCallback(
    (path) => {
      navigate(path);
    },
    [navigate]
  );

  return (
    <Drawer
      isOpen={isOpen}
      placement="bottom"
      onClose={onClose}
      size="full"
      trapFocus={false}
      blockScrollOnMount={false}
    >
      <DrawerOverlay bg="blackAlpha.400" zIndex={1600} />
      <DrawerContent
        borderTopRadius="2xl"
        maxH="92dvh"
        zIndex={6601}
        containerProps={{ zIndex: 1601 }}
      >
        <DrawerHeader borderBottomWidth="1px" borderColor="gray.200" pb={4}>
          <Flex justify="space-between" align="center">
            <Text fontSize="xl" fontWeight="700" color="gray.800">
              Iskanje
            </Text>
            <DrawerCloseButton
              position="relative"
              top={0}
              right={0}
              onMouseUp={(e) => e.currentTarget.blur()}
            />
          </Flex>
        </DrawerHeader>
        <DrawerBody pt={4} pb="calc(1rem + env(safe-area-inset-bottom, 0px))" overflowX="hidden" minW={0}>
          <GlobalSearch
            value={searchQuery}
            onChange={setQuery}
            type={searchType}
            onTypeChange={setType}
            onSelectPost={onSelectPost}
            onNavigate={onNavigatePath}
            onResultActivated={onClose}
            variant="panel"
            size="md"
            placeholder="Išči objave, uporabnice, oglase…"
          />
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
