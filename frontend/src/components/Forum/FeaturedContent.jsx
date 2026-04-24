import { useRef, useCallback } from "react";
import { Avatar, Badge, Box, HStack, Icon, Image, Text, VStack, Skeleton } from "@chakra-ui/react";
import { prefetchPostDetail } from "../../utils/postDetailPrefetch";
import { POST_DETAIL_HOVER_PREFETCH_MS } from "../../constants/forumPrefetch.js";
import { FaStar, FaChevronRight, FaRegCommentDots } from "react-icons/fa";
import { buildCloudinaryTransformedUrl, parseCloudinaryPublicIdFromUrl, buildAvatarDisplayUrl } from "../../utils/cloudinaryUpload";

const cardShell = {
  borderRadius: "2xl",
  overflow: "hidden",
  bg: "white",
  borderWidth: "1px",
  borderColor: "gray.100",
  boxShadow: "0 4px 24px rgba(15, 23, 42, 0.06)",
  transition: "box-shadow 0.2s ease, transform 0.2s ease",
  _hover: {
    boxShadow: "0 14px 44px rgba(236, 95, 140, 0.14)",
    transform: "translateY(-2px)",
  },
};

function AccentBar({ gradient }) {
  return <Box h="3px" w="full" bgGradient={gradient} />;
}

function EmptySpotlight({ icon: IconEl, title, subtitle, iconColor = "gray.300" }) {
  return (
    <Box {...cardShell} opacity={0.92}>
      <AccentBar gradient="linear(to-r, gray.200, gray.100)" />
      <HStack align="flex-start" spacing={3} p={4}>
        <Box
          w={10}
          h={10}
          rounded="xl"
          bg="gray.50"
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Icon as={IconEl} boxSize={5} color={iconColor} />
        </Box>
        <Box flex="1" minW={0}>
          <Text fontSize="sm" fontWeight="800" color="gray.700" letterSpacing="-0.01em">
            {title}
          </Text>
          <Text fontSize="xs" color="gray.500" mt={1} lineHeight="1.5">
            {subtitle}
          </Text>
        </Box>
      </HStack>
    </Box>
  );
}

function SpotlightHeader({ icon: IconEl, title, scheme = "pink" }) {
  const bg = scheme === "orange" ? "orange.50" : "pink.50";
  const iconColor = scheme === "orange" ? "orange.400" : "pink.400";
  return (
    <HStack spacing={2} mb={3}>
      <Box
        w={8}
        h={8}
        rounded="lg"
        bg={bg}
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        <Icon as={IconEl} color={iconColor} boxSize={3.5} />
      </Box>
      <VStack align="start" spacing={0} flex={1} minW={0}>
        <Text fontSize="sm" fontWeight="800" color="gray.800" letterSpacing="-0.02em" noOfLines={1}>
          {title}
        </Text>
      </VStack>
    </HStack>
  );
}

export const FeaturedContent = ({
  featuredPost,
  featuredComment,
  loadingPost,
  loadingComment,
  onOpenPost,
}) => {
  const hoverPrefetchRef = useRef(null);
  const cancelHoverPrefetch = useCallback(() => {
    if (hoverPrefetchRef.current) {
      clearTimeout(hoverPrefetchRef.current);
      hoverPrefetchRef.current = null;
    }
  }, []);
  const schedulePostPrefetch = useCallback(
    (rawId) => {
      const id = rawId != null && String(rawId).trim() !== "" ? rawId : null;
      if (id == null) return;
      cancelHoverPrefetch();
      hoverPrefetchRef.current = setTimeout(() => {
        prefetchPostDetail(id);
        hoverPrefetchRef.current = null;
      }, POST_DETAIL_HOVER_PREFETCH_MS);
    },
    [cancelHoverPrefetch]
  );

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const featuredPid = featuredPost
    ? featuredPost.imagePublicId || parseCloudinaryPublicIdFromUrl(featuredPost.imageUrl || "")
    : null;
  const featuredImageSrc =
    featuredPost && cloudName && featuredPid
      ? buildCloudinaryTransformedUrl({ cloudName, publicId: featuredPid, profile: "thumb" }) ||
        featuredPost.imageUrl ||
        null
      : featuredPost?.imageUrl || null;

  return (
    <VStack align="stretch" spacing={4}>

      {loadingPost ? (
        <Skeleton height="140px" borderRadius="2xl" />
      ) : featuredPost ? (
        <Box
          {...cardShell}
          cursor="pointer"
          onClick={() => onOpenPost?.(featuredPost)}
          onPointerEnter={() => schedulePostPrefetch(featuredPost?.id)}
          onPointerLeave={cancelHoverPrefetch}
          role="group"
        >
          <AccentBar gradient="linear(to-r, #EC5F8C, #F48FB1)" />
          {featuredImageSrc ? (
            <Image
              src={featuredImageSrc}
              alt={featuredPost.title ? `Slika: ${featuredPost.title}` : "Slika naj objave"}
              w="full"
              h="104px"
              flexShrink={0}
              objectFit="cover"
              objectPosition="center"
              bg="gray.50"
              loading="eager"
              fetchpriority="high"
              decoding="async"
              draggable={false}
            />
          ) : null}
          <Box p={4}>
            <SpotlightHeader icon={FaStar} title="Naj objava tedna" />
            <Text
              fontSize="md"
              fontWeight="800"
              color="gray.900"
              letterSpacing="-0.02em"
              mb={1.5}
              noOfLines={2}
              lineHeight="short"
            >
              {featuredPost.title}
            </Text>
            <Text fontSize="sm" color="gray.600" mb={3} noOfLines={2} lineHeight="tall">
              {featuredPost.content}
            </Text>
            <HStack justify="space-between" align="center" spacing={3}>
              <HStack spacing={2} minW={0}>
                <Avatar
                  src={buildAvatarDisplayUrl(cloudName, featuredPost.authorAvatarUrl)}
                  size="xs"
                  name={featuredPost.author || "Mamica"}
                  bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
                />
                <Text fontSize="xs" color="gray.500" fontWeight="600" noOfLines={1}>
                  {featuredPost.author}
                </Text>
              </HStack>
              <HStack
                spacing={0}
                color="pink.500"
                fontWeight="700"
                fontSize="xs"
                opacity={0}
                _groupHover={{ opacity: 1 }}
                transition="opacity 0.2s"
              >
                <Text>Odpri</Text>
                <Icon as={FaChevronRight} boxSize={3} />
              </HStack>
            </HStack>
          </Box>
        </Box>
      ) : (
        <EmptySpotlight
          icon={FaStar}
          title="Najboljša objava tedna"
          subtitle="Ta teden še ni izbrane objave. Kmalu spet preveri."
          iconColor="gray.300"
        />
      )}

      {loadingComment ? (
        <Skeleton height="132px" borderRadius="2xl" />
      ) : featuredComment ? (
        <Box
          {...cardShell}
          cursor="pointer"
          onClick={() => {
            if (featuredComment.postId) onOpenPost?.(featuredComment.postId);
          }}
          onPointerEnter={() => schedulePostPrefetch(featuredComment?.postId)}
          onPointerLeave={cancelHoverPrefetch}
          role="group"
        >
          <AccentBar gradient="linear(to-r, #EC5F8C, #F48FB1)" />
          <Box p={4}>
            <SpotlightHeader icon={FaRegCommentDots} title="Naj komentar tedna" />
            {featuredComment.postTitle ? (
              <Text fontSize="10px" fontWeight="700" color="gray.400" textTransform="uppercase" letterSpacing="0.08em" mb={2} noOfLines={1}>
                Objava · {featuredComment.postTitle}
              </Text>
            ) : null}
            <Text fontSize="sm" color="gray.700" mb={3} noOfLines={4} lineHeight="tall" fontStyle="italic">
              “{featuredComment.content}”
            </Text>
            <HStack justify="space-between" align="center">
              <HStack spacing={2} minW={0}>
                <Avatar
                  src={buildAvatarDisplayUrl(cloudName, featuredComment.authorAvatarUrl)}
                  size="xs"
                  name={featuredComment.author || "Mamica"}
                  bgGradient="linear(135deg, #805AD5 0%, #B794F4 100%)"
                />
                <Text fontSize="xs" color="gray.500" fontWeight="600" noOfLines={1}>
                  {featuredComment.author}
                </Text>
              </HStack>
              <HStack
                spacing={0}
                color="pink.500"
                fontWeight="700"
                fontSize="xs"
                opacity={0}
                _groupHover={{ opacity: 1 }}
                transition="opacity 0.2s"
              >
                <Text>K pogovoru</Text>
                <Icon as={FaChevronRight} boxSize={3} />
              </HStack>
            </HStack>
          </Box>
        </Box>
      ) : (
        <EmptySpotlight
          icon={FaRegCommentDots}
          title="Najboljši komentar tedna"
          subtitle="Še ni izbranega komentarja. Bodiva pozitivni v klepetu."
          iconColor="gray.300"
        />
      )}
    </VStack>
  );
};
