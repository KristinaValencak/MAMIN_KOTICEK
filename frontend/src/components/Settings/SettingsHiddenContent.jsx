import { useCallback, useEffect, useState } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { Box, Heading, Text, VStack, HStack, Button, Spinner, Divider, Badge } from "@chakra-ui/react"; 
import { Link as RouterLink } from "react-router-dom";
import { API_BASE } from "../../api/config";
import { formatDate } from "../../utils/helpers";
import SettingsHiddenListings from "./SettingsHiddenListings";

const sectionTitleProps = {
  size: "md",
  mb: 4,
  color: "gray.800",
  fontWeight: "800",
  letterSpacing: "-0.02em",
};

function statusLabel(status) {
  if (status === "hidden") return "Skrito";
  if (status === "removed") return "Odstranjeno";
  return status || "—";
}

export default function SettingsHiddenContent() {
  const { toast } = useAppToast();
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/me/hidden-content?postLimit=80&commentLimit=80`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Napaka pri nalaganju.");
      }
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch (e) {
      toast({
        status: "error",
        title: "Napaka",
        description: e.message || "Seznama ni bilo mogoče naložiti.",
      });
      setPosts([]);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Box>
      <Heading {...sectionTitleProps}>Skrita vsebina zaradi pravil</Heading>
      <Text fontSize="sm" color="gray.600" mb={4}>
      Nekatere tvoje objave, komentarji ali oglasi so lahko skriti, če ne ustrezajo pravilom skupnosti. Še vedno jih vidiš ti — drugi uporabniki pa ne. Če meniš, da gre za napako, lahko zahtevaš ponoven pregled.
      </Text>
      <Divider mb={6} />

      {loading ? (
        <HStack py={10} justify="center">
          <Spinner color="pink.500" />
        </HStack>
      ) : (
        <VStack spacing={10} align="stretch">
          <Box>
            <Heading size="sm" mb={3} color="gray.700">
              Skrite objave
            </Heading>
            {posts.length === 0 ? (
              <Text fontSize="sm" color="gray.600">
                Trenutno nimate skritih objav.
              </Text>
            ) : (
              <VStack spacing={3} align="stretch">
                {posts.map((p) => (
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
                      <HStack spacing={2} flexWrap="wrap" mb={1}>
                        <Badge colorScheme="orange" variant="subtle" fontSize="10px">
                          {statusLabel(p.moderationStatus)}
                        </Badge>
                        {p.categoryName ? (
                          <Badge colorScheme="pink" variant="subtle" fontSize="10px">
                            {p.categoryName}
                          </Badge>
                        ) : null}
                      </HStack>
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
                      >
                        {p.title}
                      </Button>
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        {p.hiddenAt ? `Skrito ${formatDate(p.hiddenAt)}` : `Objavljeno ${formatDate(p.createdAt)}`}
                      </Text>
                    </Box>
                  </HStack>
                ))}
              </VStack>
            )}
          </Box>

          <Box>
            <Heading size="sm" mb={3} color="gray.700">
              Skriti komentarji
            </Heading>
            {comments.length === 0 ? (
              <Text fontSize="sm" color="gray.600">
                Trenutno nimate skritih komentarjev.
              </Text>
            ) : (
              <VStack spacing={3} align="stretch">
                {comments.map((c) => (
                  <HStack
                    key={c.id}
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
                          {statusLabel(c.moderationStatus)}
                        </Badge>
                        {c.categoryName ? (
                          <Badge colorScheme="pink" variant="subtle" fontSize="10px">
                            {c.categoryName}
                          </Badge>
                        ) : null}
                      </HStack>
                      <Text fontSize="xs" color="gray.600" fontWeight="600" noOfLines={2} mb={1}>
                        Objava: {c.postTitle}
                      </Text>
                      <Text fontSize="sm" color="gray.700" noOfLines={4}>
                        {c.content}
                      </Text>
                      <Button
                        as={RouterLink}
                        mt={2}
                        to={`/?post=${c.postId}`}
                        variant="link"
                        colorScheme="pink"
                        fontWeight="700"
                        size="sm"
                        h="auto"
                        py={0}
                        px={0}
                        minH={0}
                      >
                        Odpri objavo na forumu
                      </Button>
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        {c.hiddenAt ? `Skrito ${formatDate(c.hiddenAt)}` : `Objavljeno ${formatDate(c.createdAt)}`}
                      </Text>
                    </Box>
                  </HStack>
                ))}
              </VStack>
            )}
          </Box>

          <Box>
            <Heading size="sm" mb={3} color="gray.700">
              Skriti oglasi
            </Heading>
            <SettingsHiddenListings />
          </Box>
        </VStack>
      )}
    </Box>
  );
}
