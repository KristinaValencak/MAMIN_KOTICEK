import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAppToast } from "../../../context/ApiAlertModalContext.jsx";
import {
  Box,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  VStack,
  Text,
  HStack,
  Button,
  Avatar,
  Spinner,
  IconButton,
  Badge,
  Input,
  InputGroup,
  InputLeftElement,
  useBreakpointValue,
} from "@chakra-ui/react";
import { CloseIcon, SearchIcon, ChevronLeftIcon } from "@chakra-ui/icons";
import { FiMessageSquare, FiInbox } from "react-icons/fi";
import { getStoredUser, hideScrollbarSx } from "../../../utils/helpers";
import { INPUT_LIMITS } from "../../../constants/inputLimits";
import { SEARCH_DEBOUNCE_MS } from "../../../constants/timing";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import ChatWindow from "../Chat/ChatWindow";
import { API_BASE } from "../../../api/config";
import { buildAvatarDisplayUrl } from "../../../utils/cloudinaryUpload";
import {
  MOBILE_FOOTER_MAIN_PADDING_BOTTOM,
  MOBILE_NAV_TOP_OFFSET,
} from "../../../constants/mobileLayout";

function formatPreview(text) {
  if (!text || typeof text !== "string") return "";
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length > 72) return `${t.slice(0, 70)}…`;
  return t;
}

export default function MessengerDock({ isOpen, onClose, initialUserId, initialDraft }) {
  const { toast } = useAppToast();
  const dockRef = useRef(null);
  const isMobile = useBreakpointValue({ base: true, md: false });
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [chats, setChats] = useState([]);
  const [sentPending, setSentPending] = useState([]);
  const [requests, setRequests] = useState([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [listsLoadingMore, setListsLoadingMore] = useState(false);
  const listsLoadingMoreRef = useRef(false);
  const [pagination, setPagination] = useState({
    chats: { limit: 30, offset: 0, total: 0 },
    sent: { limit: 30, offset: 0, total: 0 },
    requests: { limit: 30, offset: 0, total: 0 },
  });
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debouncedSearchQ = useDebouncedValue(searchQ.trim(), SEARCH_DEBOUNCE_MS);
  const [sidebarTab, setSidebarTab] = useState("messages");
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const listScrollRef = useRef(null);

  const MAX_LIST_ITEMS = 500;

  const canLoadMore = useMemo(() => {
    if (sidebarTab === "requests") {
      const p = pagination.requests;
      return requests.length < p.total && requests.length < MAX_LIST_ITEMS;
    }
    const pc = pagination.chats;
    const ps = pagination.sent;
    const moreChats = chats.length < pc.total && chats.length < MAX_LIST_ITEMS;
    const moreSent = sentPending.length < ps.total && sentPending.length < MAX_LIST_ITEMS;
    return moreChats || moreSent;
  }, [sidebarTab, pagination, requests.length, chats.length, sentPending.length]);

  useEffect(() => {
    const sync = () => setCurrentUser(getStoredUser());
    window.addEventListener("auth-changed", sync);
    const onStorage = (e) => {
      if (e.key === "user" || e.key === null) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("auth-changed", sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const loadMessengerLists = useCallback(async () => {
    if (!currentUser) return;
    try {
      setListsLoading(true);
      const limit = 30;
      const [chRes, reqRes, sentRes] = await Promise.all([
        fetch(`${API_BASE}/api/messages/threads?tab=chats&limit=${limit}&offset=0`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`${API_BASE}/api/messages/threads?tab=requests&limit=${limit}&offset=0`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`${API_BASE}/api/messages/threads?tab=sent&limit=${limit}&offset=0`, {
          credentials: "include",
          cache: "no-store",
        }),
      ]);
      const [chD, reqD, sentD] = await Promise.all([chRes.json(), reqRes.json(), sentRes.json()]);
      if (chRes.ok) setChats(Array.isArray(chD.items) ? chD.items.slice(0, MAX_LIST_ITEMS) : []);
      else setChats([]);
      if (reqRes.ok) setRequests(Array.isArray(reqD.items) ? reqD.items.slice(0, MAX_LIST_ITEMS) : []);
      else setRequests([]);
      if (sentRes.ok) setSentPending(Array.isArray(sentD.items) ? sentD.items.slice(0, MAX_LIST_ITEMS) : []);
      else setSentPending([]);

      setPagination({
        chats: chRes.ok && chD.pagination ? chD.pagination : { limit, offset: 0, total: chats.length },
        requests: reqRes.ok && reqD.pagination ? reqD.pagination : { limit, offset: 0, total: requests.length },
        sent: sentRes.ok && sentD.pagination ? sentD.pagination : { limit, offset: 0, total: sentPending.length },
      });
    } catch {
      setChats([]);
      setRequests([]);
      setSentPending([]);
    } finally {
      setListsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination totals are server-driven
  }, [currentUser]);

  const loadMoreLists = useCallback(async () => {
    if (!currentUser || listsLoadingMoreRef.current) return;
    if (!canLoadMore) return;
    listsLoadingMoreRef.current = true;
    setListsLoadingMore(true);
    const limit = 30;

    try {
      if (sidebarTab === "requests") {
        const nextOffset = requests.length;
        const res = await fetch(
          `${API_BASE}/api/messages/threads?tab=requests&limit=${limit}&offset=${nextOffset}`,
          { credentials: "include", cache: "no-store" }
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          const next = Array.isArray(data.items) ? data.items : [];
          setRequests((prev) => [...prev, ...next].slice(0, MAX_LIST_ITEMS));
          if (data.pagination) setPagination((p) => ({ ...p, requests: data.pagination }));
        }
        return;
      }

      const calls = [];
      const moreChats = chats.length < pagination.chats.total && chats.length < MAX_LIST_ITEMS;
      const moreSent = sentPending.length < pagination.sent.total && sentPending.length < MAX_LIST_ITEMS;
      if (moreChats) {
        calls.push(
          fetch(`${API_BASE}/api/messages/threads?tab=chats&limit=${limit}&offset=${chats.length}`, {
            credentials: "include",
            cache: "no-store",
          }).then(async (r) => ({ tab: "chats", ok: r.ok, data: await r.json().catch(() => ({})) }))
        );
      }
      if (moreSent) {
        calls.push(
          fetch(`${API_BASE}/api/messages/threads?tab=sent&limit=${limit}&offset=${sentPending.length}`, {
            credentials: "include",
            cache: "no-store",
          }).then(async (r) => ({ tab: "sent", ok: r.ok, data: await r.json().catch(() => ({})) }))
        );
      }
      const results = await Promise.all(calls);
      results.forEach((r) => {
        if (!r.ok) return;
        if (r.tab === "chats") {
          const items = Array.isArray(r.data.items) ? r.data.items : [];
          setChats((prev) => [...prev, ...items].slice(0, MAX_LIST_ITEMS));
          if (r.data.pagination) setPagination((p) => ({ ...p, chats: r.data.pagination }));
        } else if (r.tab === "sent") {
          const items = Array.isArray(r.data.items) ? r.data.items : [];
          setSentPending((prev) => [...prev, ...items].slice(0, MAX_LIST_ITEMS));
          if (r.data.pagination) setPagination((p) => ({ ...p, sent: r.data.pagination }));
        }
      });
    } catch {
      /* ignore */
    } finally {
      listsLoadingMoreRef.current = false;
      setListsLoadingMore(false);
    }
  }, [
    canLoadMore,
    chats.length,
    currentUser,
    pagination.chats.total,
    pagination.sent.total,
    requests.length,
    sentPending.length,
    sidebarTab,
  ]);

  const onListScroll = useCallback(() => {
    const el = listScrollRef.current;
    if (!el) return;
    if (listsLoading || listsLoadingMore) return;
    if (!canLoadMore) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining < 160) {
      loadMoreLists();
    }
  }, [canLoadMore, listsLoading, listsLoadingMore, loadMoreLists]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFriend(null);
      setSearchQ("");
      setSearchHits([]);
      setSidebarTab("messages");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (isMobile) return;
    const onDown = (e) => {
      const el = dockRef.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      onClose?.();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && !currentUser) {
      onClose?.();
    }
  }, [isOpen, currentUser, onClose]);

  useEffect(() => {
    if (!isOpen || !currentUser) return;
    loadMessengerLists();
    const id = setInterval(loadMessengerLists, 20000);
    return () => clearInterval(id);
  }, [isOpen, currentUser, loadMessengerLists]);

  // Presence heartbeat while messenger is open (no websockets).
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    let cancelled = false;
    const ping = async () => {
      try {
        await fetch(`${API_BASE}/api/presence/ping`, { method: "POST", credentials: "include" });
      } catch {
        /* ignore */
      }
    };
    ping();
    const id = setInterval(() => {
      if (!cancelled && document.visibilityState === "visible") ping();
    }, 20000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (!isOpen || !initialUserId || !currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/messages/thread-with/${Number(initialUserId)}`, {
          credentials: "include",
          cache: "no-store",
        });
        let data = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }
        if (!res.ok) {
          const msg = data.error || data.message || `Napaka pri odpiranju pogovora (${res.status})`;
          console.error("thread-with:", res.status, msg);
          if (!cancelled) {
            toast({ status: "error", title: "Sporočila", description: msg, duration: 5000 });
          }
          return;
        }
        if (cancelled) return;
        const otherUser = data.otherUser || {};
        setSelectedFriend({ id: otherUser.id, username: otherUser.username || "Uporabnik" });
      } catch (err) {
        console.error("thread-with:", err);
        if (!cancelled) {
          toast({
            status: "error",
            title: "Sporočila",
            description: err?.message || "Povezava s strežnikom ni uspela.",
            duration: 5000,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, initialUserId, currentUser, toast]);

  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const q = debouncedSearchQ;
    if (q.length < 2) {
      setSearchHits([]);
      setSearchLoading(false);
      return;
    }
    const ac = new AbortController();
    setSearchLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/search?type=users&q=${encodeURIComponent(q)}&limit=12`,
          { credentials: "include", cache: "no-store", signal: ac.signal }
        );
        let data = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }
        if (!res.ok) {
          const msg = data.error || data.message || `Iskanje ni uspelo (${res.status})`;
          console.error("messenger search:", res.status, msg);
          setSearchHits([]);
          toast({ status: "error", title: "Iskanje", description: msg, duration: 4000 });
          return;
        }
        const items = Array.isArray(data.items) ? data.items : [];
        setSearchHits(items.filter((u) => Number(u.id) !== Number(currentUser.id)));
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error("messenger search:", err);
        setSearchHits([]);
        toast({
          status: "error",
          title: "Iskanje",
          description: err?.message || "Povezava s strežnikom ni uspela.",
          duration: 4000,
        });
      } finally {
        if (!ac.signal.aborted) setSearchLoading(false);
      }
    })();
    return () => ac.abort();
  }, [debouncedSearchQ, isOpen, currentUser, toast]);

  const openWithUser = useCallback(async (userId, usernameFallback) => {
    try {
      const res = await fetch(`${API_BASE}/api/messages/thread-with/${Number(userId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        const msg = data.error || data.message || `Napaka pri odpiranju pogovora (${res.status})`;
        console.error("openWithUser thread-with:", res.status, msg);
        toast({ status: "error", title: "Sporočila", description: msg, duration: 5000 });
        return;
      }
      const other = data.otherUser || {};
      setSelectedFriend({
        id: other.id || Number(userId),
        username: other.username || usernameFallback || "Uporabnik",
      });
      setSearchQ("");
      setSearchHits([]);
      loadMessengerLists();
    } catch (err) {
      console.error("openWithUser:", err);
      toast({
        status: "error",
        title: "Sporočila",
        description: err?.message || "Povezava s strežnikom ni uspela.",
        duration: 5000,
      });
    }
  }, [loadMessengerLists, toast]);

  const conversationRows = useMemo(() => {
    const withKind = (items, kind) =>
      (items || []).map((r) => ({
        ...r,
        _kind: kind,
        _sortAt: r.lastMessageAt ? new Date(r.lastMessageAt).getTime() : 0,
      }));
    return [...withKind(sentPending, "sent"), ...withKind(chats, "chat")].sort(
      (a, b) => b._sortAt - a._sortAt
    );
  }, [chats, sentPending]);

  const removeRequest = (threadId, otherUserId) => {
    setRequests((prev) => prev.filter((x) => x.threadId !== threadId));
    if (selectedFriend && Number(selectedFriend.id) === Number(otherUserId)) {
      setSelectedFriend(null);
    }
  };

  if (!isOpen) return null;

  const selectedId = selectedFriend?.id != null ? Number(selectedFriend.id) : null;

  const content = (
    <>
      <HStack
        px={2}
        py={2}
        bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
        color="white"
        justify="space-between"
        align="center"
        spacing={2}
      >
        <HStack spacing={1} align="center" minW={0}>
          {selectedFriend ? (
            <IconButton
              display={{ base: "flex", md: "none" }}
              aria-label="Nazaj na seznam pogovorov"
              icon={<ChevronLeftIcon boxSize={5} />}
              variant="ghost"
              color="white"
              size="sm"
              rounded="lg"
              flexShrink={0}
              _hover={{ bg: "whiteAlpha.200" }}
              _active={{ bg: "whiteAlpha.300" }}
              onClick={() => setSelectedFriend(null)}
            />
          ) : null}
          <Box
            as="span"
            display="flex"
            alignItems="center"
            justifyContent="center"
            pl={selectedFriend ? 0 : 1}
            role="img"
            aria-label="Sporočila"
          >
            <FiMessageSquare size={22} strokeWidth={2.2} />
          </Box>
        </HStack>
        <HStack spacing={1}>
          <IconButton
            size="sm"
            aria-label="Zapri"
            icon={<CloseIcon boxSize={3} />}
            variant="ghost"
            color="white"
            _hover={{ bg: "whiteAlpha.200", color: "white" }}
            onClick={onClose}
          />
        </HStack>
      </HStack>

      <HStack align="stretch" spacing={0} flex="1" minH={0} h="100%">
        <Box
          display={{ base: selectedFriend ? "none" : "flex", md: "flex" }}
          flexDirection="column"
          w="52px"
          flexShrink={0}
          borderRightWidth="1px"
          borderColor="gray.200"
          bg="white"
          py={2}
          px={1}
        >
          <VStack spacing={2} align="stretch">
            <Button
              size="sm"
              variant={sidebarTab === "messages" ? "solid" : "ghost"}
              colorScheme="pink"
              h="auto"
              py={2.5}
              px={1}
              flexDirection="column"
              gap={1}
              borderRadius="lg"
              onClick={() => setSidebarTab("messages")}
              aria-pressed={sidebarTab === "messages"}
              aria-label="Sporočila"
            >
              <FiMessageSquare size={18} />
              <Text fontSize="9px" fontWeight="700" lineHeight={1.15} textAlign="center">
                Sporočila
              </Text>
            </Button>
            <Button
              size="sm"
              variant={sidebarTab === "requests" ? "solid" : "ghost"}
              colorScheme="pink"
              h="auto"
              py={2.5}
              px={1}
              flexDirection="column"
              gap={1}
              borderRadius="lg"
              onClick={() => setSidebarTab("requests")}
              aria-pressed={sidebarTab === "requests"}
              aria-label={
                requests.length ? `Zahteve, ${requests.length} novih` : "Zahteve"
              }
              position="relative"
            >
              <Box position="relative" display="inline-flex">
                <FiInbox size={18} />
                {requests.length > 0 ? (
                  <Badge
                    position="absolute"
                    top="-6px"
                    right="-10px"
                    colorScheme="pink"
                    borderRadius="full"
                    fontSize="9px"
                    minW="16px"
                    h="16px"
                    px={0.5}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    {requests.length > 9 ? "9+" : requests.length}
                  </Badge>
                ) : null}
              </Box>
              <Text fontSize="9px" fontWeight="700" lineHeight={1.15} textAlign="center">
                Zahteve
              </Text>
            </Button>
          </VStack>
        </Box>

        <Box
          display={{ base: selectedFriend ? "none" : "flex", md: "flex" }}
          flexDirection="column"
          flex={{ base: selectedFriend ? "none" : 1, md: "none" }}
          w={{ base: "auto", sm: "228px", md: "246px" }}
          minW={{ base: 0, sm: "196px" }}
          borderRightWidth={{ base: selectedFriend ? 0 : "1px", md: "1px" }}
          borderColor="gray.100"
          bg="gray.50"
        >
          <>
            <Box p={2} flexShrink={0} borderBottomWidth={sidebarTab === "requests" ? "1px" : "0"} borderColor="gray.100">
              <InputGroup size="sm">
                <InputLeftElement pointerEvents="none" h="32px">
                  <SearchIcon color="gray.400" boxSize={3.5} />
                </InputLeftElement>
                <Input
                  pl={9}
                  bg="white"
                  placeholder="Iskanje uporabnic …"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  maxLength={INPUT_LIMITS.USER_SEARCH}
                  borderRadius="lg"
                  isDisabled={!currentUser}
                  _focus={{
                    borderColor: "brand.300",
                    boxShadow: "0 0 0 1px var(--chakra-colors-brand-300)",
                  }}
                />
              </InputGroup>
              {searchQ.trim().length >= 2 && currentUser && (
                <Box
                  mt={1}
                  maxH="140px"
                  overflowY="auto"
                  bg="white"
                  borderWidth="1px"
                  borderColor="gray.100"
                  rounded="md"
                  boxShadow="sm"
                  sx={hideScrollbarSx}
                >
                  {searchLoading ? (
                    <Box py={3} textAlign="center">
                      <Spinner size="xs" color="brand.500" />
                    </Box>
                  ) : searchHits.length === 0 ? (
                    <Text fontSize="xs" color="gray.500" px={2} py={2}>
                      Ni zadetkov.
                    </Text>
                  ) : (
                    <VStack spacing={0} align="stretch">
                      {searchHits.map((u) => (
                        <HStack
                          key={u.id}
                          px={2}
                          py={2}
                          spacing={2}
                          cursor="pointer"
                          _hover={{ bg: "gray.50" }}
                          onClick={() => {
                            openWithUser(u.id, u.username);
                            setSidebarTab("messages");
                          }}
                        >
                          <Avatar size="xs" name={u.username} src={buildAvatarDisplayUrl(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME, u.avatarUrl)} />
                          <Text fontSize="sm" fontWeight="600" noOfLines={1}>
                            {u.username}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>
                  )}
                </Box>
              )}
            </Box>

            {sidebarTab === "messages" ? (
              <Box
                ref={listScrollRef}
                onScroll={onListScroll}
                flex="1"
                overflowY="auto"
                px={2}
                pb={2}
                sx={hideScrollbarSx}
              >
                {listsLoading && conversationRows.length === 0 ? (
                  <Box py={6} textAlign="center">
                    <Spinner size="sm" color="brand.500" />
                  </Box>
                ) : null}

                {conversationRows.length > 0 && (
                  <VStack spacing={1} align="stretch">
                    {conversationRows.map((r) => {
                      const active = selectedId === Number(r.otherUserId);
                      const unread = Number(r.unreadCount) > 0;
                      return (
                        <HStack
                          key={`${r._kind}-${r.threadId}`}
                          p={2}
                          rounded="lg"
                          borderWidth="1px"
                          borderColor={active ? "brand.300" : "gray.100"}
                          bg="white"
                          spacing={2}
                          cursor="pointer"
                          _hover={{ bg: "gray.50", borderColor: "brand.200" }}
                          onClick={() =>
                            setSelectedFriend({ id: r.otherUserId, username: r.otherUsername })
                          }
                          align="start"
                        >
                          <Avatar size="sm" name={r.otherUsername} flexShrink={0} />
                          <VStack align="start" spacing={0} flex="1" minW={0}>
                            <HStack spacing={2} w="full" justify="space-between">
                              <Text
                                fontSize="sm"
                                fontWeight={unread ? "800" : "600"}
                                noOfLines={1}
                                flex="1"
                              >
                                {r.otherUsername}
                              </Text>
                              {r._kind === "sent" && (
                                <Badge fontSize="9px" colorScheme="gray" variant="subtle">
                                  Čaka
                                </Badge>
                              )}
                              {unread && r._kind === "chat" && (
                                <Badge
                                  fontSize="9px"
                                  colorScheme="pink"
                                  borderRadius="full"
                                  minW="18px"
                                  textAlign="center"
                                >
                                  {r.unreadCount > 9 ? "9+" : r.unreadCount}
                                </Badge>
                              )}
                            </HStack>
                            <Text
                              fontSize="xs"
                              color="gray.500"
                              noOfLines={2}
                              fontWeight={unread ? "600" : "400"}
                            >
                              {formatPreview(r.lastMessagePreview) || "—"}
                            </Text>
                          </VStack>
                        </HStack>
                      );
                    })}
                  </VStack>
                )}

                {!listsLoading && conversationRows.length === 0 ? (
                  <Text fontSize="xs" color="gray.500" px={1} py={4}>
                    Ni pogovorov.
                  </Text>
                ) : null}

                {listsLoadingMore ? (
                  <Box py={3} textAlign="center">
                    <Spinner size="xs" color="brand.500" />
                  </Box>
                ) : null}
              </Box>
            ) : (
              <Box
                ref={listScrollRef}
                onScroll={onListScroll}
                flex="1"
                overflowY="auto"
                p={2}
                display="flex"
                flexDirection="column"
                sx={hideScrollbarSx}
              >
                {listsLoading && requests.length === 0 ? (
                  <Box py={6} textAlign="center">
                    <Spinner size="sm" color="brand.500" />
                  </Box>
                ) : null}
                {requests.length > 0 ? (
                  <VStack spacing={1.5} align="stretch">
                    {requests.map((r) => {
                      const active = selectedId === Number(r.otherUserId);
                      return (
                        <Box
                          key={r.threadId}
                          p={2}
                          rounded="lg"
                          borderWidth="1px"
                          borderColor={active ? "brand.300" : "gray.100"}
                          bg="white"
                          _hover={{ borderColor: "brand.200" }}
                        >
                          <HStack align="start" spacing={2}>
                            <Avatar
                              size="sm"
                              name={r.otherUsername}
                              cursor="pointer"
                              onClick={() =>
                                setSelectedFriend({ id: r.otherUserId, username: r.otherUsername })
                              }
                            />
                            <VStack align="start" spacing={0} flex="1" minW={0}>
                              <Text
                                fontSize="sm"
                                fontWeight="700"
                                noOfLines={1}
                                cursor="pointer"
                                onClick={() =>
                                  setSelectedFriend({ id: r.otherUserId, username: r.otherUsername })
                                }
                              >
                                {r.otherUsername}
                              </Text>
                              <Text fontSize="xs" color="gray.500" noOfLines={2}>
                                {formatPreview(r.lastMessagePreview) || "—"}
                              </Text>
                            </VStack>
                            <VStack spacing={1} flexShrink={0} onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="xs"
                                colorScheme="pink"
                                px={2}
                                minW="auto"
                                onClick={async () => {
                                  const res = await fetch(
                                    `${API_BASE}/api/messages/requests/${r.threadId}/accept`,
                                    { method: "POST", credentials: "include" }
                                  );
                                  if (res.ok) {
                                    removeRequest(r.threadId, r.otherUserId);
                                    loadMessengerLists();
                                  }
                                }}
                              >
                                Dovoli
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                colorScheme="gray"
                                px={2}
                                minW="auto"
                                onClick={async () => {
                                  const res = await fetch(
                                    `${API_BASE}/api/messages/requests/${r.threadId}/decline`,
                                    { method: "POST", credentials: "include" }
                                  );
                                  if (res.ok) {
                                    removeRequest(r.threadId, r.otherUserId);
                                    loadMessengerLists();
                                  }
                                }}
                              >
                                Ne dovoli
                              </Button>
                            </VStack>
                          </HStack>
                        </Box>
                      );
                    })}
                  </VStack>
                ) : null}
                {!listsLoading && requests.length === 0 ? (
                  <Text fontSize="xs" color="gray.500" px={1} py={4}>
                    Ni zahtev.
                  </Text>
                ) : null}

                {listsLoadingMore ? (
                  <Box py={3} textAlign="center">
                    <Spinner size="xs" color="brand.500" />
                  </Box>
                ) : null}
              </Box>
            )}
          </>
        </Box>

        <Box
          flex="1"
          minW={0}
          minH={0}
          h="100%"
          display={{ base: selectedFriend ? "flex" : "none", md: "flex" }}
          flexDirection="column"
          overflow="hidden"
          p={2}
          bg="gray.100"
        >
          {!currentUser ? (
            <VStack flex="1" minH={0} justify="center" spacing={2} color="gray.600">
              <Text fontWeight="600">Za sporočila se prijavi.</Text>
            </VStack>
          ) : (
            <>
              <Box flex="1" minH={0} display="flex" flexDirection="column" overflow="hidden">
                <ChatWindow
                  currentUser={currentUser}
                  friend={selectedFriend}
                  onThreadResolved={loadMessengerLists}
                  initialDraft={
                    initialDraft && selectedFriend?.id && Number(selectedFriend.id) === Number(initialUserId)
                      ? initialDraft
                      : null
                  }
                />
              </Box>
            </>
          )}
        </Box>
      </HStack>
    </>
  );

  if (isMobile) {
    return (
      <Drawer
        isOpen={isOpen}
        placement="bottom"
        onClose={onClose}
        size="full"
        blockScrollOnMount
        trapFocus={false}
      >
        <DrawerOverlay bg="blackAlpha.400" zIndex={1600} />
        <DrawerContent
          borderTopRadius="2xl"
          maxH="92dvh"
          zIndex={6601}
          containerProps={{ zIndex: 1601 }}
          overflow="hidden"
        >
          <DrawerHeader p={0} borderBottomWidth="0" />
          <DrawerBody p={0} overflow="hidden">
            <Box display="flex" flexDirection="column" h="92dvh" overflow="hidden">
              {content}
            </Box>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Box
      ref={dockRef}
      position="fixed"
      zIndex={1550}
      display="flex"
      flexDirection="column"
      top={{ base: MOBILE_NAV_TOP_OFFSET, md: "auto" }}
      bottom={{ base: MOBILE_FOOTER_MAIN_PADDING_BOTTOM, md: "1.25rem" }}
      left={{ base: 2, md: "auto" }}
      right={{ base: 2, md: "1.25rem" }}
      w={{ base: "auto", md: "min(94vw, 840px)" }}
      maxW={{ base: "calc(100vw - 16px)", md: "860px" }}
      borderWidth="1px"
      borderColor="rgba(236, 95, 140, 0.25)"
      bg="white"
      rounded="2xl"
      boxShadow="0 16px 48px rgba(0,0,0,0.18)"
      overflow="hidden"
      h={{
        base: "min(78dvh, 560px)",
        md: "560px",
      }}
      maxH={{ base: "560px", md: "560px" }}
    >
      {content}
    </Box>
  );
}
