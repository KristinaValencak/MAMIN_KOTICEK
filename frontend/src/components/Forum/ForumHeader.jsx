import { Box, HStack, Heading, IconButton, Text } from "@chakra-ui/react";
import { ArrowBackIcon } from "@chakra-ui/icons";

export const ForumHeader = ({ selectedPostId, selectedCategory, selectedPostTitle, onClose }) => (
  <Box minH="40px" display="flex" alignItems="center" justifyContent="center" px={{ base: 0, md: 1 }}>
    {selectedPostId ? (
      <HStack spacing={3} w="full" justify={{ base: "flex-start", md: "center" }}>
        <IconButton
          icon={<ArrowBackIcon />}
          onClick={onClose}
          size="sm"
          variant="ghost"
          aria-label="Nazaj na seznam"
          color="gray.600"
          rounded="xl"
          _hover={{ color: "pink.500", bg: "pink.50" }}
        />
        <Heading fontSize={{ base: "md", md: "xl" }} fontWeight="800" color="gray.800" letterSpacing="-0.02em" noOfLines={2}>
          {selectedCategory
            ? `${selectedCategory.name || selectedCategory.slug} · ${selectedPostTitle || "…"}`
            : selectedPostTitle || "…"}
        </Heading>
      </HStack>
    ) : selectedCategory ? (
      <Box w="full" textAlign="center" py={1}>
        <Text fontSize="10px" fontWeight="800" color="pink.500" textTransform="uppercase" letterSpacing="0.1em" mb={0.5}>
          Kategorija
        </Text>
        <Heading as="h1" fontSize="lg" fontWeight="900" color="gray.900" letterSpacing="-0.02em">
          {selectedCategory.name || selectedCategory.slug}
        </Heading>
      </Box>
    ) : null}
  </Box>
);
