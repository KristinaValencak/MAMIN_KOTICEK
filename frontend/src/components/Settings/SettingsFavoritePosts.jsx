import { useCallback, useEffect, useState } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { Box, Heading, Text, VStack, HStack, Button, Spinner, Divider } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { API_BASE } from "../../api/config";
import { formatDate } from "../../utils/helpers";

const sectionTitleProps = {
  size: "md",
  mb: 4,
  color: "gray.800",
  fontWeight: "800",
  letterSpacing: "-0.02em",
};

export default function SettingsFavoritePosts() {
  const { toast } = useAppToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/me/favorites?limit=100&offset=0`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Napaka pri nalaganju.");
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      toast({
        status: "error",
        title: "Napaka",
        description: e.message || "Seznama ni bilo mogoče naložiti.",
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRemove = async (postId) => {
    setRemovingId(postId);
    try {
      const res = await fetch(`${API_BASE}/api/posts/${postId}/favorite`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Odstranitev ni uspela.");
      }
      setItems((prev) => prev.filter((p) => Number(p.id) !== Number(postId)));
      toast({ status: "success", title: "Odstranjeno iz priljubljenih" });
    } catch (e) {
      toast({
        status: "error",
        title: "Napaka",
        description: e.message,
      });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Box>
      <Heading {...sectionTitleProps}>Priljubljene objave</Heading>
      <Text fontSize="sm" color="gray.600" mb={6}>
        Priljubljene objave lahko vklopiš v meniju ob objavi na forumu ali v podrobnem pogledu objave.
      </Text>
      <Divider mb={6} />

      {loading ? (
        <HStack py={10} justify="center">
          <Spinner color="pink.500" />
        </HStack>
      ) : items.length === 0 ? (
        <Box py={8} textAlign="center">
          <Text color="gray.600">Nimate shranjenih priljubljenih objav.</Text>
        </Box>
      ) : (
        <VStack spacing={3} align="stretch">
          {items.map((p) => (
            <HStack
              key={p.id}
              align="flex-start"
              spacing={4}
              p={4}
              rounded="xl"
              borderWidth="1px"
              borderColor="gray.100"
              bg="gray.50"
            >
              <Box flex="1" minW={0}>
                <Button
                  as={RouterLink}
                  to={`/?post=${p.id}`}
                  variant="link"
                  colorScheme="pink"
                  fontWeight="700"
                  whiteSpace="normal"
                  textAlign="left"
                  h="auto"
                  py={0}
                  px={0}
                  minH={0}
                  lineHeight="1.35"
                >
                  {p.title}
                </Button>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  {p.categoryName ? `${p.categoryName} · ` : ""}
                  shranjeno {p.favoritedAt ? formatDate(p.favoritedAt) : ""}
                </Text>
              </Box>
              <Button
                size="sm"
                variant="outline"
                colorScheme="gray"
                flexShrink={0}
                isLoading={removingId === p.id}
                onClick={() => handleRemove(p.id)}
              >
                Odstrani
              </Button>
            </HStack>
          ))}
        </VStack>
      )}
    </Box>
  );
}
