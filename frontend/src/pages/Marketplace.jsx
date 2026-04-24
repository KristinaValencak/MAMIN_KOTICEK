import { useCallback, useEffect, useRef, useState } from "react";
import {Alert, AlertIcon, Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel, Box, Button, Container, FormControl, FormLabel, Heading, HStack, Input, Select, SimpleGrid, Spinner, Text, VStack } from "@chakra-ui/react";
import { API_BASE } from "../api/config";
import { getCloudinaryConfig } from "../utils/cloudinaryUpload";
import ListingCard from "../components/Marketplace/ListingCard";
import { MARKETPLACE_CHANGED_EVENT, OPEN_LISTING_DETAIL_MODAL, OPEN_LISTING_FORM_MODAL } from "../components/Marketplace/marketplaceModalConstants";
import { useInfiniteScroll } from "../hooks/forum/useInfiniteScroll";
import { getApiErrorMessageFromBody } from "../utils/parseApiError.js";
import { useCities } from "../hooks/forum/useCities";
import { useMarketplaceCategories } from "../hooks/marketplace/useMarketplaceCategories";

export default function Marketplace() {
  const cfg = getCloudinaryConfig();
  const cloudName = cfg.ok ? cfg.cloudName : null;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [limit] = useState(24);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const appendInFlightRef = useRef(false);

  const { cities } = useCities();
  const { categories } = useMarketplaceCategories();

  const [draftCity, setDraftCity] = useState("");
  const [draftCategoryId, setDraftCategoryId] = useState("");
  const [draftPriceMin, setDraftPriceMin] = useState("");
  const [draftPriceMax, setDraftPriceMax] = useState("");

  const [filters, setFilters] = useState({
    city: "",
    categoryId: "",
    priceMin: "",
    priceMax: "",
  });

  const buildMarketplaceQuery = useCallback(
    (nextOffset) => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(nextOffset));
      if (filters.city) params.set("city", filters.city);
      if (filters.categoryId) params.set("categoryId", filters.categoryId);
      if (filters.priceMin) params.set("priceMin", filters.priceMin);
      if (filters.priceMax) params.set("priceMax", filters.priceMax);
      return params.toString();
    },
    [limit, filters]
  );

  const loadPage = async (nextOffset, { append } = { append: false }) => {
    try {
      if (append) {
        if (appendInFlightRef.current) return;
        appendInFlightRef.current = true;
        setLoadingMore(true);
      } else setLoading(true);
      setError("");
      const qs = buildMarketplaceQuery(nextOffset);
      const res = await fetch(`${API_BASE}/api/marketplace?${qs}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getApiErrorMessageFromBody(data) || "Napaka pri branju Marketplace");
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems((prev) => {
        if (!append) return list;
        const seen = new Set(prev.map((x) => x.id));
        const next = [...prev];
        for (const x of list) {
          if (x?.id != null && !seen.has(x.id)) {
            seen.add(x.id);
            next.push(x);
          }
        }
        return next;
      });
      setHasMore(list.length >= limit);
      setOffset(nextOffset);
    } catch (err) {
      setError(err.message);
    } finally {
      if (append) appendInFlightRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadPage(0, { append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onChanged = () => loadPage(0, { append: false });
    window.addEventListener(MARKETPLACE_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(MARKETPLACE_CHANGED_EVENT, onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPage(0, { append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadMore = useCallback(
    (append = false) => {
      if (!append) return;
      loadPage(offset + limit, { append: true });
    },
    [offset, limit]
  );

  const marketplaceScrollSentinelRef = useInfiniteScroll(loadMore, hasMore, loading, loadingMore, "");

  const renderFiltersUi = ({ showTitle } = { showTitle: true }) => (
    <VStack align="stretch" spacing={4}>
      <HStack justify="space-between" flexWrap="wrap" gap={3}>
        {showTitle ? (
          <Text fontWeight="800" color="gray.800">
            Filtri
          </Text>
        ) : (
          <Box />
        )}
        <HStack spacing={2}>
          <Button
            size="sm"
            variant="outline"
            rounded="full"
            onClick={() => {
              setDraftCity("");
              setDraftCategoryId("");
              setDraftPriceMin("");
              setDraftPriceMax("");
              setFilters({ city: "", categoryId: "", priceMin: "", priceMax: "" });
            }}
          >
            Počisti
          </Button>
          <Button
            size="sm"
            colorScheme="pink"
            rounded="full"
            onClick={() => {
              setFilters({
                city: draftCity,
                categoryId: draftCategoryId,
                priceMin: draftPriceMin,
                priceMax: draftPriceMax,
              });
            }}
          >
            Uporabi
          </Button>
        </HStack>
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 3, lg: 4 }} spacing={4}>
        <FormControl>
          <FormLabel fontSize="sm" color="gray.600">
            Lokacija
          </FormLabel>
          <Select value={draftCity} onChange={(e) => setDraftCity(e.target.value)} bg="white">
            <option value="">Vsa mesta</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel fontSize="sm" color="gray.600">
            Kategorija
          </FormLabel>
          <Select value={draftCategoryId} onChange={(e) => setDraftCategoryId(e.target.value)} bg="white">
            <option value="">Vse kategorije</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel fontSize="sm" color="gray.600">
            Cena od
          </FormLabel>
          <Input value={draftPriceMin} onChange={(e) => setDraftPriceMin(e.target.value)} inputMode="decimal" bg="white" />
        </FormControl>

        <FormControl>
          <FormLabel fontSize="sm" color="gray.600">
            Cena do
          </FormLabel>
          <Input value={draftPriceMax} onChange={(e) => setDraftPriceMax(e.target.value)} inputMode="decimal" bg="white" />
        </FormControl>
      </SimpleGrid>
    </VStack>
  );

  return (
    <Container maxW="6xl" mx="auto" px={{ base: 4, md: 8 }} py={{ base: 6, md: 8 }} mt={{ base: 2, md: 10 }} mb={8}>
      <VStack align="stretch" spacing={{ base: 6, md: 7 }}>
        <Box>
          <HStack justify="space-between" align={{ base: "start", sm: "center" }} flexWrap="wrap" gap={3} mb={2}>
            <Heading fontSize={{ base: "2xl", md: "3xl" }} fontWeight="900" color="gray.800" letterSpacing="-0.02em">
              Marketplace
            </Heading>
            <Button
              size="sm"
              bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
              color="white"
              rounded="full"
              fontWeight="700"
              px={5}
              _hover={{
                bgGradient: "linear(135deg, #D94B8C 0%, #EC5F8C 100%)",
                boxShadow: "0 8px 24px rgba(236, 95, 140, 0.35)",
              }}
              onClick={() => window.dispatchEvent(new CustomEvent(OPEN_LISTING_FORM_MODAL, { detail: {} }))}
            >
              Nov oglas
            </Button>
          </HStack>
          <Text fontSize={{ base: "sm", md: "md" }} color="gray.600" maxW="56ch">
            Odkrij ali podari rabljene otroške stvari, opremo in oblačila. Hitro poišči, kar potrebuješ, ali objavi svoj oglas v par klikih.
          </Text>
        </Box>

        <Box display={{ base: "none", md: "block" }} bg="white" borderWidth="1px" borderColor="gray.100" rounded="2xl" p={{ base: 4, md: 5 }}>
          {renderFiltersUi({ showTitle: true })}
        </Box>

        <Box display={{ base: "block", md: "none" }} w="full">
          <Accordion allowToggle>
            <AccordionItem border="1px solid" borderColor="gray.100" borderRadius="2xl" overflow="hidden" bg="white">
              <AccordionButton py={3} px={4} _hover={{ bg: "gray.50" }}>
                <Box flex="1" textAlign="left" fontWeight="800" fontSize="sm" color="gray.700">
                  Filtri
                </Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel pt={2} pb={4} px={4} overflow="visible">
                {renderFiltersUi({ showTitle: false })}
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </Box>

        {error ? (
          <Alert status="error" rounded="xl">
            <AlertIcon />
            <Text>{error}</Text>
          </Alert>
        ) : null}

        {loading && items.length === 0 ? (
          <HStack justify="center" py={10}>
            <Spinner color="brand.500" />
          </HStack>
        ) : (
          <SimpleGrid
            columns={{ base: 1, sm: 2, md: 2, lg: 2, xl: 3 }}
            spacing={{ base: 6, md: 5 }}
            w="full"
            alignItems="stretch"
            justifyItems="center"
          >
            {items.map((l) => (
              <Box
                key={l.id}
                w="100%"
                h="100%"
                minW={0}
                display="flex"
                flexDirection="column"
                maxW={{ base: "320px", sm: "340px", md: "360px" }}
                mx="auto"
              >
                <ListingCard
                  variant="marketplace"
                  listing={l}
                  cloudName={cloudName}
                  onOpen={(listingId) =>
                    window.dispatchEvent(
                      new CustomEvent(OPEN_LISTING_DETAIL_MODAL, { detail: { listingId } })
                    )
                  }
                />
              </Box>
            ))}
          </SimpleGrid>
        )}
        <Box ref={marketplaceScrollSentinelRef} h="2px" w="full" aria-hidden />

        {!loading && loadingMore ? (
          <HStack justify="center" py={6}>
            <Spinner color="brand.500" />
          </HStack>
        ) : null}
      </VStack>
    </Container>
  );
}

