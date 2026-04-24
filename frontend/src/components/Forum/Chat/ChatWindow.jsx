import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAppToast } from "../../../context/ApiAlertModalContext.jsx";
import { Box, Text, HStack, Avatar, VStack, Button, Spinner } from "@chakra-ui/react";
import { API_BASE } from "../../../api/config";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

// Keep initial load lightweight on mobile; older messages load on scroll.
const CONV_PAGE = 50;
const POLL_MS = 12000;
const PRESENCE_POLL_MS = 20000;
const TYPING_POLL_MS = 2500;

function normalizeMessage(m) {
  if (!m) return null;
  return {
    ...m,
    sender_id: Number(m.sender_id ?? m.senderId),
    receiver_id: Number(m.receiver_id ?? m.receiverId),
  };
}

export default function ChatWindow({ currentUser, friend, initialDraft, onThreadResolved }) {
  const [messages, setMessages] = useState([]);
  const messagesRef = useRef([]);
  const lastMessageIdRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [threadInfo, setThreadInfo] = useState(null);
  const [draft, setDraft] = useState("");
  const [presenceOnline, setPresenceOnline] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [scrollToBottomBehavior, setScrollToBottomBehavior] = useState("auto");
  const [composerFocused, setComposerFocused] = useState(false);
  const { toast } = useAppToast();

  const friendId = friend?.id;

  useEffect(() => {
    messagesRef.current = messages;
    if (!messages?.length) {
      lastMessageIdRef.current = null;
      return;
    }
    const last = messages[messages.length - 1];
    const id = Number(last?.id);
    lastMessageIdRef.current = Number.isFinite(id) ? id : lastMessageIdRef.current;
  }, [messages]);

  const isIncomingRequest = useMemo(() => {
    if (!threadInfo || !currentUser) return false;
    return threadInfo.status === "pending" && Number(threadInfo.requested_by) !== Number(currentUser.id);
  }, [threadInfo, currentUser]);

  const markRead = useCallback(async () => {
    if (!friendId) return;
    try {
      await fetch(`${API_BASE}/api/messages/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ otherUserId: Number(friendId) }),
      });
    } catch {
      /* ni kritično */
    }
  }, [friendId]);

  const loadInitialWindow = useCallback(async () => {
    if (!friendId) return;
    const res = await fetch(
      `${API_BASE}/api/messages/conversation/${friendId}?limit=${CONV_PAGE}`,
      { credentials: "include" }
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || "Napaka pri branju pogovora");
    }
    const list = (data.messages || []).map(normalizeMessage).filter(Boolean);
    setMessages(list);
    setHasMoreOlder(Boolean(data.hasMore));
    await markRead();
  }, [friendId, markRead]);

  const pollNewer = useCallback(async () => {
    if (!friendId || document.visibilityState === "hidden") return;
    const cur = messagesRef.current;
    if (!cur.length) {
      try {
        await loadInitialWindow();
      } catch (err) {
        setError(err.message);
      }
      return;
    }
    const maxId = Number(lastMessageIdRef.current);
    if (!Number.isFinite(maxId)) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/messages/conversation/${friendId}?afterId=${maxId}&limit=100`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) return;
      const incoming = (data.messages || []).map(normalizeMessage).filter(Boolean);
      if (incoming.length) {
        setScrollToBottomBehavior("auto");
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => Number(m.id)));
          const merged = [...prev];
          incoming.forEach((m) => {
            if (!ids.has(Number(m.id))) merged.push(m);
          });
          merged.sort((a, b) => Number(a.id) - Number(b.id));
          return merged;
        });
        await markRead();
      }
    } catch {
      /* tiho ob osvežitvi */
    }
  }, [friendId, loadInitialWindow, markRead]);

  const pollPresence = useCallback(async () => {
    if (!friendId || document.visibilityState === "hidden") return;
    try {
      const res = await fetch(
        `${API_BASE}/api/presence/status?userIds=${Number(friendId)}&windowSeconds=60`,
        { credentials: "include", cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const item = Array.isArray(data.items) ? data.items[0] : null;
      setPresenceOnline(Boolean(item?.online));
    } catch {
      /* ignore */
    }
  }, [friendId]);

  const pollTyping = useCallback(async () => {
    if (!friendId || document.visibilityState === "hidden") return;
    try {
      const res = await fetch(`${API_BASE}/api/messages/typing/${Number(friendId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setOtherTyping(Boolean(data?.isTyping));
    } catch {
      /* ignore */
    }
  }, [friendId]);

  const setTyping = useCallback(
    async (isTyping) => {
      if (!friendId) return;
      try {
        await fetch(`${API_BASE}/api/messages/typing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ otherUserId: Number(friendId), isTyping: Boolean(isTyping) }),
        });
      } catch {
        /* ignore */
      }
    },
    [friendId]
  );

  const loadOlder = useCallback(async () => {
    if (!friendId || !hasMoreOlder || loadingOlderRef.current) return;
    const first = messagesRef.current[0];
    if (!first?.id) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/messages/conversation/${friendId}?beforeId=${Number(first.id)}&limit=60`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Napaka");
      const older = (data.messages || []).map(normalizeMessage).filter(Boolean);
      setHasMoreOlder(Boolean(data.hasMore));
      if (older.length) {
        setMessages((prev) => [...older, ...prev]);
      }
    } catch {
      /* */
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [friendId, hasMoreOlder]);

  useEffect(() => {
    if (!friendId) return;
    setMessages([]);
    setError("");
    setLoading(true);
    setHasMoreOlder(false);
    setThreadInfo(null);
    setDraft(typeof initialDraft === "string" ? initialDraft : "");
    setPresenceOnline(false);
    setOtherTyping(false);

    let cancelled = false;
    (async () => {
      try {
        // Load conversation window immediately; thread metadata can arrive in parallel.
        const convPromise = loadInitialWindow();
        const threadPromise = fetch(`${API_BASE}/api/messages/thread-with/${friendId}`, {
          credentials: "include",
        })
          .then((r) => r.json().then((j) => ({ ok: r.ok, json: j })))
          .catch(() => ({ ok: false, json: {} }));

        await convPromise;

        const t = await threadPromise;
        if (!cancelled && t.ok) {
          setThreadInfo(t.json?.thread || null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    pollPresence();
    pollTyping();
    const intervalNew = setInterval(() => pollNewer(), POLL_MS);
    const intervalPresence = setInterval(() => pollPresence(), PRESENCE_POLL_MS);
    // Keep typing/seen light on mobile: poll fast only while user is actively composing.
    const intervalTyping = setInterval(() => pollTyping(), composerFocused ? TYPING_POLL_MS : 10000);

    return () => {
      cancelled = true;
      clearInterval(intervalNew);
      clearInterval(intervalPresence);
      clearInterval(intervalTyping);
      setTyping(false);
    };
    // initialDraft: samo ob menjavi sogovornika resetiramo v useEffect telesu
    // eslint-disable-next-line react-hooks/exhaustive-deps -- friendId je edini trigger za nov pogovor
  }, [friendId, loadInitialWindow, pollNewer, pollPresence, pollTyping, setTyping, composerFocused]);

  const handleSend = async (content) => {
    if (!friendId) return;
    setScrollToBottomBehavior("smooth");
    const res = await fetch(`${API_BASE}/api/messages/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ receiverId: Number(friendId), content }),
    });
    const data = await res.json();
    if (!res.ok) {
      setScrollToBottomBehavior("auto");
      if (
        data.error &&
        (data.error.includes("blokade") || data.error.includes("block"))
      ) {
        setBlocked(true);
      }
      throw new Error(data.error || data.message || "Napaka pri pošiljanju sporočila");
    }
    if (data.thread) {
      setThreadInfo((t) => ({
        ...(t || {}),
        id: data.thread.id,
        status: data.thread.status,
        requested_by: Number(data.thread.requested_by),
      }));
    }
    if (data.message) {
      const nm = normalizeMessage(data.message);
      setMessages((prev) => {
        if (prev.some((m) => Number(m.id) === Number(nm.id))) return prev;
        return [...prev, nm].sort((a, b) => Number(a.id) - Number(b.id));
      });
    }
    await markRead();
  };

  const handleAccept = async () => {
    if (!threadInfo?.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/messages/requests/${threadInfo.id}/accept`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Napaka pri sprejemu zahteve");
      setThreadInfo((t) => (t ? { ...t, status: "accepted" } : t));
      toast({ status: "success", title: "Dovoljeno", duration: 2000 });
      onThreadResolved?.();
      try {
        await loadInitialWindow();
      } catch (err) {
        setError(err.message);
      }
    } catch (err) {
      toast({ status: "error", title: "Napaka", description: err.message, duration: 3000 });
    }
  };

  const handleDecline = async () => {
    if (!threadInfo?.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/messages/requests/${threadInfo.id}/decline`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Napaka pri zavrnitvi zahteve");
      toast({ status: "info", title: "Zavrnjeno", duration: 2000 });
      onThreadResolved?.();
      const tRes = await fetch(`${API_BASE}/api/messages/thread-with/${friendId}`, {
        credentials: "include",
      });
      const tData = await tRes.json();
      if (tRes.ok) setThreadInfo(tData.thread || null);
      try {
        await loadInitialWindow();
      } catch (err) {
        setError(err.message);
      }
    } catch (err) {
      toast({ status: "error", title: "Napaka", description: err.message, duration: 3000 });
    }
  };

  if (!friend) {
    return (
      <Box
        flex="1"
        minH={0}
        minW={0}
        bg="white"
        rounded="lg"
        p={6}
        borderWidth="1px"
        borderColor="gray.100"
        textAlign="center"
        color="gray.500"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Text>Izberi pogovor na levi.</Text>
      </Box>
    );
  }

  return (
    <Box
      flex="1"
      minH={0}
      minW={0}
      bg="white"
      rounded="lg"
      p={0}
      borderWidth="1px"
      borderColor="gray.200"
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      <HStack
        flexShrink={0}
        px={4}
        py={2.5}
        minH="48px"
        borderBottomWidth="1px"
        borderColor="gray.200"
        justify="space-between"
        align="center"
        w="100%"
      >
        <HStack spacing={3}>
          <Avatar
            name={friend.username}
            size="sm"
            bg="brand.400"
            color="white"
          />
          <VStack align="start" spacing={0}>
            <Text fontWeight="600" color="gray.800" fontSize="sm">
              {friend.username}
            </Text>
            <HStack spacing={2}>
              <HStack spacing={1.5}>
                <Box
                  w="8px"
                  h="8px"
                  borderRadius="full"
                  bg={presenceOnline ? "green.400" : "gray.400"}
                  flexShrink={0}
                />
                <Text fontSize="xs" color="gray.600" fontWeight="600">
                  {presenceOnline ? "Online" : "Offline"}
                </Text>
              </HStack>
              {otherTyping ? (
                <Text fontSize="xs" color="gray.500">
                  piše …
                </Text>
              ) : null}
            </HStack>
          </VStack>
        </HStack>
      </HStack>

      {isIncomingRequest && (
        <HStack
          flexShrink={0}
          px={4}
          py={2}
          minH="44px"
          borderBottomWidth="1px"
          borderColor="pink.100"
          bg="pink.50"
          justify="flex-end"
          align="center"
          spacing={2}
          w="100%"
        >
          <Button size="sm" colorScheme="pink" onClick={handleAccept}>
            Dovoli
          </Button>
          <Button size="sm" variant="outline" colorScheme="gray" onClick={handleDecline}>
            Ne dovoli
          </Button>
        </HStack>
      )}

      <Box
        flex="1"
        minH={0}
        display="flex"
        flexDirection="column"
        overflow="hidden"
        px={4}
        py={2}
      >
        {loading ? (
          <HStack justify="center" py={10}>
            <Spinner color="pink.400" />
          </HStack>
        ) : error ? (
          <Text fontSize="sm" color="red.500" py={4}>
            {error}
          </Text>
        ) : (
          <MessageList
            messages={messages}
            currentUserId={currentUser?.id != null ? Number(currentUser.id) : undefined}
            loadingOlder={loadingOlder}
            hasMoreOlder={hasMoreOlder}
            onLoadOlder={loadOlder}
            scrollToBottomBehavior={scrollToBottomBehavior}
          />
        )}
      </Box>

      <Box flexShrink={0} px={4} py={3} borderTopWidth="1px" borderColor="gray.200" w="100%">
        <MessageInput
          onSend={handleSend}
          disabled={loading || blocked || isIncomingRequest}
          value={draft}
          onChange={setDraft}
          onTyping={(next) => setTyping(next)}
          onFocusChange={setComposerFocused}
        />
      </Box>
    </Box>
  );
}
