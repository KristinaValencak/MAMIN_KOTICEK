import { useCallback, useEffect, useState } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { Box, Text, VStack, HStack, Spinner, Badge, Button } from "@chakra-ui/react";
import { API_BASE } from "../../api/config";
import { formatDate } from "../../utils/helpers";

export default function SettingsHiddenListings() {
  const { toast } = useAppToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/me/hidden?limit=60&offset=0`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || "Napaka pri nalaganju.");
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      toast({
        status: "error",
        title: "Napaka",
        description: e.message || "Skritih oglasov ni bilo mogoče naložiti.",
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Box>
      {loading ? (
        <HStack py={10} justify="center">
          <Spinner color="pink.500" />
        </HStack>
      ) : items.length === 0 ? (
        <Text fontSize="sm" color="gray.600">
          Trenutno nimate skritih oglasov.
        </Text>
      ) : (
        <VStack spacing={3} align="stretch">
          {items.map((l) => (
            <HStack
              key={l.id}
              align="flex-start"
              spacing={4}
              p={4}
              rounded="xl"
              borderWidth="1px"
              borderColor="gray.100"
              bg="gray.50"
            >
              <Box flex="1" minW={0}>
                <HStack spacing={2} flexWrap="wrap" mb={1}>
                  <Badge colorScheme="orange" variant="subtle" fontSize="10px">
                    Skrito
                  </Badge>
                  {l.categoryName ? (
                    <Badge colorScheme="purple" variant="subtle" fontSize="10px">
                      {l.categoryName}
                    </Badge>
                  ) : null}
                  {l.city ? (
                    <Badge colorScheme="blue" variant="subtle" fontSize="10px">
                      {l.city}
                    </Badge>
                  ) : null}
                </HStack>
                <Text fontSize="sm" fontWeight="800" color="gray.800" noOfLines={2}>
                  {l.title}
                </Text>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  {l.hiddenAt ? `Skrito ${formatDate(l.hiddenAt)}` : l.createdAt ? `Objavljeno ${formatDate(l.createdAt)}` : ""}
                </Text>
              </Box>
              <Button size="sm" variant="outline" rounded="lg" onClick={load}>
                Osveži
              </Button>
            </HStack>
          ))}
        </VStack>
      )}
    </Box>
  );
}

