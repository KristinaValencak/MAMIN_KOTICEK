import { Avatar, Box, Container, Heading, HStack, SimpleGrid, Spinner, Stack, Text, VStack } from "@chakra-ui/react";
import { useTopMoms } from "../hooks/support/useTopMoms";
import { buildAvatarDisplayUrl } from "../utils/cloudinaryUpload";
import { useNavigate } from "react-router-dom";
import { profilePathForUserId } from "../utils/helpers";

const TOP_MOMS_MAX = 30;

function TopCard({ u, rank, onOpenProfile }) {
  const accents = [
    { a: "#EC5F8C", soft: "rgba(236, 95, 140, 0.14)" },
    { a: "#805AD5", soft: "rgba(128, 90, 213, 0.14)" },
    { a: "#319795", soft: "rgba(49, 151, 149, 0.14)" },
  ];
  const { a, soft } = accents[(rank - 1) % accents.length];

  return (
    <Box
      role="button"
      tabIndex={0}
      position="relative"
      overflow="hidden"
      rounded="2xl"
      bg="white"
      borderWidth="1px"
      borderColor="gray.100"
      boxShadow="0 20px 50px rgba(15, 23, 42, 0.08)"
      p={{ base: 5, md: 6 }}
      cursor="pointer"
      transition="transform 0.15s ease, box-shadow 0.15s ease"
      _hover={{ transform: "translateY(-1px)", boxShadow: "0 26px 70px rgba(15, 23, 42, 0.12)" }}
      onClick={() => onOpenProfile?.(u.userId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpenProfile?.(u.userId);
      }}
    >
      <Box
        position="absolute"
        inset="-35% -20% auto -20%"
        h="140%"
        bg={`radial-gradient(ellipse 80% 60% at 50% 0%, ${soft} 0%, transparent 65%)`}
        opacity={0.8}
        pointerEvents="none"
      />
      <VStack align="stretch" spacing={3} position="relative">
        <HStack justify="space-between">
          <Text fontWeight="900" color={a}>
            #{rank}
          </Text>
          <Text fontSize="sm" color="gray.500" fontWeight="700">
            {u.supportScore} 💖
          </Text>
        </HStack>
        <HStack spacing={3}>
          <Avatar
            src={buildAvatarDisplayUrl(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME, u.avatarUrl)}
            name={u.username}
            bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
            color="white"
          />
          <VStack align="start" spacing={0} minW={0}>
            <Text fontWeight="900" color="gray.900" noOfLines={1}>
              {u.username}
            </Text>
            <Text fontSize="sm" color="gray.600">
              Hvala, ker podpiraš druge.
            </Text>
          </VStack>
        </HStack>
      </VStack>
    </Box>
  );
}

export default function TopMoms() {
  const { items, loading, error } = useTopMoms({ pageSize: TOP_MOMS_MAX });
  const shown = items.slice(0, TOP_MOMS_MAX);
  const navigate = useNavigate();
  const openProfile = (userId) => {
    if (userId == null) return;
    navigate(profilePathForUserId(userId));
  };

  return (
    <Box minH="100dvh" bgGradient="linear(to-b, #FFF8FB 0%, #FFFFFF 38%, #F4F8FF 100%)">
      <Container maxW="7xl" py={{ base: 8, md: 12 }} px={{ base: 4, md: 6 }}>
        <Stack spacing={{ base: 8, md: 10 }}>
          <Stack spacing={3}>
            <Heading
              fontSize={{ base: "2xl", md: "3xl" }}
              fontWeight="900"
              color="gray.900"
              letterSpacing="-0.02em"
            >
              🌸 Top mame tedna
            </Heading>
            <Text color="gray.600" maxW="2xl">
              Majhna zahvala za podporo, ki jo dajete drugim. Brez tekmovanja — samo občutek skupnosti.
            </Text>
          </Stack>

          {loading ? (
            <Box py={10} textAlign="center">
              <Spinner color="#EC5F8C" size="lg" thickness="3px" />
            </Box>
          ) : error ? (
            <Box bg="red.50" borderWidth="1px" borderColor="red.100" rounded="xl" p={4} color="red.700">
              {error}
            </Box>
          ) : shown.length === 0 ? (
            <Box bg="white" borderWidth="1px" borderColor="gray.100" rounded="2xl" p={6}>
              <Text color="gray.600">Ta teden še ni support reakcij.</Text>
            </Box>
          ) : (
            <>
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={{ base: 5, md: 6 }}>
                {shown.map((u, idx) => (
                  <TopCard key={u.userId} u={u} rank={idx + 1} onOpenProfile={openProfile} />
                ))}
              </SimpleGrid>
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
}

