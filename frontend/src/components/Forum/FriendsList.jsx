import { useEffect, useState, useCallback, useRef } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { Box, VStack, HStack, Avatar, Text, Spinner, IconButton, Button } from "@chakra-ui/react";
import { FiMessageCircle } from "react-icons/fi";
import { API_BASE } from "../../api/config";

const PAGE = 50;

export default function FriendsList({ selectedFriendId, onSelectFriend }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const { toast } = useAppToast();
  const offsetRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const loadPage = useCallback(
    async (append) => {
      try {
        if (append) {
          if (loadingMoreRef.current || !hasMoreRef.current) return;
          loadingMoreRef.current = true;
          setLoadingMore(true);
        } else {
          setLoading(true);
          setFriends([]);
          setHasMore(true);
          hasMoreRef.current = true;
          offsetRef.current = 0;
        }
        const offset = append ? offsetRef.current : 0;
        const res = await fetch(
          `${API_BASE}/api/friends/list?limit=${PAGE}&offset=${offset}`,
          { credentials: "include" }
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || data.message || "Napaka pri nalaganju prijateljev");
        }
        const batch = data.friends || [];
        const total = data.pagination?.total ?? batch.length;
        const more = offset + batch.length < total;
        hasMoreRef.current = more;
        setHasMore(more);
        setFriends((prev) => {
          const next = append ? [...prev, ...batch] : batch;
          offsetRef.current = next.length;
          return next;
        });
      } catch (err) {
        setError(err.message);
        toast({
          status: "error",
          title: "Napaka pri nalaganju prijateljev",
          description: err.message,
        });
      } finally {
        loadingMoreRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    loadPage(false);
  }, [loadPage]);

  if (loading && friends.length === 0) {
    return (
      <Box py={6} textAlign="center">
        <Spinner size="sm" color="brand.500" />
      </Box>
    );
  }

  if (error && friends.length === 0) {
    return (
      <Box py={4}>
        <Text fontSize="sm" color="red.500">
          {error}
        </Text>
      </Box>
    );
  }

  if (!friends.length) {
    return (
      <Box py={4}>
        <Text fontSize="sm" color="gray.500">
          Trenutno še nimaš prijateljev.
        </Text>
      </Box>
    );
  }

  return (
    <VStack spacing={2} align="stretch">
      {friends.map((friend) => {
        const isActive = selectedFriendId === friend.id;
        return (
          <Box
            key={friend.id}
            p={2}
            rounded="lg"
            borderWidth="1px"
            borderColor={isActive ? "brand.300" : "gray.100"}
            bg={isActive ? "brand.50" : "white"}
            _hover={{
              bg: isActive ? "brand.100" : "gray.50",
              borderColor: "brand.300",
            }}
            cursor="pointer"
            onClick={() => onSelectFriend(friend)}
          >
            <HStack spacing={3}>
              <Avatar size="sm" name={friend.username} />
              <Text flex="1" fontSize="sm" fontWeight="500">
                {friend.username}
              </Text>
              <IconButton
                icon={<FiMessageCircle />}
                aria-label="Odpri pogovor"
                size="xs"
                variant="ghost"
                colorScheme="brand"
              />
            </HStack>
          </Box>
        );
      })}
      {hasMore ? (
        <Button size="xs" variant="outline" onClick={() => loadPage(true)} isLoading={loadingMore}>
          Naloži več
        </Button>
      ) : null}
    </VStack>
  );
}
