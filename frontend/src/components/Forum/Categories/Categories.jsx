import { useEffect, useState } from "react";
import { Box, VStack, Text, Spinner, Button, HStack, Icon, Heading } from "@chakra-ui/react";
import { FaBaby, FaChild, FaGraduationCap, FaHeart, FaMoon, FaUtensils, FaShoppingBag, FaHandsHelping, FaComments, FaCalendarAlt, FaLayerGroup } from "react-icons/fa";
import { API_BASE } from "../../../api/config";

export default function Categories({ apiBase = API_BASE, onSelect, selectedCategory, onClearCategory }) {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");

  const getCategoryIcon = (categoryId) => {
    const iconMap = {
      1: null,
      2: FaBaby,
      3: FaChild,
      4: FaGraduationCap,
      5: FaHeart,
      6: FaMoon,
      7: FaUtensils,
      8: FaShoppingBag,
      9: FaHeart,
      10: FaHandsHelping,
      11: FaComments,
      12: FaCalendarAlt,
    };
    return iconMap[categoryId] || FaComments;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/categories`);
        if (!res.ok) throw new Error("Napaka pri branju kategorij");
        const data = await res.json();
        if (alive) {
          setCategories(data);
          setLoading(false);
        }
      } catch (e) {
        setError(e.message || "Napaka");
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [apiBase]);

  return (
    <Box
      borderRadius="xl"
      overflow="hidden"
      bg="white"
      borderWidth="1px"
      borderColor="gray.100"
      boxShadow="0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)"
      minW={0}
      w="full"
    >
      <Box h="2px" w="full" bgGradient="linear(to-r, #EC5F8C, #F48FB1)" />
      <Box px={{ base: 3, md: 2.5, xl: 3 }} py={3}>
        <HStack spacing={2} mb={2.5}>
          <Box
            w={8}
            h={8}
            rounded="lg"
            bg="pink.50"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Icon as={FaLayerGroup} color="pink.400" boxSize={3.5} />
          </Box>
          <VStack align="start" spacing={0} flex={1} minW={0}>
            <Heading fontSize="sm" fontWeight="800" color="gray.800" letterSpacing="-0.02em">
              Kategorije
            </Heading>
          </VStack>
        </HStack>

        {selectedCategory && onClearCategory ? (
          <Button
            variant="ghost"
            size="xs"
            fontWeight="700"
            color="gray.500"
            mb={2}
            px={2}
            h="auto"
            py={1}
            _hover={{ color: "pink.600", bg: "pink.50" }}
            onClick={onClearCategory}
          >
            ← Vse kategorije
          </Button>
        ) : null}

        {loading ? (
          <Box py={8} textAlign="center">
            <Spinner color="pink.400" thickness="3px" />
          </Box>
        ) : error ? (
          <Text color="red.500" fontSize="sm">
            {error}
          </Text>
        ) : (
          <VStack
            align="stretch"
            spacing={0.5}
            maxH="400px"
            overflowY="auto"
            overflowX="hidden"
            sx={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              "&::-webkit-scrollbar": { display: "none", width: 0, height: 0 },
            }}
          >
              {categories.map((cat) => {
                const IconComponent = getCategoryIcon(cat.id);
                const isSelected =
                  selectedCategory?.slug === cat.slug || selectedCategory?.id === cat.id;

                return (
                  <Box
                    key={cat.id}
                    as="button"
                    type="button"
                    onClick={() => onSelect && onSelect(cat)}
                    w="full"
                    textAlign="left"
                    px={2}
                    py={1.5}
                    rounded="md"
                    borderWidth="1px"
                    borderColor={isSelected ? "pink.100" : "transparent"}
                    bg={isSelected ? "white" : "transparent"}
                    boxShadow={
                      isSelected
                        ? "0 1px 2px rgba(15, 23, 42, 0.05), 0 0 0 1px rgba(236, 95, 140, 0.12)"
                        : "none"
                    }
                    transition="background 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease"
                    _hover={{
                      bg: isSelected ? "white" : "pink.50",
                      borderColor: isSelected ? "pink.100" : "pink.100",
                      boxShadow: isSelected
                        ? "0 1px 2px rgba(15, 23, 42, 0.05), 0 0 0 1px rgba(236, 95, 140, 0.12)"
                        : "0 1px 2px rgba(15, 23, 42, 0.04)",
                    }}
                    _active={{ transform: "scale(0.995)" }}
                  >
                    <HStack spacing={2.5} align="center">
                      <Box
                        w={8}
                        h={8}
                        rounded="md"
                        bg={isSelected ? "pink.50" : "white"}
                        borderWidth="1px"
                        borderColor={isSelected ? "pink.100" : "gray.100"}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        flexShrink={0}
                      >
                        {cat.id === 1 ? (
                          <Text fontSize="sm" role="img" aria-label="nosečnica">
                            🤰
                          </Text>
                        ) : (
                          <Icon as={IconComponent} boxSize={3.5} color={isSelected ? "pink.500" : "pink.400"} />
                        )}
                      </Box>
                      <Text
                        flex={1}
                        minW={0}
                        fontSize="sm"
                        fontWeight={isSelected ? "700" : "500"}
                        color={isSelected ? "pink.700" : "gray.700"}
                        lineHeight="1.25"
                        noOfLines={2}
                      >
                        {cat.name}
                      </Text>
                    </HStack>
                  </Box>
                );
              })}
          </VStack>
        )}
      </Box>
    </Box>
  );
}
