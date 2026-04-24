import { Badge, Box, IconButton, VStack } from "@chakra-ui/react";
import { MOBILE_STACK_ABOVE_FOOTER } from "../../constants/mobileLayout";
import { AddIcon } from "@chakra-ui/icons";
import { FiMessageSquare } from "react-icons/fi";
import { useEffect, useState } from "react";
import { API_BASE } from "../../api/config";
import { getStoredUser } from "../../utils/helpers";

export const FloatingButtons = ({ onNewPost, onMessages, show }) => {
  const [user, setUser] = useState(getStoredUser);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [requestTotal, setRequestTotal] = useState(0);

  useEffect(() => {
    const sync = () => setUser(getStoredUser());
    const onStorage = (e) => {
      if (e.key === "user") sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("auth-changed", sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth-changed", sync);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadTotal(0);
      setRequestTotal(0);
      return;
    }

    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const lim = 100;
        const [chRes, reqRes] = await Promise.all([
          fetch(`${API_BASE}/api/messages/threads?tab=chats&limit=${lim}&offset=0`, {
            credentials: "include",
            cache: "no-store",
          }),
          fetch(`${API_BASE}/api/messages/threads?tab=requests&limit=${lim}&offset=0`, {
            credentials: "include",
            cache: "no-store",
          }),
        ]);
        const [chData, reqData] = await Promise.all([
          chRes.json().catch(() => null),
          reqRes.json().catch(() => null),
        ]);

        if (chRes.ok) {
          const items = Array.isArray(chData?.items) ? chData.items : [];
          const total = items.reduce((sum, t) => sum + (Number(t?.unreadCount) || 0), 0);
          if (!cancelled) setUnreadTotal(total);
        }
        if (reqRes.ok) {
          const items = Array.isArray(reqData?.items) ? reqData.items : [];
          const t = reqData?.pagination?.total;
          if (!cancelled) setRequestTotal(Number.isFinite(Number(t)) ? Number(t) : items.length);
        }
      } catch {
        // ignore
      }
    };

    fetchUnread();
    const id = setInterval(fetchUnread, 20000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);

  if (!show || !user) return null;

  const badgeTotal = (Number(requestTotal) || 0) + (Number(unreadTotal) || 0);
  const badgeLabel = badgeTotal > 99 ? "99+" : String(badgeTotal);
  return (
    <Box
      position="fixed"
      bottom={{ base: MOBILE_STACK_ABOVE_FOOTER, md: "2rem" }}
      right={{ base: "1rem", md: "2rem" }}
      zIndex={1150}
    >
      <VStack spacing={3} align="stretch">
        <IconButton
          icon={
            <Box position="relative">
              <FiMessageSquare />
              {badgeTotal > 0 ? (
                <Badge
                  position="absolute"
                  top="-15px"
                  right="-20px"
                  bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
                  color="white"
                  borderRadius="999px"
                  fontSize="xs"
                  minW="20px"
                  h="20px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  boxShadow="0 10px 22px rgba(236, 95, 140, 0.35), 0 2px 8px rgba(0,0,0,0.12)"
                  px={badgeTotal > 9 ? 2 : 0}
                  lineHeight="1"
                  fontWeight="800"
                >
                  {badgeLabel}
                </Badge>
              ) : null}
            </Box>
          }
          aria-label={
            badgeTotal > 0
              ? `Sporočila (${badgeLabel} skupaj: neprebrana + zahteve)`
              : "Sporočila"
          }
          size="lg"
          bg="linear-gradient(135deg, #EC5F8C 0%, #F48FB1 100%)"
          color="white"
          borderRadius="full"
          boxShadow="0 4px 12px rgba(236, 95, 140, 0.35)"
          _hover={{
            bg: "linear-gradient(135deg, #D94B8C 0%, #EC5F8C 100%)",
            transform: "scale(1.1)",
            boxShadow: "0 6px 20px rgba(236, 95, 140, 0.45)",
          }}
          _active={{ transform: "scale(0.95)" }}
          transition="all 0.2s"
          onClick={onMessages}
          title="Sporočila"
        />
        <IconButton
          display={{ base: "none", md: "flex" }}
          icon={<AddIcon />}
          aria-label="Nova objava"
          size="lg"
          bg="#EC5F8C"
          color="white"
          borderRadius="full"
          boxShadow="0 4px 12px rgba(236, 95, 140, 0.4)"
          _hover={{ bg: "#D94B8C", transform: "scale(1.1)", boxShadow: "0 6px 20px rgba(236, 95, 140, 0.5)" }}
          _active={{ transform: "scale(0.95)" }}
          transition="all 0.2s"
          onClick={onNewPost}
          title="Nova objava"
        />
      </VStack>
    </Box>
  );
};
