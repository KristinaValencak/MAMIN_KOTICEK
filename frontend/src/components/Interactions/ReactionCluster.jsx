import { Box, HStack, Text } from "@chakra-ui/react";

const BUBBLE = "20px";
const OVERLAP = "-7px";

export default function ReactionCluster({ emojis, empty = false }) {
  if (empty || !emojis?.length) {
    return (
      <Box
        w={BUBBLE}
        h={BUBBLE}
        borderRadius="full"
        borderWidth="1px"
        borderColor="gray.200"
        bg="gray.50"
        display="flex"
        alignItems="center"
        justifyContent="center"
        fontSize="11px"
        color="gray.400"
        lineHeight="1"
        flexShrink={0}
        aria-hidden
      >
        +
      </Box>
    );
  }

  const shown = emojis.slice(0, 8);
  const overlap = shown.length > 4 ? "-8px" : OVERLAP;
  const emojiSize = shown.length > 4 ? "11px" : "12px";

  return (
    <HStack spacing={0} flexShrink={0} aria-hidden>
      {shown.map((emoji, i) => (
        <Box
          key={`${emoji}-${i}`}
          ml={i === 0 ? 0 : overlap}
          zIndex={shown.length - i}
          w={BUBBLE}
          h={BUBBLE}
          borderRadius="full"
          bg="white"
          borderWidth="1px"
          borderColor="white"
          boxShadow="0 1px 3px rgba(15, 23, 42, 0.1)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize={emojiSize}
          lineHeight="1"
        >
          <Text as="span">{emoji}</Text>
        </Box>
      ))}
    </HStack>
  );
}
