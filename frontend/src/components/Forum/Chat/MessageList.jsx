import { useEffect, useRef, useCallback, memo, useMemo } from "react";
import { Box, VStack, HStack, Text, Spinner } from "@chakra-ui/react";
import { hideScrollbarSx } from "../../../utils/helpers";
import ExpandableText from "../../common/ExpandableText";

const MessageRow = memo(function MessageRow({ m, currentUserId }) {
  const rawSender = m.sender_id ?? m.senderId;
  const sid = Number(rawSender);
  const uid = Number(currentUserId);
  const isOwn = Number.isFinite(sid) && Number.isFinite(uid) && sid === uid;
  const timeLabel = useMemo(() => {
    try {
      return new Date(m.created_at).toLocaleTimeString("sl-SI", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, [m.created_at]);

  return (
    <HStack
      justify={isOwn ? "flex-end" : "flex-start"}
      align="flex-end"
      sx={{ contentVisibility: "auto", containIntrinsicSize: "56px 0" }}
    >
      <Box
        maxW="80%"
        px={4}
        py={3}
        rounded="2xl"
        bg={isOwn ? "pink.400" : "gray.100"}
        borderWidth="1px"
        borderColor={isOwn ? "pink.400" : "gray.200"}
      >
        <ExpandableText
          text={m.content}
          maxLines={10}
          fontSize="sm"
          lineHeight="1.5"
          color={isOwn ? "white" : "gray.800"}
          linkTone={isOwn ? "onPrimary" : "default"}
        />
        <HStack justify="flex-end" mt={1} spacing={2}>
          <Text fontSize="xs" color={isOwn ? "whiteAlpha.800" : "gray.500"}>
            {timeLabel}
          </Text>
          {isOwn ? (
            <Text fontSize="xs" color="whiteAlpha.800">
              {m.is_read ? "prebrano" : "poslano"}
            </Text>
          ) : null}
        </HStack>
      </Box>
    </HStack>
  );
});

export default function MessageList({
  messages,
  currentUserId,
  onLoadOlder,
  loadingOlder,
  hasMoreOlder,
  scrollToBottomBehavior = "auto",
}) {
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);
  const prevLenRef = useRef(0);
  const stickBottomRef = useRef(true);
  const olderGateRef = useRef(false);

  useEffect(() => {
    if (bottomRef.current && stickBottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: scrollToBottomBehavior });
    }
  }, [messages?.length, scrollToBottomBehavior]);

  useEffect(() => {
    const n = messages?.length ?? 0;
    const prev = prevLenRef.current;
    prevLenRef.current = n;
    if (n > prev && prev > 0) {
      const last = messages[n - 1];
      const sid = Number(last?.sender_id ?? last?.senderId);
      if (Number.isFinite(sid) && Number.isFinite(Number(currentUserId)) && sid === Number(currentUserId)) {
        stickBottomRef.current = true;
      }
    }
  }, [messages, currentUserId]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickBottomRef.current = nearBottom;
    if (el.scrollTop > 100) {
      olderGateRef.current = false;
    }
    if (!onLoadOlder || !hasMoreOlder || loadingOlder || olderGateRef.current) return;
    if (el.scrollTop < 48) {
      olderGateRef.current = true;
      const prevH = el.scrollHeight;
      const prevTop = el.scrollTop;
      onLoadOlder();
      requestAnimationFrame(() => {
        const el2 = scrollRef.current;
        if (!el2) return;
        const nextH = el2.scrollHeight;
        el2.scrollTop = nextH - prevH + prevTop;
      });
    }
  }, [onLoadOlder, hasMoreOlder, loadingOlder]);

  return (
    <Box
      ref={scrollRef}
      onScroll={onScroll}
      flex="1"
      minH={0}
      bg="white"
      overflowY="auto"
      px={2}
      py={2}
      sx={hideScrollbarSx}
    >
      <VStack align="stretch" spacing={3}>
        {loadingOlder ? (
          <HStack justify="center" py={2}>
            <Spinner size="sm" color="pink.400" />
          </HStack>
        ) : null}
        {messages.map((m) => (
          <MessageRow key={m.id} m={m} currentUserId={currentUserId} />
        ))}
        <Box ref={bottomRef} />
      </VStack>
    </Box>
  );
}
