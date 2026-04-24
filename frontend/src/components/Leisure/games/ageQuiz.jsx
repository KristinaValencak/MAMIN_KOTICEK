import { Badge, Box, Button, Container, Heading, HStack, Image, Progress, SimpleGrid, Stack, Text, VStack } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { FaArrowLeft, FaBaby } from "react-icons/fa";
import { useMemo, useState } from "react";
import QUIZ from "./ageQuiz.json";

import heroAgeQuiz from "../../../assets/games/ageQuiz.png";

function shuffleArray(input) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getResultForScore(score) {
  const found = (QUIZ.results || []).find((r) => score >= r.minScore && score <= r.maxScore);
  return found || QUIZ.results?.[0];
}

const LETTERS = ["A", "B", "C"];
/** Oranžna, modra, zelena — kot na ilustraciji */
const OPTION_CARD = [
  {
    gradient: "linear-gradient(165deg, #FDBA74 0%, #F97316 45%, #EA580C 100%)",
    bar: "#C2410C",
    emoji: "🧸",
    shadow: "rgba(234, 88, 12, 0.4)",
  },
  {
    gradient: "linear-gradient(165deg, #93C5FD 0%, #3B82F6 45%, #2563EB 100%)",
    bar: "#1D4ED8",
    emoji: "🦆",
    shadow: "rgba(37, 99, 235, 0.4)",
  },
  {
    gradient: "linear-gradient(165deg, #86EFAC 0%, #22C55E 45%, #16A34A 100%)",
    bar: "#15803D",
    emoji: "🧱",
    shadow: "rgba(22, 163, 74, 0.4)",
  },
];

export default function AgeQuiz() {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [pickedIndex, setPickedIndex] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [shuffleKey, setShuffleKey] = useState(0);

  const SESSION_QUESTIONS = 8;

  const questions = useMemo(() => shuffleArray(QUIZ.questions || []).slice(0, SESSION_QUESTIONS), [shuffleKey]);
  const total = questions.length;
  const done = idx >= total;
  const current = questions[Math.min(idx, total - 1)];
  const progress = Math.round(((Math.min(idx, total)) / total) * 100);

  const result = useMemo(() => getResultForScore(score), [score]);

  const titleClean = String(QUIZ.title || "")
    .replace(/\s*🍼\s*$/u, "")
    .trim();

  const pick = (optionIndex) => {
    if (showExplanation) return;
    const isCorrect = optionIndex === current.correctIndex;
    const points = isCorrect ? 1 : 0;
    setPickedIndex(optionIndex);
    setShowExplanation(true);
    setScore((s) => s + points);
  };

  const next = () => {
    setIdx((v) => v + 1);
    setPickedIndex(null);
    setShowExplanation(false);
  };

  const reset = () => {
    setIdx(0);
    setScore(0);
    setPickedIndex(null);
    setShowExplanation(false);
    setShuffleKey((k) => k + 1);
  };

  return (
    <Box
      w="100%"
      overflowX="hidden"
      bgGradient="linear(to-b, #EFF6FF 0%, #FFF7ED 42%, #FDF2F8 100%)"
    >
      <Container maxW="6xl" pt={{ base: 10, md: 14 }} pb={{ base: 20, md: 24 }} px={{ base: 4, md: 6 }}>
        <Stack spacing={6}>
          <HStack justify="space-between" align="center">
            <Button as={RouterLink} to="/sprostitev-za-mamo" leftIcon={<FaArrowLeft />} variant="ghost" rounded="full">
              Nazaj
            </Button>
            <HStack spacing={3} minW={0}>
              <Text fontSize="lg" fontWeight="900" color="gray.800" noOfLines={1}>
                {titleClean || QUIZ.title}
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
              borderColor="blue.200"
              boxShadow="0 18px 48px rgba(37, 99, 235, 0.12), inset 0 1px 0 rgba(255,255,255,0.55)"
            >
              <Box position="relative" h={{ base: "148px", sm: "176px", md: "200px" }}>
                <Image
                  src={heroAgeQuiz}
                  alt=""
                  w="100%"
                  h="100%"
                  objectFit="cover"
                  objectPosition="center top"
                  draggable={false}
                  filter={done ? "brightness(0.94)" : undefined}
                />
                <Box
                  position="absolute"
                  inset={0}
                  bgGradient="linear(to-t, rgba(30, 58, 138, 0.85) 0%, rgba(59, 130, 246, 0.3) 48%, transparent 100%)"
                  pointerEvents="none"
                />
                <Box position="absolute" bottom={0} left={0} right={0} h="3px" bg="#FACC15" />

                <VStack
                  align="start"
                  spacing={2}
                  position="absolute"
                  bottom={{ base: 3, md: 5 }}
                  left={{ base: 4, md: 6 }}
                  right={{ base: 4, md: 6 }}
                >
                  <HStack spacing={2} align="center" flexWrap="wrap">
                    <Text
                      as="span"
                      fontSize={{ base: "xl", md: "2xl" }}
                      fontWeight="900"
                      lineHeight="1.1"
                      color="white"
                      fontFamily="heading"
                      sx={{
                        textShadow:
                          "0 0 1px #1E40AF, 0 2px 0 #1E40AF, 2px 2px 0 #1E40AF, -1px -1px 0 #1E40AF, 1px -1px 0 #1E40AF, -1px 1px 0 #1E40AF, 0 3px 12px rgba(0,0,0,0.35)",
                      }}
                    >
                      Ugani starost
                    </Text>
                    <Text
                      as="span"
                      fontSize={{ base: "xl", md: "2xl" }}
                      fontWeight="900"
                      lineHeight="1.1"
                      color="#FEF08A"
                      fontFamily="heading"
                      sx={{
                        textShadow:
                          "0 0 1px #1D4ED8, 0 2px 0 #1E40AF, 2px 2px 0 #1E3A8A, -1px -1px 0 #1E40AF, 0 3px 12px rgba(0,0,0,0.35)",
                      }}
                    >
                      otroka
                    </Text>
                    <Text as="span" fontSize="xl" aria-hidden>
                      🍼
                    </Text>
                  </HStack>
                  <Box
                    bg="linear-gradient(90deg, #DC2626 0%, #B91C1C 100%)"
                    px={4}
                    py={1.5}
                    rounded="lg"
                    transform="rotate(-1deg)"
                    boxShadow="0 6px 18px rgba(185, 28, 28, 0.45)"
                    borderWidth="1px"
                    borderColor="rgba(255,255,255,0.35)"
                  >
                    <Text
                      color="white"
                      fontWeight="800"
                      fontSize="sm"
                      fontFamily="heading"
                      letterSpacing="0.02em"
                      textShadow="0 1px 4px rgba(0,0,0,0.35)"
                    >
                      Kdaj kaj zmore?
                    </Text>
                  </Box>
                </VStack>
              </Box>

              <Box
                bg="linear-gradient(180deg, #FFFBF0 0%, #EFF6FF 40%, #F0FDF4 120%)"
                px={{ base: 4, md: 6 }}
                py={{ base: 5, md: 6 }}
                borderTopWidth="1px"
                borderTopColor="rgba(96, 165, 250, 0.35)"
              >
                {!done ? (
                  <>
                    <Progress
                      value={progress}
                      rounded="full"
                      h="8px"
                      mb={5}
                      sx={{
                        "& > div:first-of-type": {
                          background: "linear-gradient(90deg, #F97316 0%, #3B82F6 50%, #22C55E 100%)",
                        },
                      }}
                      bg="rgba(255,255,255,0.8)"
                    />

                    <VStack align="stretch" spacing={4} mb={1}>
                      <HStack spacing={2} color="blue.700">
                        <FaBaby />
                        <Text fontWeight="800" fontSize="sm">
                          Vprašanje {idx + 1} / {total} · točke {score}/{total}
                        </Text>
                      </HStack>
                      <Heading
                        size={{ base: "md", md: "lg" }}
                        color="gray.900"
                        lineHeight="1.25"
                        fontWeight="800"
                      >
                        {current.question}
                      </Heading>
                      <Text color="gray.600" fontSize="sm" lineHeight="tall">
                        {QUIZ.description}
                      </Text>
                    </VStack>

                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} pt={2}>
                      {current.options.map((o, optionIndex) => {
                        const isPicked = pickedIndex === optionIndex;
                        const isCorrect = optionIndex === current.correctIndex;
                        const theme = OPTION_CARD[optionIndex] || OPTION_CARD[0];
                        const letter = LETTERS[optionIndex] || "?";
                        const revealed = showExplanation;
                        const showCorrect = revealed && isCorrect;
                        const showWrong = revealed && isPicked && !isCorrect;

                        return (
                          <Box
                            key={`${idx}-${o}`}
                            rounded="2xl"
                            borderWidth="4px"
                            borderColor="white"
                            overflow="hidden"
                            boxShadow={`0 14px 32px ${theme.shadow}`}
                            transform={revealed && isPicked ? "scale(1.02)" : undefined}
                            transition="all 0.2s ease"
                            outline={showCorrect ? "3px solid" : showWrong ? "3px solid" : undefined}
                            outlineColor={showCorrect ? "green.400" : showWrong ? "red.400" : "transparent"}
                            outlineOffset="2px"
                          >
                            <Button
                              onClick={() => pick(optionIndex)}
                              variant="unstyled"
                              w="100%"
                              h="auto"
                              display="block"
                              isDisabled={revealed}
                              cursor={revealed ? "default" : "pointer"}
                              _disabled={{ opacity: 1 }}
                            >
                              <Box bg={theme.gradient} px={3} pt={4} pb={3}>
                                <VStack spacing={2}>
                                  <HStack spacing={1} justify="center" color="white" fontSize="xs" opacity={0.95}>
                                    <Text>★</Text>
                                    <Text>✨</Text>
                                    <Text>★</Text>
                                  </HStack>
                                  <Box
                                    w="40px"
                                    h="40px"
                                    borderRadius="full"
                                    bg="rgba(255,255,255,0.25)"
                                    borderWidth="2px"
                                    borderColor="rgba(255,255,255,0.65)"
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    fontWeight="900"
                                    fontSize="lg"
                                    color="white"
                                    textShadow="0 1px 4px rgba(0,0,0,0.25)"
                                  >
                                    {letter}
                                  </Box>
                                  <Text fontSize="2xl" lineHeight="1">
                                    {theme.emoji}
                                  </Text>
                                  <Text
                                    fontWeight="900"
                                    fontSize="sm"
                                    color="white"
                                    textAlign="center"
                                    lineHeight="1.35"
                                    textShadow="0 2px 8px rgba(0,0,0,0.2)"
                                    px={1}
                                  >
                                    {o}
                                  </Text>
                                </VStack>
                              </Box>
                            </Button>
                            <Box bg={theme.bar} py={2} textAlign="center">
                              <Text fontSize="xs" fontWeight="800" color="rgba(255,255,255,0.9)" letterSpacing="0.06em">
                                IZBERI
                              </Text>
                            </Box>
                          </Box>
                        );
                      })}
                    </SimpleGrid>

                    {showExplanation ? (
                      <Box
                        mt={5}
                        bg="white"
                        borderWidth="2px"
                        borderStyle="dashed"
                        borderColor={pickedIndex === current.correctIndex ? "green.300" : "orange.200"}
                        rounded="xl"
                        p={4}
                        boxShadow="0 10px 28px rgba(15, 23, 42, 0.06)"
                      >
                        <HStack justify="space-between" align="start" spacing={3} flexWrap="wrap">
                          <VStack align="start" spacing={2} flex="1" minW="200px">
                            <HStack spacing={2} flexWrap="wrap">
                              <Badge
                                colorScheme={pickedIndex === current.correctIndex ? "green" : "orange"}
                                rounded="full"
                                px={3}
                                py={1}
                              >
                                {pickedIndex === current.correctIndex ? "Bravo!" : "Ni panike"}
                              </Badge>
                              <Text fontSize="sm" color="gray.600">
                                Pravilno: <b>{current.options[current.correctIndex]}</b>
                              </Text>
                            </HStack>
                            <Text color="gray.800" fontWeight="700" lineHeight="tall">
                              {current.explanation}
                            </Text>
                          </VStack>
                          <Button
                            onClick={next}
                            rounded="full"
                            bg="gray.900"
                            color="white"
                            _hover={{ bg: "gray.800" }}
                            flexShrink={0}
                          >
                            Naprej
                          </Button>
                        </HStack>
                      </Box>
                    ) : null}
                  </>
                ) : (
                  <VStack align="stretch" spacing={5} pt={1}>
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
                      Tvoj rezultat · {score}/{total}
                    </Badge>
                    <Heading size={{ base: "lg", md: "xl" }} color="gray.900" lineHeight="1.15">
                      {result?.title}
                    </Heading>
                    <Text color="gray.700" fontSize={{ base: "md", md: "lg" }} lineHeight="tall">
                      {result?.description}
                    </Text>
                    <Box
                      bg="white"
                      borderWidth="2px"
                      borderStyle="dashed"
                      borderColor="blue.200"
                      rounded="xl"
                      p={4}
                      boxShadow="0 8px 24px rgba(37, 99, 235, 0.08)"
                    >
                      <HStack spacing={2} mb={2} color="blue.600">
                        <FaBaby />
                        <Text fontWeight="800" fontSize="sm">
                          Zate
                        </Text>
                      </HStack>
                      <Text color="gray.800" fontWeight="700" lineHeight="tall">
                        {result?.support}
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
        </Stack>
      </Container>
    </Box>
  );
}
