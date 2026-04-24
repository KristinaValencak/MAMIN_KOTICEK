import {Box, Button, FormControl, FormLabel, HStack, Heading, Icon, Select, VStack} from "@chakra-ui/react";
import { FaFilter } from "react-icons/fa";
import Categories from "./Categories/Categories";
import { API_BASE } from "../../api/config";
import ForumCommunityCard from "./ForumCommunityCard";

export const ForumSidebar = ({
  selectedCategory,
  view,
  onSelectCategory,
  onGoLatest,
  onGoTop,
  onGoFriends,
  onGoClearTag,
  onGoClearCity,
  tag,
  city,
  group,
  cities = [],
  groups = [],
  categoryTags = [],
  onTagChange,
  onCityChange,
  onGroupChange,
  onGoClearGroup,
  onClearAllFilters,
  onClearCategory,
}) => {
  return (
    <VStack align="stretch" spacing={4} minW={0} w="full">
      <Box>
        <Box
          bg="white"
          rounded="full"
          p={1}
          borderWidth="1px"
          borderColor="gray.100"
          boxShadow="sm"
        >
          <HStack spacing={1}>
            <Button
              onClick={onGoLatest}
              flex={1}
              size="sm"
              rounded="full"
              fontWeight="700"
              fontSize="sm"
              h="38px"
              bg="transparent"
              color={view === "latest" ? "gray.900" : "gray.600"}
              boxShadow="none"
              _hover={{ bg: "gray.50" }}
              _active={{ bg: "gray.100" }}
              position="relative"
              _after={
                view === "latest"
                  ? {
                      content: '""',
                      position: "absolute",
                      left: "14px",
                      right: "14px",
                      bottom: "6px",
                      height: "2px",
                      borderRadius: "999px",
                      bg: "pink.500",
                    }
                  : undefined
              }
            >
              Najnovejše
            </Button>
            <Button
              onClick={onGoTop}
              flex={1}
              size="sm"
              rounded="full"
              fontWeight="700"
              fontSize="sm"
              h="38px"
              bg="transparent"
              color={view === "top" ? "gray.900" : "gray.600"}
              boxShadow="none"
              _hover={{ bg: "gray.50" }}
              _active={{ bg: "gray.100" }}
              position="relative"
              _after={
                view === "top"
                  ? {
                      content: '""',
                      position: "absolute",
                      left: "14px",
                      right: "14px",
                      bottom: "6px",
                      height: "2px",
                      borderRadius: "999px",
                      bg: "pink.500",
                    }
                  : undefined
              }
            >
              Naj odziva
            </Button>
            <Button
              onClick={onGoFriends}
              flex={1}
              size="sm"
              rounded="full"
              fontWeight="700"
              fontSize="sm"
              h="38px"
              bg="transparent"
              color={view === "friends" ? "gray.900" : "gray.600"}
              boxShadow="none"
              _hover={{ bg: "gray.50" }}
              _active={{ bg: "gray.100" }}
              position="relative"
              _after={
                view === "friends"
                  ? {
                      content: '""',
                      position: "absolute",
                      left: "14px",
                      right: "14px",
                      bottom: "6px",
                      height: "2px",
                      borderRadius: "999px",
                      bg: "pink.500",
                    }
                  : undefined
              }
            >
              Prijateljice
            </Button>
          </HStack>
        </Box>
      </Box>

      <Categories
        apiBase={API_BASE}
        onSelect={onSelectCategory}
        selectedCategory={selectedCategory}
        onClearCategory={onClearCategory}
      />

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
        <Box px={{ base: 3.5, md: 3.5, xl: 5 }} py={3}>
          <HStack spacing={2} mb={3}>
            <Box
              w={8}
              h={8}
              rounded="lg"
              bg="pink.50"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon as={FaFilter} color="pink.400" boxSize={3.5} />
            </Box>
            <VStack align="start" spacing={0} flex={1} minW={0}>
              <Heading fontSize="sm" fontWeight="800" color="gray.800" letterSpacing="-0.02em">
                Filtri objav
              </Heading>
            </VStack>
          </HStack>

          <VStack align="stretch" spacing={3.5}>
            <FormControl minW={0}>
              <FormLabel
                fontSize="sm"
                lineHeight="1.2"
                fontWeight="700"
                color="gray.700"
                letterSpacing="-0.01em"
                mb={1.5}
              >
                Tag
              </FormLabel>
              <HStack spacing={2} minW={0}>
                <Select
                  value={tag || ""}
                  onChange={(e) => onTagChange?.(e.target.value)}
                  size="sm"
                  borderRadius="xl"
                  borderColor="gray.200"
                  bg="white"
                  _hover={{ borderColor: "pink.200" }}
                  _focusVisible={{ borderColor: "pink.400", boxShadow: "0 0 0 1px var(--chakra-colors-pink-400)" }}
                  isDisabled={!selectedCategory?.slug}
                  flex={1}
                  minW={0}
                >
                  <option value="">{selectedCategory?.slug ? "Vsi tagi" : "Najprej izberi kategorijo"}</option>
                  {categoryTags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
                <Button
                  size="xs"
                  variant="ghost"
                  rounded="full"
                  fontWeight="700"
                  color="gray.500"
                  flexShrink={0}
                  _hover={{ color: "pink.600", bg: "pink.50" }}
                  onClick={() => onGoClearTag?.()}
                  isDisabled={!String(tag || "").trim()}
                >
                  Počisti
                </Button>
              </HStack>
            </FormControl>

            <FormControl minW={0}>
              <FormLabel
                fontSize="sm"
                lineHeight="1.2"
                fontWeight="700"
                color="gray.700"
                letterSpacing="-0.01em"
                mb={1.5}
              >
                Mesto
              </FormLabel>
              <HStack spacing={2} minW={0}>
                <Select
                  value={city || ""}
                  onChange={(e) => onCityChange?.(e.target.value)}
                  size="sm"
                  borderRadius="xl"
                  borderColor="gray.200"
                  bg="white"
                  _hover={{ borderColor: "pink.200" }}
                  _focusVisible={{ borderColor: "pink.400", boxShadow: "0 0 0 1px var(--chakra-colors-pink-400)" }}
                  flex={1}
                  minW={0}
                >
                  <option value="">Vsa mesta</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
                <Button
                  size="xs"
                  variant="ghost"
                  rounded="full"
                  fontWeight="700"
                  color="gray.500"
                  flexShrink={0}
                  _hover={{ color: "pink.600", bg: "pink.50" }}
                  onClick={() => onGoClearCity?.()}
                  isDisabled={!String(city || "").trim()}
                >
                  Počisti
                </Button>
              </HStack>
            </FormControl>

            <FormControl minW={0}>
              <FormLabel
                fontSize="sm"
                lineHeight="1.2"
                fontWeight="700"
                color="gray.700"
                letterSpacing="-0.01em"
                mb={1.5}
              >
                Skupina
              </FormLabel>
              <HStack spacing={2} minW={0}>
                <Select
                  value={group || ""}
                  onChange={(e) => onGroupChange?.(e.target.value)}
                  size="sm"
                  borderRadius="xl"
                  borderColor="gray.200"
                  bg="white"
                  _hover={{ borderColor: "pink.200" }}
                  _focusVisible={{ borderColor: "pink.400", boxShadow: "0 0 0 1px var(--chakra-colors-pink-400)" }}
                  flex={1}
                  minW={0}
                >
                  <option value="">Vse skupine</option>
                  {groups.map((g) => (
                    <option key={g.key} value={g.key}>
                      {g.label}
                    </option>
                  ))}
                </Select>
                <Button
                  size="xs"
                  variant="ghost"
                  rounded="full"
                  fontWeight="700"
                  color="gray.500"
                  flexShrink={0}
                  _hover={{ color: "pink.600", bg: "pink.50" }}
                  onClick={() => onGoClearGroup?.()}
                  isDisabled={!String(group || "").trim()}
                >
                  Počisti
                </Button>
              </HStack>
            </FormControl>

            <Button
              size="sm"
              w="full"
              rounded="xl"
              fontWeight="700"
              variant="outline"
              borderColor="pink.200"
              color="pink.600"
              bg="white"
              _hover={{ bg: "pink.50", borderColor: "pink.300" }}
              _active={{ bg: "pink.100" }}
              onClick={() => onClearAllFilters?.()}
              isDisabled={
                !String(tag || "").trim() &&
                !String(city || "").trim() &&
                !String(group || "").trim() &&
                !selectedCategory?.slug
              }
            >
              Počisti vse filtre
            </Button>
          </VStack>
        </Box>
      </Box>

      <ForumCommunityCard />
    </VStack>
  );
};
