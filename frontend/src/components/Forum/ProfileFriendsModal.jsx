import { useEffect, useState, useCallback, useRef } from "react";
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, VStack, HStack, Text, Avatar, Spinner, Box, Button } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { API_BASE } from "../../api/config";
import { profilePathForUserId } from "../../utils/helpers";
import { buildAvatarDisplayUrl } from "../../utils/cloudinaryUpload";

const PAGE = 40;

/**
 * @param {"friends" | "mutual"} variant
 */
export default function ProfileFriendsModal({
  isOpen,
  onClose,
  profileUserId,
  variant = "friends",
  title,
  listAccessHint = null,
}) {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [canViewList, setCanViewList] = useState(true);
  const [friendCount, setFriendCount] = useState(0);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const load = useCallback(
    async (append = false) => {
      if (profileUserId == null || !isOpen) return;
      try {
        if (append) {
          if (loadingMoreRef.current || !hasMoreRef.current) return;
          loadingMoreRef.current = true;
          setLoadingMore(true);
        } else {
          setLoading(true);
          setRows([]);
          setHasMore(true);
          hasMoreRef.current = true;
          offsetRef.current = 0;
        }
        setError(null);
        const offset = append ? offsetRef.current : 0;

        if (variant === "mutual") {
          const res = await fetch(
            `${API_BASE}/api/users/${profileUserId}/friends/mutual?limit=${PAGE}&offset=${offset}`,
            { credentials: "include" }
          );
          const data = await res.json().catch(() => ({}));
          if (res.status === 403 && data.code === "PROFILE_BLOCKED") {
            setRows([]);
            setCanViewList(false);
            setFriendCount(0);
            return;
          }
          if (!res.ok) {
            throw new Error(data.error || "Napaka pri nalaganju.");
          }
          const batch = Array.isArray(data.items) ? data.items : [];
          const total = typeof data.total === "number" ? data.total : batch.length;
          const more = offset + batch.length < total;
          hasMoreRef.current = more;
          setHasMore(more);
          setRows((prev) => {
            const next = append ? [...prev, ...batch] : batch;
            offsetRef.current = next.length;
            return next;
          });
          setCanViewList(true);
          setFriendCount(total);
          return;
        }

        const res = await fetch(
          `${API_BASE}/api/users/${profileUserId}/friends?limit=${PAGE}&offset=${offset}`,
          { credentials: "include" }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Napaka pri nalaganju.");
        }
        const batch = Array.isArray(data.friends) ? data.friends : [];
        const total =
          typeof data.pagination?.total === "number"
            ? data.pagination.total
            : typeof data.friendCount === "number"
              ? data.friendCount
              : batch.length;
        const more = offset + batch.length < total;
        hasMoreRef.current = more;
        setHasMore(more);
        setRows((prev) => {
          const next = append ? [...prev, ...batch] : batch;
          offsetRef.current = next.length;
          return next;
        });
        setCanViewList(Boolean(data.canViewList));
        setFriendCount(typeof data.friendCount === "number" ? data.friendCount : total);
      } catch (e) {
        setError(e.message || "Napaka");
        if (!append) setRows([]);
      } finally {
        loadingMoreRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [profileUserId, isOpen, variant]
  );

  useEffect(() => {
    if (isOpen) load(false);
  }, [isOpen, load]);

  const defaultTitle = variant === "mutual" ? "Skupni prijatelji" : "Prijatelji";

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent borderRadius="2xl">
        <ModalHeader fontSize="lg" fontWeight="800">
          {title || defaultTitle}
        </ModalHeader>
        <ModalCloseButton onMouseUp={(e) => e.currentTarget.blur()} />
        <ModalBody pb={6}>
          {loading && rows.length === 0 ? (
            <HStack py={10} justify="center">
              <Spinner color="pink.400" />
            </HStack>
          ) : error ? (
            <Text fontSize="sm" color="red.600">
              {error}
            </Text>
          ) : variant === "friends" && !canViewList ? (
            listAccessHint === "private" ? (
              <Text fontSize="sm" color="gray.600" lineHeight="1.6">
                Ta profil je zaseben. Števila in seznama prijateljev ne moremo prikazati.
              </Text>
            ) : (
              <Text fontSize="sm" color="gray.600" lineHeight="1.6">
                Za ogled seznama prijateljev se morate prijaviti.
                {typeof friendCount === "number" ? ` Število prijateljev je javno (${friendCount}).` : ""}
              </Text>
            )
          ) : rows.length === 0 ? (
            <Text fontSize="sm" color="gray.500">
              {variant === "mutual" ? "Ni skupnih prijateljev." : "Ni prijateljev za prikaz."}
            </Text>
          ) : (
            <Box maxH="60vh" overflowY="auto">
              <VStack align="stretch" spacing={0}>
                {rows.map((u) => (
                  <Box
                    key={u.id}
                    as={RouterLink}
                    to={profilePathForUserId(u.id)}
                    onClick={onClose}
                    _hover={{ bg: "gray.50" }}
                    borderRadius="lg"
                    px={2}
                    py={2.5}
                  >
                    <HStack spacing={3}>
                      <Avatar
                        size="sm"
                        name={u.username}
                        src={buildAvatarDisplayUrl(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME, u.avatarUrl)}
                        bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
                        color="white"
                      />
                      <Text fontSize="sm" fontWeight="600" color="gray.800">
                        {u.username}
                      </Text>
                    </HStack>
                  </Box>
                ))}
              </VStack>
              {hasMore ? (
                <Box px={2} pt={2}>
                  <Button size="sm" variant="outline" w="full" onClick={() => load(true)} isLoading={loadingMore}>
                    Naloži več
                  </Button>
                </Box>
              ) : null}
            </Box>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
