import React from "react";
import { Box, Container, VStack, Heading, Text, Button, Stack } from "@chakra-ui/react";
import { motion, useReducedMotion } from "framer-motion";
import { Link as RouterLink } from "react-router-dom";
const MotionRouterLink = motion(RouterLink);
const MotionHeading = motion(Heading);
const MotionText = motion(Text);

const AboutHero = () => {
  const prefersReducedMotion = useReducedMotion();
  const TEXT_ON_HERO = "rgba(255, 255, 255, 0.96)";
  const TEXT_ON_HERO_MUTED = "rgba(255, 255, 255, 0.92)";

  return (
    <Box
      as="section"
      id="domov"
      position="relative"
      overflow="hidden"
      minH={{ base: "88vh", md: "92vh" }}
      display="flex"
      alignItems="center"
      bgGradient="linear(to-b, brand.600 0%, brand.500 22%, #FF9BC8 52%, #FFE4F1 100%)"
      _before={{
        content: '""',
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(980px 520px at 18% 18%, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 62%), radial-gradient(820px 520px at 85% 28%, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0) 64%), radial-gradient(820px 520px at 55% 100%, rgba(255, 255, 255, 0.20) 0%, rgba(255, 255, 255, 0) 60%)",
        filter: "blur(26px)",
        transform: "translateZ(0)",
        zIndex: 0,
      }}
      _after={{
        content: '""',
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: { base: "160px", md: "190px" },
        bgGradient: "linear(to-r, brand.500 0%, brand.600 100%)",
        opacity: 0.78,
        WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
        maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <Container
        maxW="container.lg"
        position="relative"
        zIndex={1}
        py={{ base: 16, md: 20 }}
        textAlign="center"
      >
        <VStack spacing={{ base: 5, md: 6 }} maxW="3xl" mx="auto">
          <MotionHeading
            fontSize={{ base: "4xl", md: "6xl", lg: "7xl" }}
            fontWeight="900"
            lineHeight={{ base: "1.08", md: "1.04" }}
            letterSpacing={{ base: "-0.03em", md: "-0.04em" }}
            color={TEXT_ON_HERO}
            textShadow="0 20px 60px rgba(0, 0, 0, 0.42)"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 18 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            Dobrodošla v Maminem kotičku
          </MotionHeading>

          <MotionText
            fontSize={{ base: "lg", md: "xl", lg: "2xl" }}
            lineHeight={{ base: "1.65", md: "1.7" }}
            fontWeight="500"
            color={TEXT_ON_HERO_MUTED}
            maxW="2xl"
            mx="auto"
            textShadow="0 16px 52px rgba(0, 0, 0, 0.40)"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 14 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
          >
            Tvoj prostor za pogovor, podporo in deljenje vsakdanjih čudežev materinstva.
            Tukaj nisi nikoli sama – pridruži se mamicam, ki razumejo.
          </MotionText>

          <Stack direction={{ base: "column", sm: "row" }} spacing={3} justify="center" pt={{ base: 1, md: 2 }}>
            <Button
              as={MotionRouterLink}
              to="/"
              whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
              size="lg"
              rounded="full"
              px={9}
              bgGradient="linear(to-r, brand.500, brand.600)"
              color="white"
              boxShadow="0 18px 54px rgba(0, 0, 0, 0.22)"
              _hover={{ filter: "brightness(0.98)", transform: "translateY(-1px)" }}
              _active={{ transform: "translateY(0)" }}
              transition="transform 0.2s ease, filter 0.2s ease"
            >
              Vstopi v kotiček
            </Button>
          </Stack>

          <Text
            id="main"
            fontSize={{ base: "sm", md: "md" }}
            fontWeight="600"
            color="#EC5F8C"
            textShadow="0 14px 42px rgba(0, 0, 0, 0.38)"
          >
            Brezplačno članstvo – varen prostor za vse mame
          </Text>
        </VStack>
      </Container>
    </Box>
  );
};

export default AboutHero;
