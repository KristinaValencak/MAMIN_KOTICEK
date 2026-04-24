import React from "react";
import {Box, Container, Heading, SimpleGrid, Stack, Text, Flex} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { FiMessageCircle, FiHeart, FiCoffee, FiShoppingBag } from "react-icons/fi";

const MotionBox = motion(Box);

const FeatureCard = ({ icon: Icon, title, text, delay = 0 }) => {
  const IconComponent = Icon;
  return (
    <MotionBox
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay }}
      viewport={{ once: true }}
      bg="rgba(255, 255, 255, 0.85)"
      backdropFilter="blur(12px)"
      rounded="3xl"
      p={{ base: 8, md: 10 }}
      boxShadow="0 20px 40px rgba(0,0,0,0.06)"
      _hover={{
        transform: "translateY(-6px)",
        boxShadow: "0 30px 60px rgba(236, 95, 140, 0.18)",
      }}
      transitionProperty="all"
      transitionTimingFunction="ease"
    >
      <Stack spacing={5} align="center" textAlign="center">
        <Flex
          w="56px"
          h="56px"
          align="center"
          justify="center"
          rounded="full"
          bg="rgba(236, 95, 140, 0.12)"
          color="#EC5F8C"
        >
          <IconComponent size={26} />
        </Flex>

        <Heading
          as="h3"
          fontSize="xl"
          fontWeight="bold"
          color="#2D2D2D"
        >
          {title}
        </Heading>

        <Text
          fontSize="md"
          color="#5F5F5F"
          lineHeight="1.7"
        >
          {text}
        </Text>
      </Stack>
    </MotionBox>
  );
};

const WhatWeOffer = () => {
  return (
    <Box
      as="section"
      id="sekcija-ponujamo"
      py={{ base: 20, md: 28 }}
      bg="linear-gradient(180deg, #FFFFFF 0%, #FFF5F8 100%)"
    >
      <Container maxW="container.xl">
        <Stack spacing={{ base: 12, md: 16 }}>
          <Stack spacing={4} textAlign="center">
            <Heading
              as="h2"
              fontSize={{ base: "3xl", md: "3rem" }}
              fontWeight="extrabold"
              color="#2D2D2D"
            >
              Mamin kotiček ponuja
            </Heading>

            <Text
              fontSize="lg"
              color="#5F5F5F"
              maxW="2xl"
              mx="auto"
            >
              Premišljeno zasnovan prostor za podporo, pogovor in sodobno pomoč mamicam.
            </Text>
          </Stack>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={10}>
            <FeatureCard
              icon={FiMessageCircle}
              title="Kotiček pogovorov"
              text="Odprt in moderiran prostor za vprašanja, izmenjavo izkušenj in iskrene pogovore."
              delay={0}
            />

            <FeatureCard
              icon={FiHeart}
              title="Podporna skupnost"
              text="Varno okolje brez obsojanja, kjer so razumevanje, empatija in spoštovanje na prvem mestu."
              delay={0.1}
            />

            <FeatureCard
              icon={FiCoffee}
              title="Kotiček za sprostitev"
              text="Lahkotni pogovori o vsakdanjih temah, trenutkih zase in življenju izven materinstva."
              delay={0.2}
            />

            <FeatureCard
              icon={FiShoppingBag}
              title="Marketplace"
              text="Oddaj ali poišči oglase med mamicami – preprosto, na lastno odgovornost in brez plačil v aplikaciji."
              delay={0.3}
            />
          </SimpleGrid>
        </Stack>
      </Container>
    </Box>
  );
};

export default WhatWeOffer;
