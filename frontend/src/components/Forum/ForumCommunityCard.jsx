import { Box, HStack, Icon, Link, Text, VStack, Heading } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { FaInstagram, FaTiktok, FaHeart } from "react-icons/fa";

const linkProps = {
  fontSize: "xs",
  fontWeight: "500",
  color: "gray.600",
  lineHeight: "1.35",
  _hover: { color: "pink.500" },
};

export default function ForumCommunityCard() {
  return (
    <Box
      borderRadius="2xl"
      overflow="hidden"
      bg="white"
      borderWidth="1px"
      borderColor="gray.100"
      boxShadow="0 4px 24px rgba(15, 23, 42, 0.06)"
    >
      <Box h="3px" w="full" bgGradient="linear(to-r, #EC5F8C, #F48FB1)" />
      <Box p={4}>
        <HStack spacing={2} mb={2}>
          <Box
            w={9}
            h={9}
            rounded="xl"
            bg="pink.50"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Icon as={FaHeart} color="pink.400" boxSize={4} />
          </Box>
          <Heading fontSize="sm" fontWeight="900" color="gray.900" letterSpacing="-0.02em">
            Skupnost
          </Heading>
        </HStack>

        <Text fontSize="xs" color="gray.600" lineHeight="1.65">
          Mamin kotiček je varen prostor za vse mamice, kjer delimo izkušnje, podporo in toplino – ker je materinstvo lažje skupaj.
        </Text>
        <Text fontSize="xs" color="gray.600" mt={2}>
          <Link href="mailto:info.maminkoticek@gmail.com" fontSize="xs" color="pink.600" fontWeight="500" _hover={{ textDecoration: "underline" }}>
            info.maminkoticek@gmail.com
          </Link>
        </Text>

        <VStack align="stretch" spacing={1} mt={4} pt={4} borderTopWidth="1px" borderColor="gray.100">
          <Link as={RouterLink} to="/o-nas" {...linkProps}>
            O maminem kotičku
          </Link>
          <Link as={RouterLink} to="/pogoji-uporabe" {...linkProps}>
            Pogoji uporabe
          </Link>
          <Link as={RouterLink} to="/politika-zasebnosti" {...linkProps}>
            Politika zasebnosti
          </Link>
          <Link as={RouterLink} to="/politika-piskotkov" {...linkProps}>
            Politika piškotkov
          </Link>
        </VStack>

        <HStack spacing={3} justify="center" mt={4}>
          {[FaTiktok, FaInstagram].map((I, i) => (
            <Link key={i} href="#" isExternal aria-label={i === 0 ? "TikTok" : "Instagram"}>
              <Box
                p={2.5}
                bg="pink.50"
                rounded="full"
                border="1px solid"
                borderColor="pink.100"
                _hover={{ bg: "pink.100", borderColor: "pink.200" }}
                transition="all 0.2s"
              >
                <Icon as={I} boxSize={4} color="pink.500" />
              </Box>
            </Link>
          ))}
        </HStack>

        <Text fontSize="10px" color="gray.400" textAlign="center" mt={3} lineHeight="1.4">
          © {new Date().getFullYear()} Mamin kotiček
        </Text>
      </Box>
    </Box>
  );
}
