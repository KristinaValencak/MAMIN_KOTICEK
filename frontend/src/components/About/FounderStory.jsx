import React from "react";
import { Box, Container, SimpleGrid, Heading, Text, Stack } from "@chakra-ui/react";
import { motion, useReducedMotion } from "framer-motion";
import Image1 from "../../assets/Image1.png";

const MotionBox = motion(Box);
const MotionImage = motion("img");

const FounderStory = () => {
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
    <Box as="section" id="moja-zgodba" py={{ base: 20, md: 28 }} bg="linear-gradient(180deg, #FFFFFF 0%, #FFF8FA 100%)">
      <Container maxW="container.xl">
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={{ base: 14, md: 20 }} alignItems="center">

          <MotionBox
            order={{ base: 2, lg: 1 }}
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
              maxW={{ base: "95%", md: "430px", lg: "480px" }}
              mx="auto"
              boxShadow="0 25px 60px rgba(236, 95, 140, 0.28), 0 10px 30px rgba(0, 0, 0, 0.12)"
              initial={{ rotate: prefersReducedMotion ? 0 : -1.5 }}
              animate={floatAnimate}
              transition={floatTransition}
              style={{ willChange: prefersReducedMotion ? "auto" : "transform" }}
            >
              <MotionImage
                src={Image1}
                alt="Nogice dojenčka"
                style={{ width: "100%", borderRadius: "1.5rem", objectFit: "cover" }}
              />
            </MotionBox>
          </MotionBox>

          <MotionBox
            order={{ base: 1, lg: 2 }}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
            viewport={{ once: true }}
          >
            <Stack spacing={8}>
              <Heading as="h2" fontSize={{ base: "2.5rem", md: "3rem" }} lineHeight="1.1" fontWeight="extrabold" color="#2D2D2D">
                Zakaj je nastal Mamin kotiček
              </Heading>

              <Stack spacing={5} maxW="2xl">
                <Text fontSize="md" color="#5F5F5F">
                  Mamin kotiček sem ustvarila na podlagi lastne izkušnje, ob kateri sem spoznala, kako polno izzivov in hkrati čudovito je obdobje materinstva.
                </Text>

                <Text fontSize="md" color="#5F5F5F">
                  V tem času se pojavi veliko vprašanj, izzivov in občutkov, o katerih pogosto ni dovolj prostora za odprt pogovor. Prav zato sem želela ustvariti okolje, kjer se mamice lahko povezujejo, delijo svoje izkušnje in najdejo podporo.
                </Text>

                <Text fontSize="md" color="#5F5F5F">
                  Mamin kotiček je tako prostor, ki temelji na razumevanju, zaupanju in skupnosti – prostor, kjer nobena mamica ni sama.
                </Text>
              </Stack>
            </Stack>
          </MotionBox>

        </SimpleGrid>
      </Container>
    </Box>
  );
};

export default FounderStory;
