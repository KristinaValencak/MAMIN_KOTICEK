import { Badge, Box, Button, Container, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaHeart } from "react-icons/fa";

import pacifierAssetUrl from "../../../assets/games/pacifier.svg";

const GAME_DURATION_MS = 30_000;
const START_LIVES = 2;
const ITEM = 66;
const INNER = 46;
const ICON = 30;
const BAD_EMOJIS = ["🍼", "🧸", "🪀", "🪥", "🧴"];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pickMessage(score, endReason) {
  if (endReason === "lives") {
    if (score >= 12) return "Tvoji refleksi so že zlati — samo še malo pazljivosti pri „tujih“ stvareh. Ponovno, ko ti paše. 💜";
    return "V redu je. Dude hitijo, ostalo pa zna zavajati — naslednjič gre še bolj gladko. ✨";
  }
  if (score >= 25) return "Čisto ogenj — take reflekse si zaslužiš! 🏆";
  if (score >= 15) return "Odlično! Kot bi dude znale, da pridejo ravno k tebi. 👏";
  if (score >= 8) return "Lepo si jih ujela — naslednjič še ena runda miru. 💛";
  return "Tudi to šteje kot minuta zase. Naslednjič spet z nasmehom. 😄";
}

function GameSkyBackground() {
  const starLayers = useMemo(
    () =>
      Array.from({ length: 42 }, () => {
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const r = 0.6 + Math.random() * 1.4;
        const o = 0.12 + Math.random() * 0.35;
        return `radial-gradient(${r}px ${r}px at ${x}% ${y}%, rgba(255,255,255,${o}), transparent)`;
      }).join(", "),
    []
  );

  const bokehLayers = useMemo(
    () =>
      Array.from({ length: 12 }, () => {
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const sz = 56 + Math.random() * 120;
        const c =
          Math.random() > 0.5
            ? `rgba(147, 197, 253, ${0.18 + Math.random() * 0.22})`
            : `rgba(251, 207, 232, ${0.16 + Math.random() * 0.2})`;
        return `radial-gradient(${sz}px ${sz}px at ${x}% ${y}%, ${c}, transparent)`;
      }).join(", "),
    []
  );

  const base =
    "linear-gradient(168deg, #E0F2FE 0%, #BAE6FD 22%, #93C5FD 48%, #BFDBFE 72%, #EFF6FF 100%)";

  return (
    <Box
      aria-hidden
      position="absolute"
      inset={0}
      zIndex={0}
      pointerEvents="none"
      overflow="hidden"
      borderRadius="inherit"
      sx={{
        background: `${starLayers}, ${bokehLayers}, ${base}`,
      }}
    >
      <Box
        position="absolute"
        inset={0}
        bg="radial-gradient(ellipse 90% 55% at 50% -5%, rgba(255,255,255,0.75) 0%, transparent 55%)"
        pointerEvents="none"
      />
      <Box
        position="absolute"
        bottom="-22%"
        left="-18%"
        right="-18%"
        height="62%"
        opacity={0.5}
        bg="radial-gradient(ellipse 85% 75% at 50% 0%, rgba(255, 228, 230, 0.55), rgba(254, 243, 199, 0.25), transparent)"
        filter="blur(10px)"
      />
      <Box
        position="absolute"
        bottom="0"
        left="0"
        right="0"
        h="28%"
        opacity={0.35}
        bg="linear-gradient(to top, rgba(255,255,255,0.5), transparent)"
        pointerEvents="none"
      />
    </Box>
  );
}

export default function CatchPacifier() {
  const [status, setStatus] = useState("idle"); // idle | running | ended
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_DURATION_MS);
  const [endReason, setEndReason] = useState(null); // null | 'time' | 'lives'

  const fieldRef = useRef(null);

  const rafIdRef = useRef(null);
  const runningRef = useRef(false);
  const itemsRef = useRef([]);
  const lastTsRef = useRef(0);
  const startTsRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const nextIdRef = useRef(1);
  const tickTimerRef = useRef(null);
  const endGameRef = useRef(null);
  /** Sinhrono s prikazom; funkcijski setLives v React 18 Strict Mode lahko updater pokliče 2× → napačno −2 življenji na en klik. */
  const livesRef = useRef(START_LIVES);
  const scoreRef = useRef(0);

  const resultText = useMemo(() => pickMessage(score, endReason), [score, endReason]);

  const cleanupDomItems = () => {
    for (const it of itemsRef.current) {
      try {
        it.el?.remove();
      } catch {
        // ignore
      }
    }
    itemsRef.current = [];
  };

  const stopGame = () => {
    runningRef.current = false;
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = null;
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    tickTimerRef.current = null;
  };

  const finishGame = (reason) => {
    if (!runningRef.current) return;
    stopGame();
    if (reason === "time") setTimeLeftMs(0);
    setEndReason(reason);
    setStatus("ended");
    cleanupDomItems();
  };

  endGameRef.current = finishGame;

  const spawnItem = (fieldEl, fieldW, kind) => {
    const el = document.createElement("button");
    el.type = "button";
    const id = nextIdRef.current++;
    const isGood = kind === "good";

    el.setAttribute("aria-label", isGood ? "Ujemi dudo" : "Ne klikaj — izogibaj se");
    el.style.position = "absolute";
    el.style.top = "0px";
    el.style.left = "0px";
    el.style.border = "0";
    el.style.background = "rgba(255,255,255,0.38)";
    el.style.padding = "0";
    el.style.margin = "0";
    el.style.cursor = "pointer";
    el.style.touchAction = "none";
    el.style.userSelect = "none";
    el.style.webkitTapHighlightColor = "transparent";
    el.style.boxSizing = "border-box";
    el.style.transform = "translate3d(0,0,0)";
    el.style.willChange = "transform";
    el.style.width = `${ITEM}px`;
    el.style.height = `${ITEM}px`;
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.borderRadius = "999px";
    el.style.boxShadow =
      "0 6px 18px rgba(15, 23, 42, 0.14), 0 0 0 3px rgba(255,255,255,0.92), inset 0 1px 0 rgba(255,255,255,0.65)";
    el.style.backdropFilter = "blur(10px)";
    el.style.webkitBackdropFilter = "blur(10px)";
    el.style.transition = "transform 120ms ease, filter 120ms ease, opacity 200ms ease";
    el.style.zIndex = "2";

    const inner = document.createElement("div");
    inner.style.width = `${INNER}px`;
    inner.style.height = `${INNER}px`;
    inner.style.borderRadius = "50%";
    inner.style.display = "flex";
    inner.style.alignItems = "center";
    inner.style.justifyContent = "center";
    inner.style.flexShrink = "0";
    inner.style.background = "rgba(255,255,255,0.82)";
    inner.style.boxShadow = "inset 0 2px 8px rgba(255,255,255,1), 0 1px 3px rgba(15,23,42,0.08)";
    inner.style.pointerEvents = "none";

    if (isGood) {
      const img = document.createElement("img");
      img.src = pacifierAssetUrl;
      img.alt = "";
      img.setAttribute("draggable", "false");
      img.style.width = `${ICON}px`;
      img.style.height = `${ICON}px`;
      img.style.objectFit = "contain";
      img.style.pointerEvents = "none";
      img.style.display = "block";
      inner.appendChild(img);
    } else {
      inner.style.fontSize = `${ICON}px`;
      inner.style.lineHeight = "1";
      inner.textContent = BAD_EMOJIS[Math.floor(Math.random() * BAD_EMOJIS.length)];
    }
    el.appendChild(inner);

    const x = Math.random() * Math.max(8, fieldW - ITEM);
    const y = -ITEM - 10;
    const speed = 260 + Math.random() * 280;

    const item = { id, x, y, speed, el, kind };
    itemsRef.current.push(item);

    let consumed = false;
    const onPointer = (ev) => {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (!runningRef.current || consumed) return;
      consumed = true;

      try {
        if (typeof ev.pointerId === "number") el.setPointerCapture(ev.pointerId);
      } catch {
        // nekateri brskalniki / okolja
      }

      if (isGood) {
        el.style.transform = `translate3d(${x}px, ${Math.max(-20, y)}px, 0) scale(1.2)`;
        el.style.filter = "brightness(1.15)";
        scoreRef.current += 1;
        setScore(scoreRef.current);
        requestAnimationFrame(() => {
          itemsRef.current = itemsRef.current.filter((t) => t.id !== id);
          el.remove();
        });
      } else {
        el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(0.85)`;
        el.style.opacity = "0.5";
        el.style.filter = "brightness(0.7)";
        const next = Math.max(0, livesRef.current - 1);
        livesRef.current = next;
        setLives(next);
        requestAnimationFrame(() => {
          itemsRef.current = itemsRef.current.filter((t) => t.id !== id);
          el.remove();
        });
        if (next <= 0) {
          endGameRef.current?.("lives");
        }
      }
    };

    el.addEventListener("pointerdown", onPointer, { passive: false, capture: true });
    fieldEl.appendChild(el);
  };

  const frame = (ts) => {
    if (!runningRef.current) return;

    const fieldEl = fieldRef.current;
    if (!fieldEl) return;

    const rect = fieldEl.getBoundingClientRect();
    const fieldW = rect.width;
    const fieldH = rect.height;

    if (!startTsRef.current) startTsRef.current = ts;
    if (!lastTsRef.current) lastTsRef.current = ts;

    const dt = clamp((ts - lastTsRef.current) / 1000, 0, 0.05);
    lastTsRef.current = ts;

    const elapsed = ts - startTsRef.current;
    const spawnEvery = Math.max(140, 460 - Math.floor(elapsed / 5000) * 50);
    if (ts - lastSpawnRef.current >= spawnEvery) {
      lastSpawnRef.current = ts;
      const roll = Math.random();
      const kind = roll < 0.46 ? "good" : "bad";
      spawnItem(fieldEl, fieldW, kind);
    }

    const items = itemsRef.current;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      it.y += it.speed * dt;
      it.el.style.transform = `translate3d(${it.x}px, ${it.y}px, 0)`;
    }

    if (items.length) {
      const keep = [];
      for (const it of items) {
        if (it.y <= fieldH + 80) keep.push(it);
        else it.el.remove();
      }
      if (keep.length !== items.length) itemsRef.current = keep;
    }

    if (elapsed >= GAME_DURATION_MS) {
      finishGame("time");
      return;
    }

    rafIdRef.current = requestAnimationFrame(frame);
  };

  const start = () => {
    cleanupDomItems();
    stopGame();

    scoreRef.current = 0;
    setScore(0);
    livesRef.current = START_LIVES;
    setLives(START_LIVES);
    setTimeLeftMs(GAME_DURATION_MS);
    setEndReason(null);
    setStatus("running");

    runningRef.current = true;
    startTsRef.current = 0;
    lastTsRef.current = 0;
    lastSpawnRef.current = 0;

    tickTimerRef.current = setInterval(() => {
      if (!runningRef.current) return;
      const now = performance.now();
      const startTs = startTsRef.current || now;
      const left = Math.max(0, GAME_DURATION_MS - (now - startTs));
      setTimeLeftMs(left);
    }, 200);

    rafIdRef.current = requestAnimationFrame(frame);
  };

  const exitToEnd = () => {
    stopGame();
    cleanupDomItems();
    setTimeLeftMs(0);
    setEndReason("time");
    setStatus("ended");
  };

  useEffect(() => {
    return () => {
      stopGame();
      cleanupDomItems();
    };
  }, []);

  const secondsLeft = Math.ceil(timeLeftMs / 1000);

  return (
    <Box
      w="100%"
      bgGradient="linear(to-b, #F0F9FF 0%, #E0F2FE 30%, #FDF4FF 70%, #FFF1F2 100%)"
    >
      <Container maxW="6xl" pt={{ base: 10, md: 14 }} pb={{ base: 20, md: 24 }} px={{ base: 4, md: 6 }}>
        <Stack spacing={6}>
          <HStack justify="space-between" align="center">
            <Button as={RouterLink} to="/sprostitev-za-mamo" leftIcon={<FaArrowLeft />} variant="ghost" rounded="full">
              Nazaj
            </Button>
            <HStack spacing={3} minW={0}>
              <Text fontSize="lg" fontWeight="900" color="gray.800">
                Ujemi dudo
              </Text>
            </HStack>
            <Box w="72px" />
          </HStack>

          <Box
            bg="rgba(255,255,255,0.92)"
            backdropFilter="blur(8px)"
            rounded="2xl"
            borderWidth="1px"
            borderColor="rgba(186, 230, 253, 0.9)"
            p={{ base: 4, md: 6 }}
            boxShadow="0 16px 40px rgba(59, 130, 246, 0.08), 0 1px 0 rgba(255,255,255,0.9) inset"
          >
            <HStack justify="space-between" mb={4} flexWrap="wrap" gap={2}>
              <HStack spacing={3} flexWrap="wrap">
                <Badge colorScheme="pink" rounded="full" px={3} py={1} fontSize="sm" variant="subtle">
                  Točke: {score}
                </Badge>
                <Badge
                  colorScheme={secondsLeft <= 5 ? "red" : "blue"}
                  rounded="full"
                  px={3}
                  py={1}
                  fontSize="sm"
                  variant="subtle"
                >
                  Čas: {status === "running" ? secondsLeft : 30}s
                </Badge>
                <HStack spacing={1} px={3} py={1} rounded="full" bg="pink.50" borderWidth="1px" borderColor="pink.100">
                  {Array.from({ length: START_LIVES }).map((_, i) => (
                    <FaHeart
                      key={i}
                      size={14}
                      color={i < lives ? "#EC5F8C" : "#CBD5E0"}
                      style={{ transition: "color 0.2s ease" }}
                    />
                  ))}
                </HStack>
              </HStack>
              {status === "running" ? (
                <Button size="sm" variant="outline" rounded="full" borderColor="blue.200" onClick={exitToEnd}>
                  Končaj
                </Button>
              ) : null}
            </HStack>

            <Box
              ref={fieldRef}
              position="relative"
              rounded="2xl"
              borderWidth="2px"
              borderColor="rgba(255,255,255,0.85)"
              overflow="hidden"
              minH={{ base: "56vh", md: "60vh" }}
              boxShadow="0 20px 48px rgba(59, 130, 246, 0.12), 0 8px 24px rgba(236, 95, 140, 0.08), inset 0 1px 0 rgba(255,255,255,0.95)"
              onContextMenu={(e) => e.preventDefault()}
              sx={{
                touchAction: "none",
                WebkitTouchCallout: "none",
              }}
            >
              <GameSkyBackground />

              {status !== "running" ? (
                <Box
                  position="absolute"
                  inset={0}
                  zIndex={3}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  p={6}
                  bg="rgba(240, 249, 255, 0.65)"
                  backdropFilter="blur(8px)"
                >
                  <Box
                    textAlign="center"
                    maxW="440px"
                    bg="linear-gradient(180deg, #FFFFFF 0%, #FFF7FB 100%)"
                    rounded="2xl"
                    px={{ base: 6, md: 8 }}
                    py={{ base: 6, md: 8 }}
                    borderWidth="1px"
                    borderColor="pink.100"
                    boxShadow="0 20px 50px rgba(236, 95, 140, 0.12), 0 0 0 1px rgba(255,255,255,0.8) inset"
                  >
                    <Text fontSize="sm" fontWeight="700" color="pink.500" letterSpacing="0.04em" textTransform="uppercase">
                      {status === "ended" ? "Konec runde" : "Mini oddih"}
                    </Text>
                    <Heading size={{ base: "md", md: "lg" }} color="gray.900" mt={2}>
                      {status === "ended"
                        ? endReason === "lives"
                          ? "Ups — preveč napak"
                          : `Super, ${score} dude!`
                        : "Pripravljena na minutko zase?"}
                    </Heading>
                    <Text mt={3} color="gray.600" fontSize="sm" lineHeight="tall">
                      {status === "ended"
                        ? resultText
                        : "Samo dude s sliko so „prave“. Ostalo pusti pri miru — vsak napačen klik vzame en srček. Imaš dve priložnosti."}
                    </Text>
                    <HStack mt={5} justify="center" spacing={3} flexWrap="wrap">
                      <Button
                        onClick={start}
                        rounded="full"
                        bg="brand.500"
                        color="white"
                        _hover={{ bg: "brand.600" }}
                        boxShadow="0 8px 22px rgba(236, 95, 140, 0.35)"
                      >
                        {status === "ended" ? "Igraj znova" : "Začni"}
                      </Button>
                    </HStack>
                  </Box>
                </Box>
              ) : null}
            </Box>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
