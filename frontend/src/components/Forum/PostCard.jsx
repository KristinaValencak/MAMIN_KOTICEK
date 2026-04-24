import { useMemo, useState, memo, useRef, useCallback } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { Box, HStack, Avatar, IconButton, Heading, Text, Menu, MenuButton, MenuList, MenuItem, Image, Badge, Wrap, WrapItem } from "@chakra-ui/react";
import { BsThreeDotsVertical } from "react-icons/bs";
import { HiBookmark, HiOutlineBookmark } from "react-icons/hi2";
import { formatDate, getStoredUser, profilePathForUserId } from "../../utils/helpers";
import { useAuthGate } from "../../context/AuthGateContext";
import { hasPermission } from "../../utils/authz";
import { hideModerationContent } from "../../api/moderation";
import ForumReactionSummary from "../Interactions/ForumReactionSummary";
import { usePostSupport } from "../../hooks/support/usePostSupport";
import { buildForumFeedImageProps, buildAvatarDisplayUrl } from "../../utils/cloudinaryUpload";
import { API_BASE } from "../../api/config";
import { prefetchPostDetail } from "../../utils/postDetailPrefetch";
import { POST_DETAIL_HOVER_PREFETCH_MS } from "../../constants/forumPrefetch.js";
import { FiEyeOff, FiFlag, FiTrash2 } from "react-icons/fi";

const SUPPORT_TYPES = new Set(["support", "hug", "understand", "together"]);

function PostCardInner({
  post,
  postLikes,
  likingPosts,
  onLike,
  onOpen,
  onReport,
  onDeleteOwn,
  onFavoriteChange,
  navigate,
  priorityMedia = false,
}) {
  const supportFromFeed = useMemo(() => {
    const sc = post?.supportCounts;
    if (!sc || typeof sc !== "object") return null;
    const mr = post?.mySupportReaction;
    return {
      counts: {
        support: Number(sc.support) || 0,
        hug: Number(sc.hug) || 0,
        understand: Number(sc.understand) || 0,
        together: Number(sc.together) || 0,
      },
      myReaction: typeof mr === "string" && SUPPORT_TYPES.has(mr) ? mr : null,
    };
  }, [post?.id, post?.supportCounts, post?.mySupportReaction]);

  const { support, reactingSupport, react, reloadSupport } = usePostSupport(post.id, supportFromFeed);
  const { toast } = useAppToast();
  const { requestAuth } = useAuthGate();
  const [favoriting, setFavoriting] = useState(false);
  const me = getStoredUser();
  const authorId = post.userId ?? post.user_id;
  const isOwnPost = me?.id != null && authorId != null && Number(me.id) === Number(authorId);
  const authorProfileClickable = Boolean(authorId) && !post.isAnonymous;
  const canHide = hasPermission(me, "moderation.content.hide");

  const handleHidePost = async (e) => {
    e?.stopPropagation?.();
    try {
      await hideModerationContent("post", post.id);
      toast({ status: "success", title: "Objava skrita", description: "Javno ni več vidna." });
      window.dispatchEvent(new Event("moderation-queue-changed"));
    } catch (err) {
      toast({ status: "error", title: "Napaka", description: err?.message || "Skrivanje ni uspelo." });
    }
  };

  const handleToggleFavorite = async (e) => {
    e?.stopPropagation?.();
    if (!me?.id) {
      requestAuth({ tab: "login", reason: "Za shranjevanje med priljubljene se morate prijaviti." });
      return;
    }
    const prev = Boolean(post.isFavorited);
    const next = !prev;
    onFavoriteChange?.(post.id, next);
    setFavoriting(true);
    try {
      const res = await fetch(`${API_BASE}/api/posts/${post.id}/favorite`, {
        method: next ? "POST" : "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("request failed");
    } catch {
      onFavoriteChange?.(post.id, prev);
      toast({ status: "error", title: "Napaka pri priljubljeni objavi." });
    } finally {
      setFavoriting(false);
    }
  };

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const imageProps = useMemo(
    () => buildForumFeedImageProps(cloudName, post.imagePublicId, post.imageUrl),
    [cloudName, post.imagePublicId, post.imageUrl]
  );
  const avatarSrc = useMemo(
    () => buildAvatarDisplayUrl(cloudName, post.authorAvatarUrl),
    [cloudName, post.authorAvatarUrl]
  );

  const hoverPrefetchRef = useRef(null);
  const cancelHoverPrefetch = useCallback(() => {
    if (hoverPrefetchRef.current) {
      clearTimeout(hoverPrefetchRef.current);
      hoverPrefetchRef.current = null;
    }
  }, []);
  const onCardPointerEnter = useCallback(() => {
    cancelHoverPrefetch();
    hoverPrefetchRef.current = setTimeout(() => {
      prefetchPostDetail(post.id);
      hoverPrefetchRef.current = null;
    }, POST_DETAIL_HOVER_PREFETCH_MS);
  }, [post.id, cancelHoverPrefetch]);

  return (
    <Box
      className="forum-post-card"
      onClick={() => onOpen(post)}
      onPointerEnter={onCardPointerEnter}
      onPointerLeave={cancelHoverPrefetch}
      minW={0}
      maxW="full"
      overflow="hidden"
    >
      <Box className="forum-post-card-header" mb={3}>
        <HStack justify="space-between" align="center" w="full" minW={0} spacing={3}>
          <HStack spacing={3} flex="1" minW={0}>
            <Avatar
              src={avatarSrc}
              name={post.author || "Uporabnik"}
              size="sm"
              bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
              color="white"
              sx={{
                "& .chakra-avatar__initials": {
                  lineHeight: "1",
                  transform: "translateY(1px)",
                },
              }}
              cursor={authorProfileClickable ? "pointer" : "default"}
              onClick={(e) => {
                e.stopPropagation();
                if (authorProfileClickable) navigate(profilePathForUserId(authorId));
              }}
              _hover={authorProfileClickable ? { transform: "scale(1.1)", transition: "all 0.2s" } : {}}
              loading={priorityMedia ? "eager" : "lazy"}
            />
            <Box
              as="span"
              color="gray.800"
              fontWeight="600"
              fontSize="sm"
              cursor={authorProfileClickable ? "pointer" : "default"}
              _hover={authorProfileClickable ? { color: "#EC5F8C", textDecoration: "underline" } : {}}
              onClick={(e) => {
                e.stopPropagation();
                if (authorProfileClickable) navigate(profilePathForUserId(authorId));
              }}
            >
              {post.author || "neznano"}
            </Box>
          </HStack>
          {me?.id ? (
            <Menu placement="bottom-end">
              <MenuButton as={IconButton} icon={<BsThreeDotsVertical />} variant="ghost" size="sm" onClick={(e) => e.stopPropagation()} _hover={{ bg: "gray.100" }} aria-label="Možnosti" />
              <MenuList>
                <MenuItem
                  icon={post.isFavorited ? <HiBookmark /> : <HiOutlineBookmark />}
                  onClick={handleToggleFavorite}
                  isDisabled={favoriting}
                >
                  {post.isFavorited ? "Odstrani iz priljubljenih" : "Dodaj med priljubljene"}
                </MenuItem>
                {!isOwnPost && (
                  <MenuItem icon={<FiFlag />} onClick={(e) => { e.stopPropagation(); onReport(post); }}>Prijavi neprimerno objavo</MenuItem>
                )}
                {canHide && !post.isHidden && (
                  <MenuItem icon={<FiEyeOff />} color="orange.700" onClick={handleHidePost}>
                    Skrij objavo
                  </MenuItem>
                )}
                {isOwnPost && (
                  <MenuItem
                    icon={<FiTrash2 />}
                    color="red.600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteOwn?.(post);
                    }}
                  >
                    Odstrani objavo
                  </MenuItem>
                )}
              </MenuList>
            </Menu>
          ) : null}
        </HStack>
      </Box>
      <Box mb={2}>
        <HStack spacing={2} align="center" flexWrap="wrap" minW={0}>
          {isOwnPost && post.isHidden && (
            <Badge colorScheme="orange" fontSize="0.65rem" borderRadius="md">
              Skrita od javnosti
            </Badge>
          )}
          <Heading
            className="forum-post-card-title"
            flex="1"
            minW={0}
            fontSize="lg"
            overflowWrap="anywhere"
            wordBreak="break-word"
          >
            {post.title}
          </Heading>
        </HStack>
      </Box>
      {Array.isArray(post.tags) && post.tags.length ? (
        <Box mb={2}>
          <Wrap spacing={2}>
            {post.tags.slice(0, 3).map((t) => (
              <WrapItem key={t}>
                <Badge
                  variant="subtle"
                  colorScheme="pink"
                  borderRadius="md"
                  fontSize="0.65rem"
                  textTransform="lowercase"
                >
                  #{t}
                </Badge>
              </WrapItem>
            ))}
            {post.tags.length > 3 ? (
              <WrapItem>
                <Badge variant="subtle" colorScheme="gray" borderRadius="md" fontSize="0.65rem">
                  +{post.tags.length - 3}
                </Badge>
              </WrapItem>
            ) : null}
          </Wrap>
        </Box>
      ) : null}
      <Box className="forum-post-card-content" mb={3} minW={0}>
        <Text fontSize="sm" color="gray.700" noOfLines={3} lineHeight="1.6" overflowWrap="anywhere">
          {post.content}
        </Text>
      </Box>
      {imageProps.src && (
        <Box mb={3} maxW="full" overflow="hidden">
          <Image
            src={imageProps.src}
            srcSet={imageProps.srcSet}
            sizes={imageProps.sizes}
            alt="Slika objave"
            width="100%"
            maxW="100%"
            maxH="420px"
            objectFit="cover"
            borderRadius="xl"
            loading={priorityMedia ? "eager" : "lazy"}
            {...(priorityMedia ? { fetchpriority: "high" } : {})}
            decoding="async"
            bg="gray.50"
          />
        </Box>
      )}
      <Box className="forum-post-card-footer">
        <HStack spacing={3} color="gray.500" fontSize="xs" justify="space-between" minW={0} flexWrap="wrap" rowGap={2}>
          <HStack spacing={3} flexShrink={0}><Box>{formatDate(post.createdAt)}</Box></HStack>
          <Box minW={0} flex="1" display="flex" justifyContent="flex-end">
          <ForumReactionSummary
            likeCount={postLikes[post.id]?.count || 0}
            isLiked={Boolean(postLikes[post.id]?.isLiked)}
            isLiking={Boolean(likingPosts[post.id])}
            onLike={async (e) => {
              e?.stopPropagation?.();
              if (support.myReaction) await react(support.myReaction);
              onLike(post.id, e);
            }}
            counts={support.counts}
            myReaction={support.myReaction}
            onReact={async (type, e) => {
              e?.stopPropagation?.();
              if (postLikes[post.id]?.isLiked) await onLike(post.id, e);
              react(type);
            }}
            reactingSupport={reactingSupport}
            reactors={support.reactors}
            reloadSupport={reloadSupport}
            commentCount={post.commentCount ?? 0}
          />
          </Box>
        </HStack>
      </Box>
    </Box>
  );
}

export const PostCard = memo(PostCardInner);
