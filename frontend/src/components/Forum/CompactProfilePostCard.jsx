import { useRef, useCallback } from "react";
import { Badge, Box, HStack, Text, Image } from "@chakra-ui/react";
import { prefetchPostDetail } from "../../utils/postDetailPrefetch";
import { POST_DETAIL_HOVER_PREFETCH_MS } from "../../constants/forumPrefetch.js";
import ProfileEngagementInline from "../Interactions/ProfileEngagementInline";
import { buildCloudinaryTransformedUrl, parseCloudinaryPublicIdFromUrl } from "../../utils/cloudinaryUpload";
import {
  PROFILE_COMPACT_CARD_BODY_MIN_H,
  PROFILE_COMPACT_CARD_BOX_SHADOW,
  PROFILE_COMPACT_CARD_IMAGE_H,
  PROFILE_COMPACT_CARD_MAX_W,
  PROFILE_COMPACT_CARD_NO_IMAGE_BG,
} from "../common/profileCompactCardLayout";

const cardShell = {
  borderRadius: "2xl",
  overflow: "hidden",
  bg: "white",
  borderWidth: "1px",
  borderColor: "gray.100",
  boxShadow: PROFILE_COMPACT_CARD_BOX_SHADOW,
  w: "100%",
  maxW: PROFILE_COMPACT_CARD_MAX_W,
  mx: "auto",
  h: "100%",
  minH: 0,
  display: "flex",
  flexDirection: "column",
};

export default function CompactProfilePostCard({ post, onOpen, dateLabel, imageUrl, headerRight }) {
  const hoverPrefetchRef = useRef(null);
  const cancelHoverPrefetch = useCallback(() => {
    if (hoverPrefetchRef.current) {
      clearTimeout(hoverPrefetchRef.current);
      hoverPrefetchRef.current = null;
    }
  }, []);
  const onCardPointerEnter = useCallback(() => {
    if (post?.id == null) return;
    cancelHoverPrefetch();
    hoverPrefetchRef.current = setTimeout(() => {
      prefetchPostDetail(post.id);
      hoverPrefetchRef.current = null;
    }, POST_DETAIL_HOVER_PREFETCH_MS);
  }, [post?.id, cancelHoverPrefetch]);

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const fallbackUrl = imageUrl || post?.imageUrl || null;
  const pid =
    post?.imagePublicId || parseCloudinaryPublicIdFromUrl(fallbackUrl || "") || null;
  const img =
    (cloudName && pid && buildCloudinaryTransformedUrl({ cloudName, publicId: pid, profile: "thumb" })) ||
    fallbackUrl ||
    null;

  return (
    <Box
      {...cardShell}
      cursor="pointer"
      onClick={() => onOpen?.(post)}
      onPointerEnter={onCardPointerEnter}
      onPointerLeave={cancelHoverPrefetch}
    >
      {img ? (
        <Image
          src={img}
          alt={post?.title ? `Slika: ${post.title}` : "Slika objave"}
          w="full"
          h={PROFILE_COMPACT_CARD_IMAGE_H}
          flexShrink={0}
          objectFit="cover"
          objectPosition="center"
          bg="gray.50"
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      ) : (
        <Box
          h={PROFILE_COMPACT_CARD_IMAGE_H}
          flexShrink={0}
          bg={PROFILE_COMPACT_CARD_NO_IMAGE_BG}
          borderBottomWidth="1px"
          borderBottomColor="pink.100"
          aria-hidden
        />
      )}
      <Box p={4} flex="1" display="flex" flexDirection="column" minH={PROFILE_COMPACT_CARD_BODY_MIN_H}>
        <HStack justify="space-between" align="flex-start" mb={2} spacing={2}>
          <Box flex="1" minW={0}>
            <HStack spacing={1} flexWrap="wrap">
              {post?.isHidden ? (
                <Badge colorScheme="orange" variant="subtle" fontSize="10px" borderRadius="md">
                  Skrita
                </Badge>
              ) : null}
              {post?.categoryName ? (
                <Badge colorScheme="pink" variant="subtle" fontSize="10px" borderRadius="md">
                  {post.categoryName}
                </Badge>
              ) : null}
            </HStack>
          </Box>
          {headerRight ? (
            <Box flexShrink={0} onClick={(e) => e.stopPropagation()}>
              {headerRight}
            </Box>
          ) : dateLabel ? (
            <Text fontSize="10px" color="gray.500" flexShrink={0} whiteSpace="nowrap">
              {dateLabel}
            </Text>
          ) : null}
        </HStack>
        <Text
          fontSize="md"
          fontWeight="800"
          color="gray.900"
          letterSpacing="-0.02em"
          mb={1.5}
          noOfLines={2}
          lineHeight="short"
        >
          {post?.title}
        </Text>
        <Text fontSize="sm" color="gray.600" mb={3} noOfLines={2} lineHeight="tall" flex="1">
          {post?.content}
        </Text>
        <HStack justify="space-between" align="center" spacing={2} flexWrap="wrap" mt="auto">
          <ProfileEngagementInline
            fontSize="xs"
            likeCount={post?.likeCount}
            supportCounts={post?.supportCounts}
            commentCount={post?.commentCount}
            flex="1"
            minW={0}
          />
          {headerRight && dateLabel ? (
            <Text fontSize="10px" color="gray.500" flexShrink={0}>
              {dateLabel}
            </Text>
          ) : null}
        </HStack>
      </Box>
    </Box>
  );
}
