import { Box, HStack, Text } from "@chakra-ui/react";
import { useMemo } from "react";

const REACTIONS = [
  { type: "support", emoji: "💗", label: "Pošiljam podporo" },
  { type: "hug", emoji: "🤗", label: "Objem" },
  { type: "understand", emoji: "🌸", label: "Razumem te" },
  { type: "together", emoji: "🥰", label: "Nisi sama" },
];

function Pill({ children, active, onClick, disabled }) {
  return (
    <Box
      as="button"
      type="button"
      onClick={onClick}
      disabled={disabled}
      px={2.5}
      py={1.5}
      rounded="full"
      fontSize="xs"
      fontWeight="600"
      lineHeight="1"
      borderWidth="1px"
      borderColor={active ? "pink.300" : "gray.100"}
      bg={active ? "pink.100" : "white"}
      color={active ? "pink.800" : "gray.700"}
      boxShadow={
        active
          ? "0 18px 40px rgba(236, 95, 140, 0.22)"
          : "0 8px 18px rgba(15, 23, 42, 0.06)"
      }
      outline="none"
      _focusVisible={{ boxShadow: active ? "0 0 0 3px rgba(236, 95, 140, 0.28)" : "0 0 0 3px rgba(15, 23, 42, 0.10)" }}
      transition="transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease"
      _hover={disabled ? {} : { transform: "translateY(-1px)", boxShadow: "0 14px 30px rgba(15, 23, 42, 0.10)" }}
      _active={disabled ? {} : { transform: "translateY(0px) scale(0.98)" }}
      opacity={disabled ? 0.7 : 1}
    >
      {children}
    </Box>
  );
}

export default function ReactionPicker({
  likeCount = 0,
  isLiked = false,
  onLike,
  isLiking = false,
  counts,
  myReaction,
  onReact,
  isLoading,
  size = "xs",
}) {
  const items = useMemo(() => REACTIONS, []);
  const ordered = useMemo(() => {
    return items.map((r) => ({ ...r, count: counts?.[r.type] || 0 }));
  }, [counts, items]);

  const canLike = typeof onLike === "function";

  return (
    <HStack spacing={2} flexWrap="wrap" align="center">
      {canLike && (
        <Pill
          active={isLiked}
          disabled={Boolean(isLiking || isLoading)}
          onClick={(e) => {
            e?.stopPropagation?.();
            onLike?.(e);
          }}
        >
          <HStack spacing={1}>
            <Text as="span" fontSize={size}>
              👍
            </Text>
            <Text as="span">{likeCount}</Text>
          </HStack>
        </Pill>
      )}

      {ordered.map((r) => (
        <Pill
          key={r.type}
          active={myReaction === r.type}
          disabled={isLoading}
          onClick={(e) => {
            e?.stopPropagation?.();
            onReact?.(r.type, e);
          }}
        >
          <HStack spacing={1}>
            <Text as="span" fontSize={size}>
              {r.emoji}
            </Text>
            <Text as="span">{r.count}</Text>
          </HStack>
        </Pill>
      ))}
    </HStack>
  );
}
