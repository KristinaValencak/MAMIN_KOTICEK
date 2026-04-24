import { Avatar, Box, HStack, Icon, IconButton, Spinner, Text, VStack } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { FaChevronRight, FaTrophy } from "react-icons/fa";
import { useTopMoms } from "../../hooks/support/useTopMoms";
import { profilePathForUserId } from "../../utils/helpers";
import { buildAvatarDisplayUrl } from "../../utils/cloudinaryUpload";

const rankStyles = [
  { bar: "linear(to-r, #F59E0B, #FBBF24)", badge: "orange", label: "#1" },
  { bar: "linear(to-r, #94A3B8, #CBD5E1)", badge: "gray", label: "#2" },
  { bar: "linear(to-r, #B45309, #D97706)", badge: "yellow", label: "#3" },
];

function TopMomsPreviewBody({ items, loading }) {
  return (
    <Box
      borderRadius="2xl"
      overflow="hidden"
      bg="white"
      borderWidth="1px"
      borderColor="gray.100"
      boxShadow="0 4px 24px rgba(15, 23, 42, 0.06)"
    >
      <Box h="2px" w="full" bgGradient="linear(to-r, #EC5F8C, #F48FB1)" />
      <Box px={4} pt={4} pb={3}>
        <HStack justify="space-between" align="center" spacing={3}>
          <HStack spacing={3} align="center" flex={1} minW={0}>
            <Box
              w={9}
              h={9}
              rounded="xl"
              bg="pink.50"
              display="flex"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <Icon as={FaTrophy} color="pink.400" boxSize={4} />
            </Box>
            <Text
              fontSize="sm"
              fontWeight="800"
              color="gray.900"
              letterSpacing="-0.02em"
              lineHeight="1.2"
            >
              Top mame tedna
            </Text>
          </HStack>
          <IconButton
            as={RouterLink}
            to="/top-moms"
            aria-label="Odpri lestvico"
            variant="ghost"
            colorScheme="pink"
            icon={<FaChevronRight />}
            _hover={{ bg: "pink.50" }}
            rounded="full"
            alignSelf="center"
          >
          </IconButton>
        </HStack>
      </Box>

      {loading ? (
        <Box py={8} textAlign="center">
          <Spinner size="sm" color="pink.400" thickness="3px" />
        </Box>
      ) : items.length === 0 ? (
        <Box px={4} pb={4}>
          <Text fontSize="sm" color="gray.500" lineHeight="tall">
            Ta teden še ni support reakcij — bodi prva, ki podpira drugo mamico.
          </Text>
        </Box>
      ) : (
        <VStack align="stretch" spacing={0} px={2} pb={3}>
          {items.map((u, idx) => {
            const rs = rankStyles[idx] || rankStyles[2];
            return (
              <Box
                key={u.userId}
                as={RouterLink}
                to={profilePathForUserId(u.userId)}
                display="block"
                borderRadius="xl"
                px={2}
                py={2}
                mx={1}
                mb={1}
                _hover={{ bg: "gray.50" }}
                transition="background 0.15s ease"
              >
                <HStack spacing={3} align="center">
                  <Box position="relative" flexShrink={0}>
                    <Box
                      position="absolute"
                      inset="-2px"
                      rounded="full"
                      bgGradient={rs.bar}
                      opacity={0.35}
                    />
                    <Avatar
                      src={buildAvatarDisplayUrl(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME, u.avatarUrl)}
                      size="sm"
                      name={u.username || "Uporabnica"}
                      bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
                    />
                  </Box>
                  <Box flex="1" minW={0}>
                    <HStack spacing={2} mb={0.5}>
                      <Text
                        fontSize="10px"
                        fontWeight="900"
                        color={`${rs.badge}.600`}
                        textTransform="uppercase"
                        letterSpacing="0.06em"
                      >
                        {rs.label}
                      </Text>
                      <Text fontWeight="800" fontSize="xs" color="gray.900" noOfLines={1}>
                        {u.username}
                      </Text>
                    </HStack>
                    <Text fontSize="xs" color="gray.500" fontWeight="600">
                      {u.supportScore} točk podpore · 💖
                    </Text>
                  </Box>
                  <Icon as={FaChevronRight} color="gray.300" boxSize={3} flexShrink={0} />
                </HStack>
              </Box>
            );
          })}
        </VStack>
      )}
    </Box>
  );
}

function TopMomsPreviewWithHook() {
  const { items, loading } = useTopMoms({ pageSize: 3 });
  return <TopMomsPreviewBody items={items} loading={loading} />;
}

export default function TopMomsPreview({ api }) {
  if (api) {
    return <TopMomsPreviewBody items={api.items} loading={api.loading} />;
  }
  return <TopMomsPreviewWithHook />;
}
