import { Badge, Box, Button, Container, Heading, HStack, Image, Progress, SimpleGrid, Stack, Text, VStack } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { FaArrowLeft, FaRegLightbulb } from "react-icons/fa";
import { useMemo, useState } from "react";
import QUIZ from "./askQuiz.json";

import heroAskQuiz from "../../../assets/games/askQuiz.png";

function shuffleArray(input) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const LETTERS = ["A", "B", "C"];
const OPTION_THEME = [
  {
    circle: "linear-gradient(145deg, #FCD34D 0%, #F59E0B 55%, #D97706 100%)",
    circleBorder: "#B45309",
    bar: "#EA580C",
    barLight: "orange",
    shadow: "rgba(234, 88, 12, 0.35)",
  },
  {
    circle: "linear-gradient(145deg, #93C5FD 0%, #3B82F6 55%, #1D4ED8 100%)",
    circleBorder: "#1E40AF",
    bar: "#2563EB",
    barLight: "blue",
    shadow: "rgba(37, 99, 235, 0.35)",
  },
  {
    circle: "linear-gradient(145deg, #FCA5A5 0%, #EF4444 55%, #DC2626 100%)",
    circleBorder: "#991B1B",
    bar: "#E11D48",
    barLight: "red",
    shadow: "rgba(225, 29, 72, 0.35)",
  },
];

export default function AskQuiz() {
  const [idx, setIdx] = useState(0);
  const [pickedIndex, setPickedIndex] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [shuffleKey, setShuffleKey] = useState(0);

  const SESSION_SCENARIOS = 8;

  const scenarios = useMemo(() => shuffleArray(QUIZ.scenarios || []).slice(0, SESSION_SCENARIOS), [shuffleKey]);
  const total = scenarios.length;
  const done = idx >= total;
  const current = scenarios[Math.min(idx, total - 1)];
  const progress = Math.round(((Math.min(idx, total)) / total) * 100);

  const totalPercent = useMemo(() => {
    if (!current?.options?.length) return 100;
    const sum = current.options.reduce((s, o) => s + (Number(o.percentage) || 0), 0);
    return sum || 100;
  }, [current]);

  const pick = (optionIndex) => {
    if (revealed) return;
    setPickedIndex(optionIndex);
    setRevealed(true);
  };

  const next = () => {
    setIdx((v) => v + 1);
    setPickedIndex(null);
    setRevealed(false);
  };

  const reset = () => {
    setIdx(0);
    setPickedIndex(null);
    setRevealed(false);
    setShuffleKey((k) => k + 1);
  };

  const titleClean = String(QUIZ.title || "")
    .replace(/\s*[\u{1F300}-\u{1FAFF}]+\s*$/u, "")
    .trim();

  return (
    <Box
      w="100%"
      overflowX="hidden"
      bgGradient="linear(to-b, #FDF2F8 0%, #FFF7ED 40%, #ECFDF5 100%)"
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
                {total} scenarijev
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
              boxShadow="0 18px 48px rgba(190, 24, 93, 0.12), inset 0 1px 0 rgba(255,255,255,0.55)"
            >
              <Box position="relative" h={{ base: "140px", sm: "168px", md: "190px" }}>
                <Image
                  src={heroAskQuiz}
                  alt=""
                  w="100%"
                  h="100%"
                  objectFit="cover"
                  objectPosition="center top"
                  draggable={false}
                  filter={done ? "brightness(0.92)" : undefined}
                />
                <Box
                  position="absolute"
                  inset={0}
                  bgGradient="linear(to-t, rgba(131, 24, 67, 0.82) 0%, rgba(190, 24, 93, 0.28) 50%, transparent 100%)"
                  pointerEvents="none"
                />
                <Box position="absolute" bottom={0} left={0} right={0} h="3px" bg="#F9A8D4" />

                <VStack
                  position="absolute"
                  bottom={{ base: 3, md: 5 }}
                  left={{ base: 3, md: 6 }}
                  right={{ base: 3, md: 6 }}
                  spacing={2}
                  align="center"
                >
                  <Box
                    bg="linear-gradient(180deg, #F472B6 0%, #DB2777 100%)"
                    px={{ base: 5, md: 8 }}
                    py={{ base: 2, md: 2.5 }}
                    rounded="2xl"
                    boxShadow="0 10px 28px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.35)"
                    borderWidth="2px"
                    borderColor="rgba(255,255,255,0.45)"
                  >
                    <Text
                      fontSize={{ base: "lg", md: "xl" }}
                      fontWeight="900"
                      color="white"
                      textAlign="center"
                      lineHeight="1.2"
                      textShadow="0 2px 10px rgba(0,0,0,0.35)"
                      fontFamily="heading"
                    >
                      {titleClean || "Kaj bi naredila?"}
                    </Text>
                  </Box>
                  <Badge
                    bg="rgba(255,255,255,0.95)"
                    color="#9D174D"
                    px={3}
                    py={1}
                    rounded="full"
                    fontSize="xs"
                    fontWeight="800"
                    letterSpacing="0.04em"
                    boxShadow="0 4px 14px rgba(0,0,0,0.12)"
                  >
                    Resnične situacije
                  </Badge>
                </VStack>
              </Box>

              <Box
                bg="linear-gradient(180deg, #FFFBF5 0%, #FFF1F2 45%, #F0FDFA 130%)"
                px={{ base: 4, md: 6 }}
                py={{ base: 5, md: 6 }}
                borderTopWidth="1px"
                borderTopColor="rgba(251, 113, 133, 0.25)"
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
                          background: "linear-gradient(90deg, #F472B6 0%, #F59E0B 40%, #14B8A6 100%)",
                        },
                      }}
                      bg="rgba(255,255,255,0.75)"
                    />

                    <VStack align="stretch" spacing={4} mb={1}>
                      <HStack spacing={2} color="pink.700">
                        <FaRegLightbulb />
                        <Text fontWeight="800" fontSize="sm">
                          Scenarij {idx + 1} / {total}
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
                      <Text color="gray.600" fontSize="sm">
                        {QUIZ.description}
                      </Text>
                    </VStack>

                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} pt={2}>
                      {current.options.map((o, optionIndex) => {
                        const isPicked = pickedIndex === optionIndex;
                        const theme = OPTION_THEME[optionIndex] || OPTION_THEME[0];
                        const pct = Math.round(((Number(o.percentage) || 0) / totalPercent) * 100);
                        const letter = LETTERS[optionIndex] || String(optionIndex + 1);

                        return (
                          <Box
                            key={o.text}
                            rounded="2xl"
                            borderWidth="4px"
                            borderColor="white"
                            bg="rgba(255,255,255,0.92)"
                            overflow="hidden"
                            boxShadow={
                              isPicked && revealed
                                ? `0 16px 36px ${theme.shadow}`
                                : "0 12px 28px rgba(15, 23, 42, 0.1)"
                            }
                            transform={!revealed ? undefined : isPicked ? "scale(1.02)" : "scale(1)"}
                            transition="all 0.2s ease"
                            outline={isPicked && revealed ? "2px solid" : undefined}
                            outlineColor={isPicked && revealed ? theme.bar : "transparent"}
                            outlineOffset="2px"
                          >
                            <Button
                              onClick={() => pick(optionIndex)}
                              variant="ghost"
                              w="100%"
                              h="auto"
                              py={5}
                              px={3}
                              rounded="none"
                              isDisabled={revealed}
                              _hover={
                                revealed
                                  ? {}
                                  : {
                                    bg: "rgba(255,255,255,0.5)",
                                  }
                              }
                              _disabled={{ opacity: 1, cursor: "default" }}
                            >
                              <VStack spacing={3} w="100%">
                                <Box
                                  w="48px"
                                  h="48px"
                                  borderRadius="full"
                                  display="flex"
                                  alignItems="center"
                                  justifyContent="center"
                                  fontWeight="900"
                                  fontSize="xl"
                                  color="white"
                                  bg={theme.circle}
                                  borderWidth="3px"
                                  borderColor={theme.circleBorder}
                                  boxShadow={`0 6px 16px ${theme.shadow}`}
                                >
                                  {letter}
                                </Box>
                                <Text
                                  fontWeight="700"
                                  fontSize="sm"
                                  color="gray.800"
                                  textAlign="center"
                                  lineHeight="1.45"
                                >
                                  {o.text}
                                </Text>
                              </VStack>
                            </Button>

                            {revealed ? (
                              <Box>
                                <Box
                                  bg={theme.bar}
                                  color="white"
                                  py={2.5}
                                  textAlign="center"
                                  fontWeight="900"
                                  fontSize="lg"
                                  letterSpacing="0.02em"
                                  textShadow="0 1px 4px rgba(0,0,0,0.2)"
                                >
                                  {pct}%
                                </Box>
                                <Box px={3} pb={3} pt={2} bg="rgba(255,255,255,0.6)">
                                  <Progress
                                    value={pct}
                                    rounded="full"
                                    size="sm"
                                    colorScheme={theme.barLight}
                                    bg="gray.100"
                                  />
                                </Box>
                              </Box>
                            ) : (
                              <Box h="10px" bg="rgba(0,0,0,0.03)" aria-hidden />
                            )}
                          </Box>
                        );
                      })}
                    </SimpleGrid>

                    {revealed ? (
                      <HStack justify="flex-end" pt={5}>
                        <Button
                          onClick={next}
                          rounded="full"
                          bg="gray.900"
                          color="white"
                          _hover={{ bg: "gray.800" }}
                          px={8}
                        >
                          Naprej
                        </Button>
                      </HStack>
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
                      Konec kviza
                    </Badge>
                    <Heading size={{ base: "lg", md: "xl" }} color="gray.900" lineHeight="1.15">
                      {QUIZ.endingMessage?.title}
                    </Heading>
                    <Text color="gray.700" fontSize={{ base: "md", md: "lg" }} lineHeight="tall">
                      {QUIZ.endingMessage?.text}
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
                      <HStack spacing={3} align="start">
                        <Box
                          w="44px"
                          h="44px"
                          rounded="xl"
                          bg="linear-gradient(145deg, #F472B6, #DB2777)"
                          color="white"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          flexShrink={0}
                          boxShadow="0 8px 20px rgba(219, 39, 119, 0.35)"
                        >
                          <FaRegLightbulb />
                        </Box>
                        <Text color="gray.800" fontWeight="700" lineHeight="tall">
                          Mini ideja: izberi eno stvar, ki jo danes spustiš. In eno malo stvar, ki te napolni.
                        </Text>
                      </HStack>
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
