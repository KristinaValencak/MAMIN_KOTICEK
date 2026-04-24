import { HStack, Text, useDisclosure } from "@chakra-ui/react";
import { FaComment } from "react-icons/fa";
import { useEffect, useMemo, useCallback } from "react";
import ReactionCluster from "./ReactionCluster";
import SupportReactionsModal from "./SupportReactionsModal";
import { topReactionClusterEmojis, totalReactionInstances, weightedSupportScore } from "../../utils/supportReactionUi";

export default function ForumReactionSummary({
  likeCount = 0,
  isLiked = false,
  onLike,
  isLiking = false,
  counts,
  myReaction,
  onReact,
  reactingSupport = false,
  reactors = [],
  reloadSupport,
  commentCount = 0,
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const canLike = typeof onLike === "function";

  useEffect(() => {
    if (isOpen && reloadSupport) {
      reloadSupport();
    }
  }, [isOpen, reloadSupport]);

  const totalReactions = useMemo(
    () => totalReactionInstances(counts, likeCount),
    [counts, likeCount]
  );
  const supportScore = useMemo(() => weightedSupportScore(counts), [counts]);
  const clusterEmojis = useMemo(
    () => topReactionClusterEmojis(counts, likeCount, { max: 5 }),
    [counts, likeCount]
  );

  const handleLikeInModal = useCallback(
    async (e) => {
      await onLike?.(e);
      await reloadSupport?.();
    },
    [onLike, reloadSupport]
  );

  return (
    <>
      <HStack spacing={3} align="center" flexWrap="wrap" justify="flex-end">
        <HStack
          as="button"
          type="button"
          spacing={2}
          cursor="pointer"
          bg="transparent"
          border="none"
          p={0}
          onClick={(e) => {
            e?.stopPropagation?.();
            onOpen();
          }}
          aria-label={`Reakcije: ${totalReactions}. Odpri podrobnosti.`}
          _hover={{ opacity: 0.88 }}
        >
          <ReactionCluster emojis={clusterEmojis} empty={totalReactions === 0} />
          <Text fontSize="xs" fontWeight="600" color="gray.600" minW="1ch">
            {totalReactions}
          </Text>
        </HStack>

        <HStack
          spacing={1}
          color="gray.500"
          fontSize="xs"
          align="center"
          userSelect="none"
          onClick={(e) => e.stopPropagation()}
        >
          <FaComment size={12} aria-hidden />
          <Text>{commentCount ?? 0}</Text>
        </HStack>
      </HStack>

      <SupportReactionsModal
        isOpen={isOpen}
        onClose={onClose}
        totalReactions={totalReactions}
        supportScore={supportScore}
        reactors={reactors}
        likeCount={likeCount}
        isLiked={isLiked}
        onLike={canLike ? handleLikeInModal : undefined}
        isLiking={isLiking}
        counts={counts}
        myReaction={myReaction}
        onReact={onReact}
        isLoading={reactingSupport}
      />
    </>
  );
}
