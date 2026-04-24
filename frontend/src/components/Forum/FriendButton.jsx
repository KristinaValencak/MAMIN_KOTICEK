import { useState, useEffect, useCallback } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { Button, ButtonGroup, IconButton, Menu, MenuButton, MenuList, MenuItem, Tooltip, HStack, Spinner } from "@chakra-ui/react";
import { ChevronDownIcon } from "@chakra-ui/icons";
import { FiUserPlus, FiCheck, FiClock } from "react-icons/fi";
import { API_BASE } from "../../api/config";
import { getApiErrorMessageFromBody } from "../../utils/parseApiError.js";

const FRIEND_REQUEST_UPDATED_EVENT = "friend-request-updated";

/**
 * @param {number} userId — drug uporabnik (profil)
 * @param {(info: { status: string, requestId?: number }) => void} [onRelationshipChange]
 * @param {() => void} [onOpenReportProfile]
 */
export default function FriendButton({ userId, onRelationshipChange, onOpenReportProfile, publicProfile: _publicProfile, ...buttonProps }) {
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useAppToast();
  const publicProfile = Boolean(_publicProfile);

  const applyInfo = useCallback(
    (next) => {
      setInfo(next);
      onRelationshipChange?.(next);
    },
    [onRelationshipChange]
  );

  const fetchStatus = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/friends/status/${userId}`, {
        credentials: "include",
      });
      if (res.status === 401) {
        applyInfo({ status: "unauthorized" });
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(getApiErrorMessageFromBody(data) || "Napaka");
      }
      applyInfo(data);
    } catch (err) {
      toast({
        status: "error",
        title: "Napaka",
        description: err.message,
      });
      applyInfo({ status: "error" });
    } finally {
      setLoading(false);
    }
  }, [userId, applyInfo, toast]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    const onFriendRequestUpdated = (e) => {
      const d = e?.detail || {};
      // If any friend-request action happened for this profile pair, refresh.
      if (d?.otherUserId != null && Number(d.otherUserId) === Number(userId)) {
        fetchStatus();
      }
    };
    window.addEventListener(FRIEND_REQUEST_UPDATED_EVENT, onFriendRequestUpdated);
    return () => window.removeEventListener(FRIEND_REQUEST_UPDATED_EVENT, onFriendRequestUpdated);
  }, [fetchStatus, userId]);

  const handleSendRequest = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/friends/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ receiverId: userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(getApiErrorMessageFromBody(data) || "Napaka pri pošiljanju prošnje");
      }
      applyInfo({ status: "pending_sent" });
      toast({
        status: "success",
        title: "Prošnja poslana",
        description: "Uporabnik bo prejel prošnjo za prijateljstvo.",
      });
      const requestId = data?.requestId != null ? Number(data.requestId) : null;
      window.dispatchEvent(
        new CustomEvent(FRIEND_REQUEST_UPDATED_EVENT, {
          detail: { action: "sent", otherUserId: userId, requestId: Number.isFinite(requestId) ? requestId : undefined },
        })
      );
    } catch (err) {
      toast({
        status: "error",
        title: "Napaka",
        description: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/friends/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(getApiErrorMessageFromBody(data) || "Napaka");
      }
      toast({
        status: "success",
        title: "Prijateljstvo odstranjeno",
      });
      await fetchStatus();
    } catch (err) {
      toast({
        status: "error",
        title: "Napaka",
        description: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlock = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/friends/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ blockedId: userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(getApiErrorMessageFromBody(data) || "Napaka pri blokiranju");
      }
      toast({
        status: "success",
        title: "Uporabnik blokiran",
        description: "Prijateljstvo je prekinjeno, sporočila niso več mogoča.",
      });
      applyInfo({ status: "blocked", blockedByMe: true });
    } catch (err) {
      toast({
        status: "error",
        title: "Napaka",
        description: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async (requestId) => {
    if (!requestId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/friends/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(getApiErrorMessageFromBody(data) || "Napaka");
      }
      toast({ status: "success", title: "Prijateljstvo sprejeto" });
      applyInfo({ status: "friends" });
      window.dispatchEvent(
        new CustomEvent(FRIEND_REQUEST_UPDATED_EVENT, {
          detail: { action: "accepted", otherUserId: userId, requestId },
        })
      );
    } catch (err) {
      toast({
        status: "error",
        title: "Napaka",
        description: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (requestId) => {
    if (!requestId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/friends/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(getApiErrorMessageFromBody(data) || "Napaka");
      }
      toast({ status: "info", title: "Prošnja zavrnjena" });
      applyInfo({ status: "none" });
      window.dispatchEvent(
        new CustomEvent(FRIEND_REQUEST_UPDATED_EVENT, {
          detail: { action: "rejected", otherUserId: userId, requestId },
        })
      );
    } catch (err) {
      toast({
        status: "error",
        title: "Napaka",
        description: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/friends/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(getApiErrorMessageFromBody(data) || "Napaka pri preklicu prošnje");
      }
      toast({ status: "info", title: "Prošnja preklicana" });
      applyInfo({ status: "none" });
      window.dispatchEvent(
        new CustomEvent(FRIEND_REQUEST_UPDATED_EVENT, {
          detail: { action: "cancelled", otherUserId: userId },
        })
      );
    } catch (err) {
      toast({
        status: "error",
        title: "Napaka",
        description: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (info?.status === "unauthorized") {
    return null;
  }

  if (info?.status === "blocked") {
    return null;
  }

  if (loading) {
    return (
      <Button
        size="sm"
        isDisabled
        leftIcon={<Spinner size="sm" />}
        variant="outline"
        {...buttonProps}
      >
        Nalaganje…
      </Button>
    );
  }

  if (info?.status === "friends") {
    const friendsLabelButton = (
      <Button
        leftIcon={<FiCheck />}
        colorScheme="pink"
        variant="outline"
        isDisabled
        borderRightRadius={0}
        borderLeftRadius="full"
        rounded="full"
        opacity={1}
        cursor="default"
        _disabled={{ opacity: 1, cursor: "default" }}
      >
        Prijatelja
      </Button>
    );
    return (
      <ButtonGroup isAttached size="sm" {...buttonProps}>
        {publicProfile ? friendsLabelButton : (
          <Tooltip label="Sta prijatelja" hasArrow>
            {friendsLabelButton}
          </Tooltip>
        )}
        <Menu>
          <MenuButton
            as={IconButton}
            icon={<ChevronDownIcon />}
            aria-label="Možnosti prijateljstva"
            colorScheme="pink"
            variant="outline"
            borderLeftRadius={0}
            borderRightRadius="full"
            rounded="full"
            isLoading={actionLoading}
          />
          <MenuList zIndex={1500} fontSize="sm">
            {onOpenReportProfile ? (
              <MenuItem
                onClick={() => {
                  onOpenReportProfile();
                }}
              >
                Prijavi neprimeren profil
              </MenuItem>
            ) : null}
            <MenuItem onClick={handleRemove}>Odstrani prijatelja</MenuItem>
            <MenuItem color="red.500" onClick={handleBlock}>
              Blokiraj
            </MenuItem>
          </MenuList>
        </Menu>
      </ButtonGroup>
    );
  }

  if (info?.status === "pending_sent") {
    return (
      <ButtonGroup isAttached size="sm" {...buttonProps}>
        <Button
          leftIcon={<FiClock />}
          colorScheme="pink"
          variant="outline"
          borderRightRadius={0}
          borderLeftRadius="full"
          rounded="full"
          isDisabled={actionLoading}
        >
          Čakanje
        </Button>
        <Menu>
          <MenuButton
            as={IconButton}
            icon={<ChevronDownIcon />}
            aria-label="Možnosti prošnje"
            colorScheme="pink"
            variant="outline"
            borderLeftRadius={0}
            borderRightRadius="full"
            rounded="full"
            isLoading={actionLoading}
          />
          <MenuList zIndex={1500} fontSize="sm">
            <MenuItem onClick={handleCancelRequest}>Prekliči prošnjo</MenuItem>
          </MenuList>
        </Menu>
      </ButtonGroup>
    );
  }

  if (info?.status === "pending_received") {
    return (
      <HStack spacing={2} flexWrap="wrap" {...buttonProps}>
        <Button
          size="sm"
          bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
          color="white"
          _hover={{ bgGradient: "linear(135deg, #D94B8C 0%, #EC5F8C 100%)" }}
          _active={{ transform: "translateY(0)" }}
          rounded="full"
          onClick={() => handleAccept(info.requestId)}
          isLoading={actionLoading}
        >
          Sprejmi
        </Button>
        <Button
          size="sm"
          variant="outline"
          colorScheme="pink"
          rounded="full"
          onClick={() => handleReject(info.requestId)}
          isDisabled={actionLoading}
        >
          Zavrni
        </Button>
      </HStack>
    );
  }

  return (
    <Button
      leftIcon={<FiUserPlus />}
      size="sm"
      bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
      color="white"
      _hover={{ bgGradient: "linear(135deg, #D94B8C 0%, #EC5F8C 100%)" }}
      rounded="full"
      isLoading={actionLoading}
      onClick={handleSendRequest}
      {...buttonProps}
    >
      Dodaj med prijatelje
    </Button>
  );
}
