import { useCallback, useEffect, useState } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { Box, Heading, Divider, VStack, HStack, Text, Button, Avatar, Spinner } from "@chakra-ui/react";
import { API_BASE } from "../../api/config";
import { buildAvatarDisplayUrl } from "../../utils/cloudinaryUpload";

const sectionTitleProps = {
  size: "md",
  mb: 4,
  color: "gray.800",
  fontWeight: "800",
  letterSpacing: "-0.02em",
};

export default function SettingsBlockedUsers() {
  const { toast } = useAppToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/me/blocks`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Napaka pri nalaganju seznama.");
      }
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (e) {
      toast({
        status: "error",
        title: "Napaka",
        description: e.message || "Seznama ni bilo mogoče naložiti.",
      });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUnblock = async (blockedUserId) => {
    setUnblockingId(blockedUserId);
    try {
      const res = await fetch(`${API_BASE}/api/friends/unblock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ blockedId: blockedUserId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || "Odblokiranje ni uspelo.");
      }
      toast({ status: "success", title: "Uporabnica odblokirana" });
      setUsers((prev) => prev.filter((u) => Number(u.id) !== Number(blockedUserId)));
    } catch (e) {
      toast({
        status: "error",
        title: "Napaka",
        description: e.message,
      });
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <Box>
      <Heading {...sectionTitleProps}>Blokirani uporabniki</Heading>
      <Text fontSize="sm" color="gray.600" mb={6}>
        Blokada velja v obe smeri: ne vidita drug drugega javnega profila in ne moreta vzpostaviti stika (sporočila, prijateljstvo).
      </Text>
      <Divider mb={6} />

      {loading ? (
        <HStack py={10} justify="center">
          <Spinner color="pink.500" />
        </HStack>
      ) : users.length === 0 ? (
        <Box py={8} textAlign="center">
          <Text color="gray.600">Nimate blokiranih uporabnic.</Text>
        </Box>
      ) : (
        <VStack spacing={3} align="stretch">
          {users.map((u) => (
            <HStack
              key={u.id}
              justify="space-between"
              p={4}
              bg="white"
              rounded="xl"
              border="1px solid"
              borderColor="gray.100"
              boxShadow="sm"
              flexWrap="wrap"
              gap={3}
            >
              <HStack spacing={3} minW={0}>
                <Avatar size="md" name={u.username} src={buildAvatarDisplayUrl(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME, u.avatarUrl)} flexShrink={0} />
                <Text fontWeight="600" color="gray.800" noOfLines={1}>
                  {u.username}
                </Text>
              </HStack>
              <Button
                size="sm"
                variant="outline"
                colorScheme="pink"
                isLoading={unblockingId === u.id}
                loadingText="Odblokiram"
                onClick={() => handleUnblock(u.id)}
              >
                Odblokiraj
              </Button>
            </HStack>
          ))}
        </VStack>
      )}
    </Box>
  );
}
