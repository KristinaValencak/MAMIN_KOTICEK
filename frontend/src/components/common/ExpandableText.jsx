import { useLayoutEffect, useRef, useState } from "react";
import { Box, Button } from "@chakra-ui/react";

export default function ExpandableText({
  text,
  maxLines = 6,
  whiteSpace = "pre-wrap",
  fontSize = "sm",
  lineHeight,
  color = "gray.800",
  buttonColorScheme = "pink",
  linkTone = "default",
  className,
}) {
  const bodyRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [measuredOverflow, setMeasuredOverflow] = useState(false);

  const safe = typeof text === "string" ? text : text == null ? "" : String(text);

  useLayoutEffect(() => {
    setExpanded(false);
  }, [safe]);

  useLayoutEffect(() => {
    if (!safe.trim()) {
      setMeasuredOverflow(false);
      return;
    }
    if (expanded) {
      return;
    }

    const el = bodyRef.current;
    if (!el) {
      setMeasuredOverflow(false);
      return;
    }

    const measure = () => {
      setMeasuredOverflow(el.scrollHeight > el.clientHeight + 1);
    };

    measure();
    const raf = requestAnimationFrame(() => measure());

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure()) : null;
    if (ro) ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [safe, expanded, maxLines]);

  const showControls = measuredOverflow || expanded;

  const clampSx = expanded
    ? undefined
    : {
        display: "-webkit-box",
        WebkitLineClamp: maxLines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      };

  if (!safe) return null;

  const linkSx =
    linkTone === "onPrimary"
      ? {
          color: "whiteAlpha.900",
          _hover: { color: "white", textDecoration: "underline" },
        }
      : undefined;

  return (
    <Box>
      <Box
        ref={bodyRef}
        className={className}
        fontSize={fontSize}
        lineHeight={lineHeight}
        color={color}
        whiteSpace={whiteSpace}
        overflowWrap="anywhere"
        wordBreak="break-word"
        maxW="100%"
        sx={clampSx}
        aria-expanded={showControls ? expanded : undefined}
      >
        {safe}
      </Box>
      {showControls ? (
        <Button
          type="button"
          mt={1}
          size="xs"
          variant="link"
          colorScheme={linkTone === "onPrimary" ? undefined : buttonColorScheme}
          sx={linkSx}
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Skrij del besedila" : "Prikaži celotno besedilo"}
        >
          {expanded ? "Prikaži manj" : "Prikaži več"}
        </Button>
      ) : null}
    </Box>
  );
}
