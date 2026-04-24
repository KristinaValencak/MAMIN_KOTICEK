import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import {Box, Heading, Text, VStack, HStack, Skeleton, IconButton, Button, Avatar, Textarea, FormControl, FormErrorMessage, Menu, MenuButton, MenuList, MenuItem, useDisclosure, Checkbox, Flex, Image, Alert, AlertIcon, AlertTitle, AlertDescription, Badge, Wrap, WrapItem, Collapse} from "@chakra-ui/react";
import CommentsList from "./Comments/CommentsList";
import { usePost } from "../../hooks/posts/usePost";
import { useComments } from "../../hooks/comments/useComments";
import { useCommentLikes } from "../../hooks/comments/useCommentLikes";
import { API_BASE } from "../../api/config";
import { INPUT_LIMITS } from "../../constants/inputLimits";

import { BsThreeDotsVertical } from "react-icons/bs";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { FaComment } from "react-icons/fa";
import { HiBookmark, HiOutlineBookmark } from "react-icons/hi2";
import ReportPostModal from "./Report/ReportPostModal";
import ReportCommentModal from "./Report/ReportCommentModal";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaStar, FaRegStar } from "react-icons/fa";
import ForumReactionSummary from "../Interactions/ForumReactionSummary";
import { usePostSupport } from "../../hooks/support/usePostSupport";
import { buildForumFeedImageProps, buildForumPostDetailImageProps, buildAvatarDisplayUrl } from "../../utils/cloudinaryUpload";
import { getStoredUser, profilePathForUserId } from "../../utils/helpers";
import { submitModerationAppeal, hideModerationContent } from "../../api/moderation";
import { useAuthGate } from "../../context/AuthGateContext";
import ExpandableText from "../common/ExpandableText";
import { COMMENTS_FIRST_PAGE_LIMIT, COMMENTS_PREVIEW_DEFER_MS } from "../../constants/forumPrefetch.js";
import { hasPermission } from "../../utils/authz";
import { FiEyeOff, FiFlag, FiTrash2 } from "react-icons/fi";

const SUPPORT_TYPES = new Set(["support", "hug", "understand", "together"]);

export default function ForumPost({ postId, onBack, previewFromFeed = null }) {
  const previewMatch =
    Boolean(previewFromFeed) && postId != null && String(previewFromFeed.id) === String(postId);
  const { requestAuth } = useAuthGate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notifBanner, setNotifBanner] = useState(null);
  const {
    post,
    loading: loadingPost,
    error,
    fullDetailSynced,
    likes,
    liking,
    favoriting,
    handleLike,
    deletePost,
    toggleFavorite,
    toggleFeature,
    setPost,
  } = usePost(postId, previewMatch ? previewFromFeed : null);

  const [commentsFetchEnabled, setCommentsFetchEnabled] = useState(() => !previewMatch);
  const commentsSentinelRef = useRef(null);
  const [replyOpen, setReplyOpen] = useState(false);

  const markNotifReadBestEffort = useCallback(async (notifId) => {
    const id = String(notifId || "").trim();
    if (!id) return;
    try {
      await fetch(`${API_BASE}/api/notifications/${encodeURIComponent(id)}/read`, {
        method: "PUT",
        credentials: "include",
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setCommentsFetchEnabled(!previewMatch);
  }, [postId, previewMatch]);

  // One-time banner + deep-linking (notif + comment scroll).
  useEffect(() => {
    const notifId = searchParams.get("notif");
    const bannerKey = searchParams.get("banner");
    const commentId = searchParams.get("comment");
    const hasBanner = Boolean(bannerKey && bannerKey.trim());
    const hasNotif = Boolean(notifId && notifId.trim());

    if (hasBanner) {
      const bk = String(bannerKey || "").trim();
      // When a post is hidden, we show the richer in-post warning (with "Zahtevaj pregled")
      // instead of duplicating it with a generic top banner.
      if (bk === "hidden" || bk === "appeal_upheld") {
        // no-op
      } else {
      const title =
        bk === "unhidden"
          ? "Vašo objavo smo pregledali"
          : bk === "hidden"
            ? "Vaša objava je začasno skrita"
            : bk === "appeal_upheld"
              ? "Zahtevek za pregled je bil zavrnjen"
              : bk === "suspended"
                ? "Vaš profil je začasno onemogočen"
                : bk === "unsuspended"
                  ? "Vaš profil je ponovno aktiven"
                  : "Moderacija";
      const desc =
        bk === "unhidden"
          ? "Vsebina je ponovno vidna skupnosti."
          : bk === "hidden"
            ? "Če menite, da gre za napako, lahko zahtevate pregled."
            : bk === "appeal_upheld"
              ? "Vsebina ostaja skrita."
              : "";
      setNotifBanner({ key: bk, title, desc });
      }
    }

    if (hasNotif) {
      markNotifReadBestEffort(notifId);
    }

    // Ensure comments are loaded if we're deep-linking to a comment.
    if (commentId && commentId.trim()) {
      setCommentsFetchEnabled(true);
    }

    // Consume one-time params so banner doesn't repeat on refresh.
    if (hasBanner || hasNotif) {
      const next = new URLSearchParams(searchParams);
      next.delete("notif");
      next.delete("banner");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, markNotifReadBestEffort]);

  useEffect(() => {
    if (replyOpen) setCommentsFetchEnabled(true);
  }, [replyOpen]);

  useEffect(() => {
    if (!previewMatch) return;
    const el = commentsSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setCommentsFetchEnabled(true);
      },
      { root: null, rootMargin: "100px 0px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [previewMatch, postId]);

  const commentsQueryEnabled = !previewMatch || commentsFetchEnabled;

  const { comments, loading: loadingComments, loadingMore, hasMore, totalCount, loadMoreComments, addComment, deleteComment, toggleFeature: toggleCommentFeature, reloadComments } = useComments(postId, {
    enabled: commentsQueryEnabled,
    deferMs: previewMatch && commentsQueryEnabled ? COMMENTS_PREVIEW_DEFER_MS : 0,
    initialLimit: COMMENTS_FIRST_PAGE_LIMIT,
  });
  const { commentLikes, likingComments, handleLike: handleCommentLike } = useCommentLikes(comments);

  // Scroll into view when deep-linking to a specific comment/reply.
  useEffect(() => {
    const commentId = searchParams.get("comment");
    if (!commentId || !String(commentId).trim()) return;
    if (loadingComments) return;
    const el = document.querySelector(`[data-comment-id="${CSS.escape(String(commentId).trim())}"]`);
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      el.scrollIntoView();
    }
  }, [searchParams, loadingComments, comments]);
  const supportFromDetail = useMemo(() => {
    const sc = post?.supportCounts;
    if (!sc || typeof sc !== "object" || typeof sc.support !== "number") return null;
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
  const { support, reactingSupport, react, reloadSupport } = usePostSupport(postId, supportFromDetail);
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const feedThumbProps = useMemo(
    () => buildForumFeedImageProps(cloudName, post?.imagePublicId, post?.imageUrl),
    [cloudName, post?.imagePublicId, post?.imageUrl]
  );
  const imageProps = useMemo(
    () => buildForumPostDetailImageProps(cloudName, post?.imagePublicId, post?.imageUrl),
    [cloudName, post?.imagePublicId, post?.imageUrl]
  );
  const displayImageProps = useMemo(() => {
    if (!fullDetailSynced && feedThumbProps?.src) return feedThumbProps;
    return imageProps;
  }, [fullDetailSynced, feedThumbProps, imageProps]);
  const authorAvatarSrc = useMemo(
    () => buildAvatarDisplayUrl(cloudName, post?.authorAvatarUrl),
    [cloudName, post?.authorAvatarUrl]
  );

  const commentBadgeCount = useMemo(() => {
    if (!loadingComments && commentsQueryEnabled) return totalCount;
    if (typeof post?.commentCount === "number") return post.commentCount;
    return totalCount;
  }, [loadingComments, commentsQueryEnabled, totalCount, post?.commentCount]);

  const [replyText, setReplyText] = useState("");
  const [isCommentAnonymous, setIsCommentAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast, confirm } = useAppToast();
  const navigate = useNavigate();

  const { isOpen: isReportOpen, onOpen: onReportOpen, onClose: onReportClose } = useDisclosure();
  const { isOpen: isReportCommentOpen, onOpen: onReportCommentOpen, onClose: onReportCommentClose } = useDisclosure();
  const [reportingComment, setReportingComment] = useState(null);
  const [appealBusy, setAppealBusy] = useState(false);

  const [user] = useState(() => getStoredUser());
  const isAdmin = user?.isAdmin === true;
  const canHide = hasPermission(user, "moderation.content.hide");
  const isOwnPost =
    user?.id != null &&
    post?.userId != null &&
    Number(user.id) === Number(post.userId);

  const authorProfileClickable = Boolean(post?.userId) && !post?.isAnonymous;

  const formatDate = (iso) =>
    new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });

  const handleSubmit = async () => {
    if (!replyText.trim()) return;
    if (!getStoredUser()) {
      requestAuth({ tab: "login", reason: "Za komentiranje se morate prijaviti." });
      return;
    }
    setSubmitting(true);
    const newComment = await addComment(replyText.trim(), isCommentAnonymous);
    if (newComment) {
      setReplyText("");
      setIsCommentAnonymous(false);
      setReplyOpen(false);
    }
    setSubmitting(false);
  };

  const handleCommentDelete = async (commentId) => {
    const ok = await confirm({
      title: "Odstranitev komentarja",
      description: "Ali želite odstraniti ta komentar?",
      confirmText: "Odstrani",
      cancelText: "Prekliči",
      destructive: true,
    });
    if (!ok) return;
    await deleteComment(commentId);
  };

  const handleCommentFeature = async (commentId, isFeatured) => {
    await toggleCommentFeature(commentId, isFeatured);
  };

  const handleReplyAdded = async () => {
    await reloadComments();
  };

  const handlePostDelete = async () => {
    const ok = await confirm({
      title: "Brisanje objave",
      description: "Ko objavo izbrišete, je ne bo več mogoče obnoviti. Ali želite nadaljevati?",
      confirmText: "Izbriši",
      cancelText: "Prekliči",
      destructive: true,
    });
    if (!ok) return;
    const deleted = await deletePost();
    if (deleted) {
      if (onBack) onBack();
      else navigate("/");
    }
  };

  const handlePostHide = async () => {
    if (!post?.id) return;
    const ok = await confirm({
      title: "Skrij objavo?",
      description: "Objava bo javno nevidna. Avtor jo bo še videl in lahko zahteva pregled.",
      confirmText: "Skrij",
      cancelText: "Prekliči",
      destructive: true,
    });
    if (!ok) return;
    try {
      await hideModerationContent("post", post.id);
      toast({ status: "success", title: "Objava skrita" });
      setPost((p) => (p ? { ...p, isHidden: true } : p));
      window.dispatchEvent(new Event("moderation-queue-changed"));
    } catch (e) {
      toast({ status: "error", title: "Napaka", description: e.message || "Skrivanje ni uspelo." });
    }
  };

  const handlePostFeature = async () => {
    await toggleFeature(!post.isFeatured);
  };

  const handlePostAppeal = async () => {
    if (!post?.id || post.appealPending) return;
    setAppealBusy(true);
    try {
      await submitModerationAppeal({ targetType: "post", targetId: post.id });
      setPost((prev) => (prev ? { ...prev, appealPending: true, appealLastOutcome: null } : prev));
      window.dispatchEvent(new Event("moderation-queue-changed"));
      toast({
        status: "success",
        title: "Zahteva poslana",
        description: "Moderatorji jo bodo obravnavali, ko bo mogoče.",
      });
    } catch (e) {
      toast({ status: "error", title: "Napaka", description: e.message || "Poskusite znova." });
    } finally {
      setAppealBusy(false);
    }
  };

  return (
    <VStack align="stretch" spacing={4}>
      <Collapse in={Boolean(notifBanner)} animateOpacity>
        {notifBanner ? (
          <Alert
            status={notifBanner.key === "hidden" || notifBanner.key === "appeal_upheld" || notifBanner.key === "suspended" ? "warning" : "success"}
            mb={2}
            rounded="xl"
          >
            <AlertIcon />
            <Box>
              <AlertTitle fontWeight="800">{notifBanner.title}</AlertTitle>
              {notifBanner.desc ? <AlertDescription>{notifBanner.desc}</AlertDescription> : null}
            </Box>
          </Alert>
        ) : null}
      </Collapse>
      {error && <Box color="red.600" fontSize="sm">{error}</Box>}

      {loadingPost && !post ? (
        <VStack align="stretch" spacing={4}>
          <HStack spacing={3}>
            <Skeleton boxSize="32px" borderRadius="full" flexShrink={0} />
            <Skeleton height="14px" flex="1" maxW="200px" borderRadius="md" />
          </HStack>
          <Skeleton height="22px" maxW="85%" borderRadius="md" />
          <Skeleton height="220px" w="100%" maxW="720px" borderRadius="xl" />
          <Skeleton height="14px" w="100%" borderRadius="md" />
          <Skeleton height="14px" w="95%" borderRadius="md" />
          <Skeleton height="14px" w="70%" borderRadius="md" />
        </VStack>
      ) : post ? (
        <Box className="forum-objava-detail" position="relative">
          {post.isHidden && isOwnPost && (
            <Alert status="warning" variant="subtle" borderRadius="xl" mb={4} flexDirection="column" alignItems="stretch">
              <HStack align="flex-start" spacing={3}>
                <AlertIcon boxSize="20px" mt={0.5} />
                <Box flex="1">
                  <AlertTitle fontSize="sm" mb={1}>
                    Objava je skrita od javnosti
                  </AlertTitle>
                  <AlertDescription fontSize="sm" display="block">
                  Ker lahko krši pravila skupnosti, je ta objava trenutno vidna samo tebi in moderatorjem.
                  Če meniš, da gre za napako, lahko zahtevaš pregled (največ 3 zahteve, po zavrnitvi lahko znova poskusiš čez 30 dni).
                  </AlertDescription>
                  {!post.appealPending && post.appealBlockReason && (
                    <Text fontSize="sm" color="gray.800" mt={2} fontWeight="600">
                      {post.appealBlockReason}
                    </Text>
                  )}
                  <Button
                    mt={3}
                    size="sm"
                    colorScheme="orange"
                    rounded="lg"
                    isLoading={appealBusy}
                    isDisabled={post.appealPending || post.appealAllowed === false}
                    onClick={handlePostAppeal}
                  >
                    {post.appealPending ? "Zahteva za pregled je v teku" : "Zahtevaj pregled"}
                  </Button>
                  {!post.appealPending && post.appealLastOutcome === "upheld" && !post.appealBlockReason && (
                    <Text fontSize="sm" color="gray.700" mt={3} lineHeight="1.5">
                      Zadnji pregled je potrdil, da objava ostane skrita. Za dodatna vprašanja uporabite kontakt na strani o nas.
                    </Text>
                  )}
                </Box>
              </HStack>
            </Alert>
          )}

          <Box className="forum-post-card-header">
            <HStack justify="space-between" align="center" w="full">
              <HStack spacing={3} flex="1">
                <Avatar
                  src={authorAvatarSrc}
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
                    if (authorProfileClickable) navigate(profilePathForUserId(post.userId));
                  }}
                />
                <Box
                  as="span"
                  color="#262626"
                  fontWeight="600"
                  fontSize="sm"
                  cursor={authorProfileClickable ? "pointer" : "default"}
                  _hover={authorProfileClickable ? { color: "gray.600" } : {}}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (authorProfileClickable) navigate(profilePathForUserId(post.userId));
                  }}
                >
                  {post.author || "neznano"}
                </Box>
              </HStack>
              {user?.id && (
                <Menu placement="bottom-end">
                  <MenuButton
                    as={IconButton}
                    icon={<BsThreeDotsVertical />}
                    variant="ghost"
                    size="sm"
                    onClick={(e) => e.stopPropagation()}
                    _hover={{ bg: "gray.100" }}
                    aria-label="Možnosti"
                  />
                  <MenuList>
                    <MenuItem
                      icon={post.isFavorited ? <HiBookmark /> : <HiOutlineBookmark />}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite();
                      }}
                      isDisabled={favoriting}
                    >
                      {post.isFavorited ? "Odstrani iz priljubljenih" : "Dodaj med priljubljene"}
                    </MenuItem>
                    {!isOwnPost && (
                      <MenuItem icon={<FiFlag />} onClick={onReportOpen}>
                        Prijavi neprimerno objavo
                      </MenuItem>
                    )}
                    {canHide && !post.isHidden && (
                      <MenuItem icon={<FiEyeOff />} color="orange.700" onClick={handlePostHide}>
                        Skrij objavo
                      </MenuItem>
                    )}
                    {(isOwnPost || isAdmin) && (
                      <MenuItem icon={<FiTrash2 />} color="red.600" onClick={handlePostDelete}>
                        {isAdmin && !isOwnPost ? "Izbriši objavo (Admin)" : "Odstrani objavo"}
                      </MenuItem>
                    )}
                    {isAdmin && (
                      <MenuItem
                        icon={post.isFeatured ? <FaRegStar /> : <FaStar />}
                        onClick={handlePostFeature}
                      >
                        {post.isFeatured ? "Odstrani zvezdico" : "Označi kot najboljšo tedna"}
                      </MenuItem>
                    )}
                  </MenuList>
                </Menu>
              )}
            </HStack>
          </Box>

          <Box>
            <Heading className="forum-post-card-title" as="h1" fontSize="1rem" fontWeight="600">{post.title}</Heading>
          </Box>

          {Array.isArray(post.tags) && post.tags.length ? (
            <Box mt={2} px="1.25rem">
              <Wrap spacing={2}>
                {post.tags.slice(0, 6).map((t) => (
                  <WrapItem key={t}>
                    <Badge variant="subtle" colorScheme="pink" borderRadius="md" fontSize="0.7rem">
                      #{t}
                    </Badge>
                  </WrapItem>
                ))}
                {post.tags.length > 6 ? (
                  <WrapItem>
                    <Badge variant="subtle" colorScheme="gray" borderRadius="md" fontSize="0.7rem">
                      +{post.tags.length - 6}
                    </Badge>
                  </WrapItem>
                ) : null}
              </Wrap>
            </Box>
          ) : null}

          <Box className="forum-post-card-content">
            <ExpandableText
              text={post.content}
              maxLines={8}
              className="forum-objava-body"
              fontSize="md"
              lineHeight="1.75"
              color="gray.800"
            />
          </Box>

          {displayImageProps.src && (
            <Box mb={3} px="1.25rem">
              <Image
                src={displayImageProps.src}
                srcSet={displayImageProps.srcSet}
                sizes={displayImageProps.sizes}
                alt="Slika objave"
                width="100%"
                maxH="420px"
                objectFit="cover"
                borderRadius="xl"
                loading="eager"
                fetchpriority="high"
                decoding="async"
                bg="gray.50"
              />
            </Box>
          )}

          <Box className="forum-post-card-footer">
            <HStack spacing={4} fontSize="xs" color="gray.500" justify="space-between">
              <Text>{formatDate(post.createdAt)}</Text>
              <ForumReactionSummary
                likeCount={likes.count}
                isLiked={likes.isLiked}
                isLiking={liking}
                onLike={async (e) => {
                  e?.stopPropagation?.();
                  if (support.myReaction) await react(support.myReaction);
                  handleLike();
                }}
                counts={support.counts}
                myReaction={support.myReaction}
                onReact={async (type, e) => {
                  e?.stopPropagation?.();
                  if (likes.isLiked) await handleLike();
                  react(type);
                }}
                reactingSupport={reactingSupport}
                reactors={support.reactors}
                reloadSupport={reloadSupport}
                commentCount={commentBadgeCount ?? 0}
              />
            </HStack>
          </Box>

          <Flex py={2} px={5} justify="flex-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setReplyOpen((v) => !v)}
              color="gray.500"
              fontWeight="500"
              _hover={{ color: "#262626" }}
            >
              Dodaj komentar
            </Button>
          </Flex>


          {replyOpen && (
            <Box className="forum-post-reply">
              <FormControl isInvalid={!replyText.trim() && replyText.length > 0}>
                <Textarea
                  placeholder="Napiši komentar…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  maxLength={INPUT_LIMITS.COMMENT}
                  rows={4}
                  className="forum-reply-textarea"
                />
                {!replyText.trim() && replyText.length > 0 && (
                  <FormErrorMessage>Vsebina je obvezna.</FormErrorMessage>
                )}
              </FormControl>
              <FormControl mt={3}>
                <Checkbox
                  isChecked={isCommentAnonymous}
                  onChange={(e) => setIsCommentAnonymous(e.target.checked)}
                  colorScheme="brand"
                >
                  <Text fontSize="sm">Objavi kot anonimen član</Text>
                </Checkbox>
              </FormControl>
              <HStack mt={3} justify="flex-end" spacing={3}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setReplyOpen(false); setReplyText(""); setIsCommentAnonymous(false); }}
                  color="gray.600"
                  _hover={{ color: "#262626" }}
                >
                  Prekliči
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  isLoading={submitting}
                  isDisabled={!replyText.trim()}
                  bg="#EC5F8C"
                  color="white"
                  fontWeight="500"
                  _hover={{ bg: "#d94b7a" }}
                  _disabled={{ opacity: 0.5 }}
                >
                  Objavi
                </Button>
              </HStack>
            </Box>
          )}
        </Box>
      ) : (
        <Text color="gray.600">Objave ni mogoče prikazati.</Text>
      )
      }


      <Box ref={commentsSentinelRef} h="2px" w="full" flexShrink={0} aria-hidden />
      {previewMatch && !commentsFetchEnabled && !replyOpen ? (
        <Box mt={4}>
          <Text fontSize="sm" fontWeight="600" color="gray.600">
            Komentarji
          </Text>
          <Text fontSize="xs" color="gray.500" mt={1} lineHeight="short">
            Naloženi bodo, ko se pomaknete sem ali odprete obrazec za odgovor.
          </Text>
        </Box>
      ) : (
        <CommentsList
          comments={comments}
          loadingComments={loadingComments}
          loadingMore={loadingMore}
          hasMore={hasMore}
          totalCount={totalCount}
          onLoadMore={loadMoreComments}
          postId={postId}
          isAdmin={isAdmin}
          user={user}
          commentLikes={commentLikes}
          likingComments={likingComments}
          onLike={handleCommentLike}
          onDelete={handleCommentDelete}
          onFeature={handleCommentFeature}
          onReplyAdded={handleReplyAdded}
          onReportComment={(comment) => { setReportingComment(comment); onReportCommentOpen(); }}
          onCommentAppealSubmitted={reloadComments}
        />
      )}

      <ReportPostModal
        isOpen={isReportOpen}
        onClose={onReportClose}
        postId={postId}
        postTitle={post?.title}
        postAuthor={post?.author || post?.user?.username}
        apiBase={API_BASE}
      />
      <ReportCommentModal
        isOpen={isReportCommentOpen}
        onClose={() => { onReportCommentClose(); setReportingComment(null); }}
        commentId={reportingComment?.id}
        commentContent={reportingComment?.content}
        commentAuthor={reportingComment?.user?.username}
        apiBase={API_BASE}
      />
    </VStack >
  );
}