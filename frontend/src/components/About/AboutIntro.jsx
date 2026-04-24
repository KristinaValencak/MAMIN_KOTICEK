import React from "react";
import { Box, Container, SimpleGrid, Image, Heading, Text, Stack } from "@chakra-ui/react";
import { motion, useReducedMotion } from "framer-motion";
import Image2 from "../../assets/Image2.webp";

const MotionBox = motion(Box);
const MotionImage = motion(Image);

const AboutIntro = () => {
  const prefersReducedMotion = useReducedMotion();
  const floatAnimate = prefersReducedMotion
    ? undefined
    : { y: [0, -8, 0], rotate: [-1, -0.35, -1] };
  const floatTransition = prefersReducedMotion
    ? undefined
    : {
        y: { duration: 7, repeat: Infinity, ease: "easeInOut" },
        rotate: { duration: 7, repeat: Infinity, ease: "easeInOut" },
      };

  return (
    <Box
      as="section"
      id="oskupnosti"
      position="relative"
      py={{ base: 20, md: 28 }}
      bg="linear-gradient(180deg, #FFF5F8 0%, #FFFFFF 100%)"
    >
      <Container maxW="container.xl">
        <SimpleGrid
          columns={{ base: 1, md: 2 }}
          spacing={{ base: 12, md: 20 }}
          alignItems="center"
        >
          <MotionBox
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
            viewport={{ once: true }}
            display="flex"
            justifyContent="center"
            alignItems="center"
          >
            <MotionBox
              rounded="3xl"
              overflow="hidden"
              maxW={{ base: "95%", md: "480px", lg: "550px" }}
              mx="auto"
              boxShadow="0 25px 60px rgba(236, 95, 140, 0.28), 0 10px 30px rgba(0, 0, 0, 0.12)"
              initial={{ rotate: prefersReducedMotion ? 0 : -1.5 }}
              animate={floatAnimate}
              transition={floatTransition}
              style={{ willChange: prefersReducedMotion ? "auto" : "transform" }}
            >
              <MotionImage
                src={Image2}
                alt="Mamin kotiček – skupnost"
                rounded="2xl"
                w="100%"
                h="auto"
                objectFit="cover"
              />
            </MotionBox>
          </MotionBox>

          <MotionBox
            bg="rgba(255, 255, 255, 0.85)"
            backdropFilter="blur(10px)"
            rounded="3xl"
            p={{ base: 8, md: 12 }}
            boxShadow="xl"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            viewport={{ once: true }}
          >
            <Stack spacing={6}>
              <Heading
                as="h2"
                fontSize={{ base: "2xl", md: "3xl" }}
                fontWeight="extrabold"
                color="#2D2D2D"
                lineHeight="1.2"
              >
                Tvoj varen prostor za materinstvo
              </Heading>

              <Text
                fontSize={{ base: "md", md: "lg" }}
                color="#5F5F5F"
                lineHeight="1.8"
              >
                Mamin kotiček je skupnost, kjer se mame povezujemo, si prisluhnemo
                in delimo resnične zgodbe materinstva. Brez popolnih filtrov,
                brez obsojanja – samo toplina, razumevanje in podpora.
              </Text>

              <Text
                fontSize="md"
                fontWeight="medium"
                color="#EC5F8C"
              >
                Ker nobena mama ne bi smela biti sama. 💗
              </Text>
            </Stack>
          </MotionBox>
        </SimpleGrid>
      </Container>
    </Box>
  );
};

export default AboutIntro;
