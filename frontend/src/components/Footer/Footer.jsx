import React from "react";
import { Box, Container, SimpleGrid, Stack, Text, Link, Button, Icon, HStack, Image } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { motion } from "framer-motion";
import { FaFacebookF, FaInstagram } from "react-icons/fa";
import Logo from "../../assets/Logo.webp";

const MotionBox = motion.create(Box);

const Footer = ({ variant = "default" }) => {
  const isForum = variant === "forum";

  return (
    <Box
      as="footer"
      position="relative"
      overflow="hidden"
      py={{ base: 14, md: 20 }}
      bg={isForum ? undefined : "linear-gradient(180deg, #FFE0EB 0%, #FFD6E6 40%, #FFCCE0 100%)"}
      bgGradient={isForum ? "linear(to-r, brand.500, brand.600)" : undefined}
      borderTop={isForum ? "1px solid" : "2px solid"}
      borderColor={isForum ? "rgba(255, 255, 255, 0.2)" : "#EC5F8C"}
      _before={
        isForum
          ? {
            content: '""',
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(900px 520px at 15% 20%, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 60%), radial-gradient(760px 520px at 85% 30%, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0) 62%), radial-gradient(820px 520px at 55% 105%, rgba(255, 255, 255, 0.20) 0%, rgba(255, 255, 255, 0) 60%)",
            filter: "blur(26px)",
            transform: "translateZ(0)",
            zIndex: 0,
            pointerEvents: "none",
          }
          : undefined
      }
    >
      <Container maxW="container.xl">
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={{ base: 10, md: 16 }} position="relative" zIndex={1}>

          <MotionBox initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
            <Stack spacing={5}>
              <HStack spacing={3}>
                <Image
                  src={Logo}
                  alt="Mamin kotiček"
                  boxSize="52px"
                  filter={isForum ? "brightness(0) invert(1)" : undefined}
                />
                <Text fontWeight="bold" fontSize="lg" color={isForum ? "white" : "gray.800"}>
                  Mamin kotiček
                </Text>
              </HStack>

              <Text fontSize="sm" color={isForum ? "whiteAlpha.900" : "gray.600"} maxW="sm" lineHeight="1.7">
                Mamin kotiček je varen prostor za vse mamice, kjer delimo izkušnje, podporo in toplino – ker je materinstvo lažje skupaj.
              </Text>

              <Text fontSize="sm" color={isForum ? "whiteAlpha.900" : "gray.600"}>
                Email: info.maminkoticek@gmail.com
              </Text>

              <Button
                as={RouterLink}
                to="/"
                rounded="full"
                px={8}
                bg={isForum ? "rgba(255, 255, 255, 0.16)" : "linear-gradient(135deg, #EC5F8C, #F48FB1)"}
                color="white"
                border={isForum ? "1px solid rgba(255, 255, 255, 0.28)" : undefined}
                backdropFilter={isForum ? "blur(10px)" : undefined}
                boxShadow={isForum ? "0 14px 44px rgba(0, 0, 0, 0.20)" : "0 10px 25px rgba(236, 95, 140, 0.35)"}
                _hover={
                  isForum
                    ? { bg: "rgba(255, 255, 255, 0.22)", transform: "translateY(-2px)" }
                    : { transform: "translateY(-2px)", boxShadow: "0 14px 30px rgba(236, 95, 140, 0.45)", bg: "linear-gradient(135deg, #D94B8C, #EC5F8C)" }
                }
                _active={isForum ? { transform: "translateY(0)" } : { bg: "linear-gradient(135deg, #C73A7A, #D94B8C)" }}
                transition="all .25s ease"
                alignSelf="flex-start"
              >
                Vstopi v kotiček
              </Button>
            </Stack>
          </MotionBox>

          {/* DESNI DEL */}
          <MotionBox initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} viewport={{ once: true }}>
            <SimpleGrid columns={{ base: 2, sm: 3 }} spacing={6} mt={{ base: 6, md: 14 }}>
              <Stack spacing={2} fontSize="sm">
                <Link as={RouterLink} to="/registracija" color={isForum ? "whiteAlpha.900" : "gray.700"} _hover={{ color: isForum ? "white" : "#EC5F8C", transform: "translateX(2px)" }} transition="all .2s">Registracija</Link>
                <Link as={RouterLink} to="/prijava" color={isForum ? "whiteAlpha.900" : "gray.700"} _hover={{ color: isForum ? "white" : "#EC5F8C", transform: "translateX(2px)" }} transition="all .2s">Prijava</Link>
                <Link as={RouterLink} to="/" color={isForum ? "whiteAlpha.900" : "gray.700"} _hover={{ color: isForum ? "white" : "#EC5F8C", transform: "translateX(2px)" }} transition="all .2s">Kotiček</Link>
                <Link as={RouterLink} to="/marketplace" color={isForum ? "whiteAlpha.900" : "gray.700"} _hover={{ color: isForum ? "white" : "#EC5F8C", transform: "translateX(2px)" }} transition="all .2s">Marketplace</Link>
              </Stack>

              <Stack spacing={2} fontSize="sm">
                <Link as={RouterLink} to="/pogoji-uporabe" color={isForum ? "whiteAlpha.900" : "gray.700"} _hover={{ color: isForum ? "white" : "#EC5F8C", transform: "translateX(2px)" }} transition="all .2s">Pogoji uporabe</Link>
                <Link as={RouterLink} to="/politika-zasebnosti" color={isForum ? "whiteAlpha.900" : "gray.700"} _hover={{ color: isForum ? "white" : "#EC5F8C", transform: "translateX(2px)" }} transition="all .2s">Politika zasebnosti</Link>
                <Link as={RouterLink} to="/politika-piskotkov" color={isForum ? "whiteAlpha.900" : "gray.700"} _hover={{ color: isForum ? "white" : "#EC5F8C", transform: "translateX(2px)" }} transition="all .2s">Politika piškotkov</Link>
                {/*
                <Link href="https://buymeacoffee.com/maminkoticek" isExternal color={isForum ? "whiteAlpha.900" : "gray.700"} _hover={{ color: isForum ? "white" : "#EC5F8C", transform: "translateX(2px)" }} transition="all .2s">Podpri Mamin kotiček</Link>
                */}
              </Stack>
            </SimpleGrid>
          </MotionBox>
        </SimpleGrid>

        <HStack spacing={4} justify="center" mt={16} position="relative" zIndex={1}>
          {[
            { icon: FaFacebookF, href: "#" },
            { icon: FaInstagram, href: "https://www.instagram.com/mamin.koticek?igsh=ZW10Mm13NG9jcmV4" },
          ].map(({ icon: I, href }) => (
            <Link key={href} href={href} isExternal>
              <Box
                p={3}
                bg={isForum ? "rgba(255, 255, 255, 0.16)" : "white"}
                rounded="full"
                boxShadow={isForum ? "0 10px 26px rgba(0, 0, 0, 0.18)" : "0 2px 8px rgba(236, 95, 140, 0.15)"}
                border="1px solid"
                borderColor={isForum ? "rgba(255, 255, 255, 0.28)" : "rgba(236, 95, 140, 0.2)"}
                backdropFilter={isForum ? "blur(10px)" : undefined}
                _hover={{
                  transform: "scale(1.08)",
                  boxShadow: isForum ? "0 14px 34px rgba(0, 0, 0, 0.22)" : "0 4px 12px rgba(236, 95, 140, 0.3)",
                  borderColor: isForum ? "rgba(255, 255, 255, 0.40)" : "rgba(236, 95, 140, 0.4)",
                }}
                transition="all .2s"
              >
                <Icon as={I} boxSize={5} color={isForum ? "white" : "#EC5F8C"} />
              </Box>
            </Link>
          ))}
        </HStack>

        <Text fontSize="xs" color={isForum ? "whiteAlpha.800" : "gray.500"} textAlign="center" mt={6} position="relative" zIndex={1}>
          © {new Date().getFullYear()} Mamin kotiček. Vse pravice pridržane.
        </Text>
      </Container>
    </Box>
  );
};

export default Footer;
