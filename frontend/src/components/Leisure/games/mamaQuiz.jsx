import { Badge, Box, Button, Container, Heading, HStack, Image, Progress, Stack, Text, VStack } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { FaArrowLeft, FaRegSmileBeam } from "react-icons/fa";
import { useMemo, useState } from "react";
import QUIZ from "./mamaQuiz.json";

import heroMamaQuiz from "../../../assets/games/mamaQuiz.png";

function shuffleArray(input) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickResult(types) {
  const counts = types.reduce((acc, t) => ({ ...acc, [t]: (acc[t] || 0) + 1 }), {});
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "survivor";
  return QUIZ.results[best] || QUIZ.results.survivor;
}

export default function MamaQuiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [shuffleKey, setShuffleKey] = useState(0);

  // Namesto vseh vprašanj pokažemo naključen nabor (bolj “igrivo”, manj utrujajoče).
  const SESSION_QUESTIONS = 6;

  const questions = useMemo(() => shuffleArray(QUIZ.questions || []).slice(0, SESSION_QUESTIONS), [shuffleKey]);
  const total = questions.length;
  const progress = Math.round(((Math.min(step, total)) / total) * 100);

  const result = useMemo(() => pickResult(answers), [answers]);

  const onPick = (type) => {
    setAnswers((prev) => [...prev, type]);
    setStep((s) => s + 1);
  };

  const reset = () => {
    setStep(0);
    setAnswers([]);
    setShuffleKey((k) => k + 1);
  };

  const done = step >= total;
  const current = questions[Math.min(step, total - 1)];

  return (
    <Box
      w="100%"
      overflowX="hidden"
      bgGradient="linear(to-b, #FFF1F2 0%, #FFFBEB 38%, #FDF2F8 100%)"
    >
      <Container maxW="6xl" pt={{ base: 10, md: 14 }} pb={{ base: 20, md: 24 }} px={{ base: 4, md: 6 }}>
        <Stack spacing={6}>
          <HStack justify="space-between" align="center">
            <Button as={RouterLink} to="/sprostitev-za-mamo" leftIcon={<FaArrowLeft />} variant="ghost" rounded="full">
              Nazaj
            </Button>
            <HStack spacing={3} minW={0}>
              <Text fontSize="lg" fontWeight="900" color="gray.800" noOfLines={1}>
                {QUIZ.title}
              </Text>
              <Badge rounded="full" px={3} py={1} bg="gray.900" color="white" flexShrink={0}>
                {total} vprašanj
              </Badge>
            </HStack>
            <Box w="72px" flexShrink={0} />
          </HStack>

          <Box
            bg="white"
            rounded="2xl"
            borderWidth="1px"
            borderColor="gray.100"
            p={{ base: 4, md: 6 }}
            boxShadow="0 14px 36px rgba(0,0,0,0.06)"
          >
            <Box
              rounded="2xl"
              overflow="hidden"
              borderWidth="2px"
              borderColor="pink.200"
              boxShadow="0 18px 48px rgba(190, 24, 93, 0.12), inset 0 1px 0 rgba(255,255,255,0.6)"
            >
              <Box position="relative" h={{ base: "132px", sm: "160px", md: "180px" }}>
                <Image
                  src={heroMamaQuiz}
                  alt=""
                  w="100%"
                  h="100%"
                  objectFit="cover"
                  objectPosition="center top"
                  draggable={false}
                />
                <Box
                  position="absolute"
                  inset={0}
                  bgGradient="linear(to-t, rgba(131, 24, 67, 0.88) 0%, rgba(190, 24, 93, 0.35) 45%, transparent 100%)"
                  pointerEvents="none"
                />
                <Box position="absolute" bottom={0} left={0} right={0} h="3px" bg="#FDE047" />
                <VStack
                  align="start"
                  spacing={1}
                  position="absolute"
                  bottom={{ base: 3, md: 4 }}
                  left={{ base: 4, md: 6 }}
                  right={{ base: 4, md: 6 }}
                >
                  <Text
                    as="span"
                    fontSize={{ base: "xl", md: "2xl" }}
                    fontWeight="900"
                    lineHeight="1.15"
                    color="white"
                    textShadow="0 2px 14px rgba(0,0,0,0.35)"
                    fontFamily="heading"
                  >
                    Kakšna{" "}
                    <Text as="span" color="#FEF08A">
                      mama si danes?
                    </Text>
                  </Text>
                  <Badge
                    bg="rgba(255,255,255,0.95)"
                    color="#9D174D"
                    px={2.5}
                    py={0.5}
                    rounded="md"
                    fontSize="10px"
                    fontWeight="800"
                    letterSpacing="0.08em"
                    textTransform="uppercase"
                    boxShadow="0 2px 8px rgba(0,0,0,0.12)"
                  >
                    Dnevno vprašanje
                  </Badge>
                </VStack>
              </Box>

              <Box
                bg="linear-gradient(180deg, #FFFBF0 0%, #FFF7ED 35%, #FEF3C7 120%)"
                px={{ base: 4, md: 6 }}
                py={{ base: 5, md: 6 }}
                position="relative"
                borderTopWidth="1px"
                borderTopColor="rgba(251, 113, 133, 0.25)"
              >
                <Box
                  position="absolute"
                  inset={3}
                  borderRadius="xl"
                  borderWidth="2px"
                  borderStyle="dashed"
                  borderColor="rgba(244, 114, 182, 0.35)"
                  pointerEvents="none"
                  display={{ base: "none", sm: "block" }}
                />

                <Box position="relative" zIndex={1}>
                  <Progress
                    value={progress}
                    rounded="full"
                    h="8px"
                    mb={5}
                    sx={{
                      "& > div:first-of-type": {
                        background: "linear-gradient(90deg, #EC4899 0%, #F59E0B 100%)",
                      },
                    }}
                    bg="rgba(255,255,255,0.7)"
                  />

                  {!done ? (
                    <VStack align="stretch" spacing={4}>
                      <HStack spacing={2} color="pink.700">
                        <FaRegSmileBeam />
                        <Text fontWeight="800" fontSize="sm">
                          Vprašanje {step + 1} / {total}
                        </Text>
                      </HStack>
                      <Heading
                        size={{ base: "md", md: "lg" }}
                        color="gray.900"
                        lineHeight="1.2"
                        fontWeight="800"
                      >
                        {current.question}
                      </Heading>
                      <Text color="gray.600" fontSize="sm">
                        Izberi prvo, kar ti sede — brez pravega ali napačnega odgovora.
                      </Text>
                      <VStack align="stretch" spacing={3} pt={1}>
                        {current.answers.map((o) => (
                          <Button
                            key={o.text}
                            onClick={() => onPick(o.type)}
                            size="lg"
                            rounded="xl"
                            variant="outline"
                            bg="rgba(255,255,255,0.85)"
                            color="gray.900"
                            borderWidth="2px"
                            borderColor="pink.200"
                            _hover={{
                              bg: "pink.50",
                              borderColor: "pink.400",
                              color: "gray.900",
                              transform: "translateY(-2px)",
                              boxShadow: "0 10px 24px rgba(190, 24, 93, 0.12)",
                            }}
                            _active={{ color: "gray.900" }}
                            transition="all 0.18s"
                            justifyContent="flex-start"
                            fontWeight="700"
                            whiteSpace="normal"
                            textAlign="left"
                            h="auto"
                            py={4}
                          >
                            {o.text}
                          </Button>
                        ))}
                      </VStack>
                    </VStack>
                  ) : (
                    <VStack align="stretch" spacing={4}>
                      <Badge
                        alignSelf="start"
                        bg="#FDE047"
                        color="#713F12"
                        px={3}
                        py={1}
                        rounded="lg"
                        fontWeight="800"
                        fontSize="xs"
                        textTransform="uppercase"
                        letterSpacing="0.06em"
                      >
                        Tvoj rezultat
                      </Badge>
                      <Heading size={{ base: "lg", md: "xl" }} color="gray.900" lineHeight="1.15">
                        {result.title}
                      </Heading>
                      <Text color="gray.700" fontSize={{ base: "md", md: "lg" }} lineHeight="tall">
                        {result.description}
                      </Text>
                      <Box
                        bg="white"
                        borderWidth="2px"
                        borderStyle="dashed"
                        borderColor="pink.200"
                        rounded="xl"
                        p={4}
                        boxShadow="0 8px 24px rgba(190, 24, 93, 0.06)"
                      >
                        <HStack spacing={2} mb={2} color="pink.600">
                          <FaRegSmileBeam />
                          <Text fontWeight="800" fontSize="sm">
                            Zate
                          </Text>
                        </HStack>
                        <Text color="gray.800" fontWeight="700" lineHeight="tall">
                          {result.support}
                        </Text>
                      </Box>
                      <HStack spacing={3} pt={2} flexWrap="wrap">
                        <Button
                          onClick={reset}
                          rounded="full"
                          bg="gray.900"
                          color="white"
                          _hover={{ bg: "gray.800" }}
                        >
                          Še enkrat
                        </Button>
                        <Button as={RouterLink} to="/sprostitev-za-mamo" rounded="full" variant="outline">
                          Nazaj na igre
                        </Button>
                      </HStack>
                    </VStack>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
