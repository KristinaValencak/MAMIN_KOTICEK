import { Box, Container, Heading, HStack, Icon, Image, SimpleGrid, Stack, Text, VStack } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { FaArrowRight, FaChevronRight, FaDownload } from "react-icons/fa";
import { useCallback } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { useAuthGate } from "../../context/AuthGateContext.jsx";
import { getStoredUser } from "../../utils/helpers.js";

import imgMamaQuiz from "../../assets/games/mamaQuiz.png";
import imgAgeQuiz from "../../assets/games/ageQuiz.png";
import imgAskQuiz from "../../assets/games/askQuiz.png";
import imgCatchPacifier from "../../assets/games/catchPacifier.png";
import coverNosecnost from "../../assets/downloads-covers/Pregnancy.webp";
import coverFirstWeeks from "../../assets/downloads-covers/FirstWeeks.webp";
import coverChecklist from "../../assets/downloads-covers/Checklist.webp";

const GAMES = [
  {
    image: imgMamaQuiz,
    title: "Kakšna mama si danes?",
    description: "Šest hitrih vprašanj in nežen rezultat — brez sodbe, samo nasmeh.",
    to: "/sprostitev-za-mamo/kaksna-mama-si-danes",
    accent: "#EC5F8C",
    accentSoft: "rgba(236, 95, 140, 0.12)",
  },
  {
    image: imgAgeQuiz,
    title: "Ugani starost otroka",
    description: "Mejniki v mesecih: zabavno, kratko in malo poučno v eni minuti.",
    to: "/sprostitev-za-mamo/ugani-starost-otroka",
    accent: "#805AD5",
    accentSoft: "rgba(128, 90, 213, 0.12)",
  },
  {
    image: imgAskQuiz,
    title: "Kaj bi naredila",
    description: "Mini scenariji, ti izbereš — nato kratka misel, ki ostane s tabo.",
    to: "/sprostitev-za-mamo/kaj-bi-naredila",
    accent: "#319795",
    accentSoft: "rgba(49, 151, 149, 0.12)",
  },
  {
    image: imgCatchPacifier,
    title: "Ujemi dudo",
    description: "Trideset sekund hitrega fokusa. Ujemi čim več — in dihni.",
    to: "/sprostitev-za-mamo/ujemi-dudo",
    accent: "#DD6B20",
    accentSoft: "rgba(221, 107, 32, 0.14)",
  },
];

const DOWNLOADS = [
  {
    title: "Najpomembnejše stvari v nosečnosti",
    toastName: "Najpomembnejše stvari v nosečnosti (PDF)",
    description: "Ključne stvari v nosečnosti na enem mestu.",
    gradient: "linear(to-r, #EC5F8C, #F48FB1)",
    soft: "rgba(236, 95, 140, 0.12)",
    downloadUrl: import.meta.env.VITE_MOM_DOWNLOAD_PREGNANCY_LIST_DOWNLOAD_URL,
    cover: coverNosecnost,
  },
  {
    title: "Prvih 14 dni z dojenčkom",
    toastName: "Prvih 14 dni z dojenčkom (PDF)",
    description: "Dnevni planer & spremljanje (0–14 dni)",
    gradient: "linear(to-r, #D53F8C, #ED64A6)",
    soft: "rgba(213, 63, 140, 0.12)",
    downloadUrl: import.meta.env.VITE_MOM_DOWNLOAD_FIRST_WEEKS_DOWNLOAD_URL,
    cover: coverFirstWeeks,
  },
  {
    title: "Checklist za porodnišnico",
    toastName: "Checklist za porodnišnico (PDF)",
    description: "Seznam za lažjo pripravo na porodnišnico.",
    gradient: "linear(to-r, #667EEA, #63B3ED)",
    soft: "rgba(99, 179, 237, 0.14)",
    downloadUrl: "/downloads/Checklist za porodnišnico.pdf",
    cover: coverChecklist,
  },
];

function normalizeUrl(value) {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? s : null;
}

function resolvePdfUrl(raw) {
  const s0 = normalizeUrl(raw);
  if (!s0) return null;

  let s = s0.replaceAll("\\", "/");
  const publicMarker = "/public/";
  const idx = s.toLowerCase().indexOf(publicMarker);
  if (idx !== -1) {
    s = s.slice(idx + publicMarker.length - 1); // obdrži začetni '/'
  }
  if (s.toLowerCase().startsWith("frontend/public/")) {
    s = "/" + s.slice("frontend/public/".length);
  }
  if (s.toLowerCase().startsWith("public/")) {
    s = "/" + s.slice("public/".length);
  }
  if (!/^https?:\/\//i.test(s) && !s.startsWith("/")) {
    s = "/" + s;
  }

  try {
    // URL() poskrbi za pravilno enkodiranje (npr. Nosečnost.pdf -> Nose%C4%8Dnost.pdf).
    return new URL(s, window.location.origin).href;
  } catch {
    return null;
  }
}

function triggerBrowserDownload(href, filename) {
  if (!href) return false;
  try {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename || "";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  }
}

function GameCard({ image, title, description, to, accent, accentSoft }) {
  return (
    <Box
      as={RouterLink}
      to={to}
      role="group"
      position="relative"
      overflow="visible"
      textDecoration="none"
      display="block"
      _hover={{
        "& .game-card-panel": {
          boxShadow: "0 28px 56px rgba(15, 23, 42, 0.12)",
          borderColor: "gray.200",
        },
      }}
      transition="color 0.2s ease"
    >
      <Box
        className="game-card-panel"
        position="relative"
        overflow="visible"
        rounded="2xl"
        bg="white"
        borderWidth="1px"
        borderColor="gray.100"
        boxShadow="0 16px 44px rgba(15, 23, 42, 0.07)"
        transition="all 0.28s cubic-bezier(0.4, 0, 0.2, 1)"
      >
        {/* Glow naj ne “uide” iz kartice (da se ne vidi rob/blur sekcije) */}
        <Box position="absolute" inset={0} overflow="hidden" rounded="2xl" pointerEvents="none" zIndex={0}>
          <Box
            className="game-card-glow"
            position="absolute"
            inset="-35% -20% auto -20%"
            h="140%"
            bg={`radial-gradient(ellipse 80% 60% at 50% 0%, ${accentSoft} 0%, transparent 65%)`}
            opacity={0.55}
            transition="opacity 0.28s ease"
          />
        </Box>

        {/* Slika znotraj iste kartice, neposredno nad besedilom (brez vmesnega presledka) */}
        <Box
          position="relative"
          zIndex={1}
          overflow="visible"
          px={{ base: 3, md: 4 }}
          pt={{ base: 2, md: 3 }}
          pb={0}
          display="flex"
          alignItems="flex-start"
          justifyContent="center"
        >
          <Image
            src={image}
            alt=""
            w="full"
            maxW="100%"
            h="auto"
            maxH={{ base: "188px", sm: "208px", md: "228px" }}
            objectFit="contain"
            objectPosition="center top"
            mx="auto"
            display="block"
            draggable={false}
            sx={{
              filter: "drop-shadow(0 12px 24px rgba(15, 23, 42, 0.08))",
            }}
          />
        </Box>

        <VStack
          align="stretch"
          spacing={3}
          px={{ base: 5, md: 6 }}
          pt={3}
          pb={{ base: 5, md: 6 }}
          position="relative"
          zIndex={1}
        >
          <Box h="3px" w="40px" rounded="full" bg={accent} />
          <Heading as="h3" size="sm" color="gray.900" lineHeight="1.25" fontWeight="800" noOfLines={2}>
            {title}
          </Heading>
          <Text color="gray.600" fontSize="sm" lineHeight="1.65">
            {description}
          </Text>
          <HStack spacing={2} color={accent} fontWeight="700" fontSize="sm" letterSpacing="0.02em" pt={1}>
            <Text>Začni</Text>
            <Box
              as="span"
              display="inline-flex"
            >
              <FaArrowRight size={14} />
            </Box>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
}

function DownloadCard({ cover, title, description, gradient, soft, onDownload }) {
  return (
    <Box
      role="group"
      position="relative"
      overflow="visible"
      textDecoration="none"
      display="block"
      _hover={{
        "& .download-card-panel": {
          boxShadow: "0 28px 56px rgba(15, 23, 42, 0.12)",
          borderColor: "gray.200",
        },
      }}
      transition="color 0.2s ease"
    >
      <Box
        className="download-card-panel"
        position="relative"
        overflow="visible"
        rounded="2xl"
        bg="white"
        borderWidth="1px"
        borderColor="gray.100"
        boxShadow="0 16px 44px rgba(15, 23, 42, 0.07)"
        transition="all 0.28s cubic-bezier(0.4, 0, 0.2, 1)"
      >
        <Box position="absolute" inset={0} overflow="hidden" rounded="2xl" pointerEvents="none" zIndex={0}>
          <Box
            className="download-card-glow"
            position="absolute"
            inset="-35% -20% auto -20%"
            h="140%"
            bg={`radial-gradient(ellipse 80% 60% at 50% 0%, ${soft} 0%, transparent 65%)`}
            opacity={0.55}
            transition="opacity 0.28s ease"
          />
        </Box>

        {/* Slika znotraj iste kartice (enako kot igre), z zaobljenimi robovi */}
        <Box
          position="relative"
          zIndex={1}
          overflow="visible"
          px={{ base: 3, md: 4 }}
          pt={{ base: 2, md: 3 }}
          pb={0}
          display="flex"
          alignItems="flex-start"
          justifyContent="center"
        >
          <Box w="full" rounded="2xl" overflow="hidden">
            {cover ? (
              <Image
                src={cover}
                alt=""
                w="full"
                maxW="100%"
                h="auto"
                maxH={{ base: "188px", sm: "208px", md: "228px" }}
                objectFit="contain"
                objectPosition="center top"
                mx="auto"
                display="block"
                draggable={false}
                loading="lazy"
                sx={{
                  filter: "drop-shadow(0 12px 24px rgba(15, 23, 42, 0.08))",
                }}
              />
            ) : (
              <Box
                w="full"
                h={{ base: "188px", sm: "208px", md: "228px" }}
                rounded="2xl"
                bg="rgba(15, 23, 42, 0.04)"
                borderWidth="1px"
                borderColor="rgba(15, 23, 42, 0.06)"
                display="flex"
                alignItems="center"
                justifyContent="center"
                color="gray.500"
              >
                <Icon as={FaDownload} boxSize={7} />
              </Box>
            )}
          </Box>
        </Box>

        <VStack
          align="stretch"
          spacing={3}
          px={{ base: 5, md: 6 }}
          pt={3}
          pb={{ base: 5, md: 6 }}
          position="relative"
          zIndex={1}
        >
          <Box h="3px" w="40px" rounded="full" bgGradient={gradient} />
          <Heading
            as="h3"
            size="sm"
            color="gray.900"
            lineHeight="1.25"
            fontWeight="800"
            noOfLines={2}
          >
            {title}
          </Heading>
          <Text color="gray.600" fontSize="sm" lineHeight="1.65">
            {description}
          </Text>

          <HStack spacing={2} color="pink.600" fontWeight="700" fontSize="sm" letterSpacing="0.02em" pt={1}>
            <HStack as="button" type="button" spacing={2} onClick={onDownload} style={{ cursor: "pointer" }}>
              <Icon as={FaDownload} boxSize={4} />
              <Text>Prenesi</Text>
            </HStack>
            <Box as="span" display="inline-flex">
              <FaChevronRight size={14} />
            </Box>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
}

export default function LeisureLanding() {
  const { toast } = useAppToast();
  const { requestAuth } = useAuthGate();

  const handleDownload = useCallback(
    async (d) => {
      if (!getStoredUser()) {
        requestAuth({ tab: "login", reason: "Za prenos moraš biti prijavljena." });
        return;
      }

      const href = resolvePdfUrl(d?.downloadUrl);
      if (!href) {
        toast({
          title: "Prenos ni na voljo",
          description: "Ta PDF ni pravilno nastavljen. Preveri `.env` in pot do datoteke v `frontend/public/downloads/`.",
          status: "info",
          duration: 3500,
          isClosable: true,
        });
        return;
      }

      const safeBase = String(d?.title || "prenos")
        .trim()
        .toLowerCase()
        .replaceAll("š", "s")
        .replaceAll("č", "c")
        .replaceAll("ž", "z")
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replaceAll(/^-+|-+$/g, "");
      const filename = `${safeBase || "prenos"}.pdf`;

      try {
        const u = new URL(href);
        // Same-origin: najbolj zanesljivo je native download link (brez fetch → brez “HTML namesto PDF”).
        if (u.origin === window.location.origin) {
          if (!triggerBrowserDownload(u.href, filename)) {
            window.location.assign(u.href);
          }
          return;
        }
        // Cross-origin: download atribut je pogosto ignoriran → odpremo v novem zavihku.
        window.location.assign(u.href);
      } catch {
        window.location.assign(href);
      }
    },
    [requestAuth, toast]
  );

  return (
    <Box w="100%" bgGradient="linear(to-b, #FFF8FB 0%, #FFFFFF 38%, #F4F8FF 100%)">
      <Box position="relative">
        <Box
          position="absolute"
          top="-12%"
          right="-8%"
          w="min(520px, 90vw)"
          h="min(520px, 90vw)"
          rounded="full"
          bg="radial-gradient(circle, rgba(236, 95, 140, 0.14) 0%, transparent 68%)"
          pointerEvents="none"
        />
        <Box
          position="absolute"
          bottom="-18%"
          left="-10%"
          w="min(480px, 85vw)"
          h="min(480px, 85vw)"
          rounded="full"
          bg="radial-gradient(circle, rgba(102, 126, 234, 0.12) 0%, transparent 70%)"
          pointerEvents="none"
        />
      </Box>

      <Container maxW="7xl" pt={{ base: 10, md: 14 }} pb={{ base: 20, md: 24 }} px={{ base: 4, md: 6 }}>
        <Stack spacing={{ base: 12, md: 14 }}>
          <Stack spacing={4} maxW="3xl">
            <Heading
              as="h1"
              fontSize={{ base: "2xl", md: "3xl" }}
              color="gray.900"
              lineHeight="1.12"
              fontWeight="800"
              letterSpacing="-0.02em"
            >
              Par minut samo zate
            </Heading>
            <Text color="gray.600" fontSize={{ base: "md", md: "lg" }} lineHeight="tall" maxW="2xl">
              Brez pravil, brez pritiska — samo kratek odklop, nasmeh in nekaj minut miru. Izberi igro in začni, ko ti paše.
            </Text>
          </Stack>

          <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={{ base: 6, md: 8, xl: 10 }}>
            {GAMES.map((g) => (
              <GameCard key={g.to} {...g} />
            ))}
          </SimpleGrid>

          <Stack spacing={{ base: 6, md: 7 }} pt={{ base: 6, md: 8 }} w="full">
            <Stack spacing={4} maxW="3xl">
              <Heading
                as="h2"
                fontSize={{ base: "2xl", md: "3xl" }}
                color="gray.900"
                lineHeight="1.12"
                fontWeight="800"
                letterSpacing="-0.02em"
              >
                Mali pomočniki za mame
              </Heading>
              <Text color="gray.600" fontSize={{ base: "md", md: "lg" }} lineHeight="tall" maxW="2xl">
                Preprosti planerji, seznami in ideje, ki ti pomagajo imeti manj v glavi in več pod kontrolo. Prenesi, shrani ali natisni — in si malo
                olajšaj vsakdan.
              </Text>
            </Stack>

            <SimpleGrid
              columns={{ base: 1, sm: 2, xl: 4 }}
              spacing={{ base: 6, md: 8, xl: 10 }}
              w="full"
              alignItems="stretch"
              justifyItems="stretch"
            >
              {DOWNLOADS.map((d) => (
                <DownloadCard
                  key={d.toastName}
                  cover={d.cover}
                  title={d.title}
                  description={d.description}
                  gradient={d.gradient}
                  soft={d.soft}
                  onDownload={() => handleDownload(d)}
                />
              ))}
            </SimpleGrid>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
