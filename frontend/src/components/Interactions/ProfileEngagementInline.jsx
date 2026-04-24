import { HStack, Text } from "@chakra-ui/react";
import { FaComment } from "react-icons/fa";
import { useMemo } from "react";
import ReactionCluster from "./ReactionCluster";
import { topReactionClusterEmojis, totalReactionInstances } from "../../utils/supportReactionUi";

export default function ProfileEngagementInline({
  likeCount = 0,
  commentCount,
  supportCounts,
  fontSize = "sm",
  ...rest
}) {
  const total = useMemo(
    () => totalReactionInstances(supportCounts, likeCount),
    [supportCounts, likeCount]
  );
  const clusterEmojis = useMemo(
    () => topReactionClusterEmojis(supportCounts, likeCount, { max: 5 }),
    [supportCounts, likeCount]
  );
  const iconSize = fontSize === "xs" ? 12 : fontSize === "sm" ? 13 : 14;

  return (
    <HStack
      spacing={3}
      fontSize={fontSize}
      color="gray.600"
      flexWrap="wrap"
      align="center"
      justify="flex-end"
      pointerEvents="none"
      userSelect="none"
      cursor="default"
      aria-label={`Reakcije: ${total}. Samo ogled.`}
      {...rest}
    >
      <HStack spacing={2} align="center">
        <ReactionCluster emojis={clusterEmojis} empty={total === 0} />
        <Text as="span" fontWeight="600" color="gray.600" fontSize="xs">
          {total}
        </Text>
      </HStack>

      {commentCount !== undefined && commentCount !== null ? (
        <HStack spacing={1} color="gray.500" align="center" fontSize="xs">
          <FaComment size={iconSize} aria-hidden />
          <Text as="span" fontWeight="600">
            {commentCount ?? 0}
          </Text>
        </HStack>
      ) : null}
    </HStack>
  );
}
