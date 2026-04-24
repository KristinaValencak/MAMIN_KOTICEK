import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Box, Button, Divider, Flex, HStack, Icon, IconButton, Input, InputGroup, InputLeftElement, Spinner, Stack, Text, VStack } from "@chakra-ui/react";
import { SearchIcon, CloseIcon } from "@chakra-ui/icons";
import { FiShoppingBag, FiUsers } from "react-icons/fi";
import { FaRegFileLines } from "react-icons/fa6";
import { useGlobalSearch } from "../../hooks/search/useGlobalSearch";
import { OPEN_LISTING_DETAIL_MODAL } from "../Marketplace/marketplaceModalConstants";
import { INPUT_LIMITS } from "../../constants/inputLimits";
import { SEARCH_DEBOUNCE_MS } from "../../constants/timing";
import { profilePathForUserId } from "../../utils/helpers";

const TABS = [
  { key: "all", label: "Vse" },
  { key: "users", label: "Uporabniki", icon: FiUsers },
  { key: "posts", label: "Objave", icon: FaRegFileLines },
  { key: "marketplace", label: "Marketplace", icon: FiShoppingBag },
];

const hideScrollbarSx = {
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  WebkitOverflowScrolling: "touch",
  "&::-webkit-scrollbar": {
    display: "none",
    width: 0,
    height: 0,
    background: "transparent",
  },
};

function safeText(v) {
  return String(v || "").trim();
}

function SectionHeader({ title, total }) {
  return (
    <HStack justify="space-between" w="full" px={3} pt={3} pb={2}>
      <Text fontSize="xs" fontWeight="800" color="gray.600" letterSpacing="0.06em">
        {title.toUpperCase()}
      </Text>
      {Number.isFinite(Number(total)) ? (
        <Badge variant="subtle" colorScheme="gray" fontSize="xs">
          {total}
        </Badge>
      ) : null}
    </HStack>
  );
}

function GlobalSearchPresentation({
  searchApi,
  value,
  onChange,
  onTypeChange,
  onSelectPost,
  onNavigate,
  onResultActivated,
  placeholder = "Išči",
  size = "md",
  variant = "panel",
}) {
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const {
    query,
    type: normalizedType,
    canSearch,
    loading,
    error,
    data,
    items,
    hasMore,
    loadMore,
  } = searchApi;

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const onClear = useCallback(() => {
    onChange("");
    setActiveIndex(-1);
    inputRef.current?.focus?.();
  }, [onChange]);

  useEffect(() => {
    const handler = (e) => {
      if (!wrapperRef.current) return;
      if (wrapperRef.current.contains(e.target)) return;
      close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [close]);

  useEffect(() => {
    if (!value?.trim()) setActiveIndex(-1);
  }, [value]);

  const flatResults = useMemo(() => {
    if (!canSearch) return [];
    if (normalizedType === "all") {
      const sections = data?.sections || {};
      const out = [];
      (sections.users?.items || []).forEach((u) => out.push({ kind: "users", item: u }));
      (sections.posts?.items || []).forEach((p) => out.push({ kind: "posts", item: p }));
      (sections.marketplace?.items || []).forEach((l) => out.push({ kind: "marketplace", item: l }));
      return out;
    }
    return items.map((it) => ({ kind: normalizedType, item: it }));
  }, [canSearch, normalizedType, data, items]);

  const activate = useCallback(
    (entry) => {
      if (!entry) return;
      const { kind, item } = entry;
      if (kind === "users") {
        onNavigate?.(profilePathForUserId(item.id));
        close();
        onResultActivated?.();
        return;
      }
      if (kind === "posts") {
        onSelectPost?.(item);
        close();
        onResultActivated?.();
        return;
      }
      if (kind === "marketplace") {
        window.dispatchEvent(
          new CustomEvent(OPEN_LISTING_DETAIL_MODAL, { detail: { listingId: item.id } })
        );
        close();
        onResultActivated?.();
      }
    },
    [onNavigate, onSelectPost, onResultActivated, close]
  );

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (!open) return;
      if (!flatResults.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % flatResults.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length);
        return;
      }
      if (e.key === "Enter") {
        if (activeIndex < 0) return;
        e.preventDefault();
        activate(flatResults[activeIndex]);
      }
    },
    [open, flatResults, activeIndex, close, activate]
  );

  const tab = normalizedType;
  const showPanel = open;
  const panelPositionProps =
    variant === "dropdown"
      ? {
        position: "absolute",
        top: "calc(100% + 10px)",
        left: 0,
        right: 0,
      }
      : { position: "relative" };

  const panelChrome =
    variant === "dropdown"
      ? {
        bg: "white",
        borderWidth: "1px",
        borderColor: "gray.200",
        borderRadius: "md",
        boxShadow: "0 12px 28px rgba(15, 23, 42, 0.1)",
        overflow: "hidden",
      }
      : {
        bg: "transparent",
        borderWidth: "0",
        borderColor: "transparent",
        borderRadius: "0",
        boxShadow: "none",
        overflow: "visible",
      };

  return (
    <Box
      ref={wrapperRef}
      position="relative"
      w="full"
      minW={0}
      overflow="visible"
      zIndex={variant === "dropdown" && open ? 2500 : "auto"}
    >
      <Stack spacing={2}>
        <InputGroup size={size}>
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={INPUT_LIMITS.SEARCH_QUERY}
            placeholder={placeholder}
            bg="linear-gradient(145deg, #f9fafb 0%, #ffffff 100%)"
            borderColor="rgba(236, 95, 140, 0.15)"
            borderRadius="16px"
            borderWidth="2px"
            transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
            _hover={{ borderColor: "rgba(236, 95, 140, 0.3)", bg: "white", transform: "translateY(-1px)" }}
            _focus={{ borderColor: "#EC5F8C", boxShadow: "0 0 0 4px rgba(236, 95, 140, 0.12)", bg: "white" }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            pr={value?.trim() ? 10 : 3}
            aria-label="Global search"
          />
          {value?.trim() ? (
            <IconButton
              aria-label="Počisti"
              icon={<CloseIcon boxSize={3} />}
              size="sm"
              variant="ghost"
              position="absolute"
              right="8px"
              top="50%"
              transform="translateY(-50%)"
              onClick={onClear}
              _hover={{ bg: "gray.100" }}
            />
          ) : null}
        </InputGroup>
      </Stack>

      {showPanel ? (
        <Box
          {...panelPositionProps}
          {...panelChrome}
          mt={variant === "dropdown" ? 0 : 3}
          zIndex={2501}
          w="full"
          minW={0}
          maxW="100%"
          overflowX="hidden"
        >
          <Box
            w="full"
            minW={0}
            overflowX={{ base: "auto", md: "hidden" }}
            overflowY="hidden"
            sx={hideScrollbarSx}
            borderBottomWidth="1px"
            borderColor="gray.200"
            bg="transparent"
          >
            <Flex
              role="tablist"
              w="full"
              align="stretch"
              gap={{ base: 0, md: 1 }}
              px={variant === "dropdown" ? 2 : 0}
              pt={1}
              pb={0}
              flexWrap={{ base: "nowrap", md: "wrap" }}
            >
              {TABS.map((t) => {
                const isActive = tab === t.key;
                return (
                  <Button
                    key={t.key}
                    size="sm"
                    variant="ghost"
                    color={isActive ? "pink.600" : "gray.600"}
                    fontWeight={isActive ? "700" : "500"}
                    borderRadius={{ base: "none", md: "md" }}
                    borderBottom="2px solid"
                    borderColor={isActive ? "pink.500" : "transparent"}
                    mb="-1px"
                    px={{ base: 2, sm: 3 }}
                    py={2}
                    h="auto"
                    minH="40px"
                    flexShrink={{ base: 0, md: 1 }}
                    whiteSpace="nowrap"
                    onClick={() => {
                      onTypeChange?.(t.key);
                      setActiveIndex(-1);
                      setOpen(true);
                      inputRef.current?.focus?.();
                    }}
                    leftIcon={t.icon ? <Icon as={t.icon} boxSize={4} /> : undefined}
                    _hover={{ bg: "blackAlpha.50", color: isActive ? "pink.600" : "gray.800" }}
                    _active={{ bg: "blackAlpha.50" }}
                  >
                    {t.label}
                  </Button>
                );
              })}
            </Flex>
          </Box>

          {loading ? (
            <Box px={4} py={5}>
              <HStack spacing={3}>
                <Spinner size="sm" color="#EC5F8C" />
                <Text fontSize="sm" color="gray.600">
                  Iščem…
                </Text>
              </HStack>
            </Box>
          ) : error ? (
            <Box px={4} py={4}>
              <Text fontSize="sm" color="red.600">
                {error}
              </Text>
            </Box>
          ) : !canSearch ? (
            <Box px={4} py={4} />
          ) : tab === "all" ? (
            <VStack
              align="stretch"
              spacing={0}
              maxH="520px"
              overflowY="auto"
              overflowX="hidden"
              w="full"
              minW={0}
              sx={hideScrollbarSx}
            >
              {["users", "posts", "marketplace"].map((k) => {
                const section = data?.sections?.[k];
                const sectionItems = section?.items || [];
                const total = section?.total ?? 0;
                if (!sectionItems.length) return null;
                const title =
                  k === "users" ? "Ljudje" : k === "posts" ? "Objave" : "Marketplace";
                return (
                  <Box key={k}>
                    <SectionHeader title={title} total={total} />
                    <VStack align="stretch" spacing={0} px={2} pb={2}>
                      {sectionItems.map((it) => {
                        const label =
                          k === "users"
                            ? safeText(it.username)
                            : k === "posts"
                              ? safeText(it.title)
                              : safeText(it.title);
                        const sub =
                          k === "users"
                            ? safeText(it.bio)
                            : k === "posts"
                              ? safeText(it.author)
                              : safeText(it.description);
                        const entry = { kind: k, item: it };
                        const idx = flatResults.findIndex((x) => x.kind === k && x.item?.id === it.id);
                        const isActive = idx === activeIndex;
                        return (
                          <Button
                            key={`${k}-${it.id}`}
                            variant="ghost"
                            justifyContent="flex-start"
                            alignItems="flex-start"
                            w="full"
                            minW={0}
                            maxW="100%"
                            overflow="hidden"
                            h="auto"
                            py={2}
                            px={3}
                            borderRadius="none"
                            bg={isActive ? "pink.50" : "transparent"}
                            _hover={{ bg: "pink.50" }}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => activate(entry)}
                          >
                            <VStack align="start" spacing={0} w="full" minW={0} overflow="hidden">
                              <Text fontSize="sm" fontWeight="700" color="gray.800" noOfLines={1} maxW="100%" overflow="hidden">
                                {label}
                              </Text>
                              {sub ? (
                                <Text fontSize="xs" color="gray.500" noOfLines={1} maxW="100%" overflow="hidden">
                                  {sub}
                                </Text>
                              ) : null}
                            </VStack>
                          </Button>
                        );
                      })}
                    </VStack>
                    <Divider />
                  </Box>
                );
              })}
              {!flatResults.length ? (
                <Box px={4} py={4}>
                  <Text fontSize="sm" color="gray.600">
                    Ni rezultatov za “{query}”.
                  </Text>
                </Box>
              ) : null}
            </VStack>
          ) : (
            <VStack
              align="stretch"
              spacing={0}
              maxH="520px"
              overflowY="auto"
              overflowX="hidden"
              w="full"
              minW={0}
              sx={hideScrollbarSx}
            >
              {items.length === 0 ? (
                <Box px={4} py={4}>
                  <Text fontSize="sm" color="gray.600">
                    Ni rezultatov za “{query}”.
                  </Text>
                </Box>
              ) : (
                <VStack align="stretch" spacing={0} px={2} py={2}>
                  {items.map((it, idx0) => {
                    const idx = idx0;
                    const isActive = idx === activeIndex;
                    const title =
                      tab === "users"
                        ? safeText(it.username)
                        : tab === "posts"
                          ? safeText(it.title)
                          : safeText(it.title);
                    const sub =
                      tab === "users"
                        ? safeText(it.bio)
                        : tab === "posts"
                          ? safeText(it.author)
                          : safeText(it.description);
                    return (
                      <Button
                        key={`${tab}-${it.id}`}
                        variant="ghost"
                        justifyContent="flex-start"
                        alignItems="flex-start"
                        w="full"
                        minW={0}
                        maxW="100%"
                        overflow="hidden"
                        h="auto"
                        py={2}
                        px={3}
                        borderRadius="none"
                        bg={isActive ? "pink.50" : "transparent"}
                        _hover={{ bg: "pink.50" }}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => activate({ kind: tab, item: it })}
                      >
                        <VStack align="start" spacing={0} w="full" minW={0} overflow="hidden">
                          <Text fontSize="sm" fontWeight="700" color="gray.800" noOfLines={1} maxW="100%" overflow="hidden">
                            {title}
                          </Text>
                          {sub ? (
                            <Text fontSize="xs" color="gray.500" noOfLines={1} maxW="100%" overflow="hidden">
                              {sub}
                            </Text>
                          ) : null}
                        </VStack>
                      </Button>
                    );
                  })}
                </VStack>
              )}

              {hasMore ? (
                <Box px={4} py={3} borderTopWidth="1px" borderColor="gray.100" bg="gray.50">
                  <Button size="sm" w="full" onClick={loadMore} colorScheme="pink" variant="outline">
                    Naloži več
                  </Button>
                </Box>
              ) : null}
            </VStack>
          )}
        </Box>
      ) : null}
    </Box>
  );
}

function GlobalSearchWithHook(props) {
  const { value, type, ...rest } = props;
  const normalizedTypeForLimit = String(type || "all").trim().toLowerCase();
  const searchApi = useGlobalSearch({
    query: value,
    type,
    limit: normalizedTypeForLimit === "all" ? 8 : 10,
    debounceMs: SEARCH_DEBOUNCE_MS,
  });
  return <GlobalSearchPresentation searchApi={searchApi} value={value} type={type} {...rest} />;
}

export function GlobalSearch(props) {
  if (props.searchApi) {
    const { searchApi, ...rest } = props;
    return <GlobalSearchPresentation {...rest} searchApi={searchApi} />;
  }
  return <GlobalSearchWithHook {...props} />;
}
