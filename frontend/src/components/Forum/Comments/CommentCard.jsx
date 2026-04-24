import { useState, useMemo } from "react";
import { useAppToast } from "../../../context/ApiAlertModalContext.jsx";
import {Box, HStack, VStack, Text, Avatar, IconButton, Button, Menu, MenuButton, MenuList, MenuItem, Collapse, FormControl, Checkbox, Textarea, Alert, AlertIcon, AlertTitle, AlertDescription,
} from "@chakra-ui/react";
import { FaComment, FaStar, FaRegStar, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { BsThreeDotsVertical } from "react-icons/bs";
import { API_BASE } from "../../../api/config";
import { INPUT_LIMITS } from "../../../constants/inputLimits";
import { submitModerationAppeal } from "../../../api/moderation";
import { useAuthGate } from "../../../context/AuthGateContext";
import ForumReactionSummary from "../../Interactions/ForumReactionSummary";
import { useCommentSupport } from "../../../hooks/support/useCommentSupport";
import { FiEyeOff, FiFlag, FiTrash2 } from "react-icons/fi";

const SUPPORT_TYPES = new Set(["support", "hug", "understand", "together"]);
import ExpandableText from "../../common/ExpandableText";
import { buildAvatarDisplayUrl } from "../../../utils/cloudinaryUpload";
import { hasPermission } from "../../../utils/authz";
import { hideModerationContent } from "../../../api/moderation";

export default function CommentCard({
    comment,
    isAdmin,
    user,
    commentLikes,
    likingComments,
    onLike,
    onDelete,
    onFeature,
    onReplyAdded,
    onReport,
    onAppealSubmitted,
    repliesExpanded,
    onToggleReplies
}) {
    const [replyFormOpen, setReplyFormOpen] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [appealBusy, setAppealBusy] = useState(false);
    const { toast } = useAppToast();
    const { requestAuth } = useAuthGate();
    const commentSupportBootstrap = useMemo(() => {
        const sc = comment?.supportCounts;
        if (!sc || typeof sc !== "object" || typeof sc.support !== "number") return null;
        const mr = comment?.mySupportReaction;
        return {
            counts: {
                support: Number(sc.support) || 0,
                hug: Number(sc.hug) || 0,
                understand: Number(sc.understand) || 0,
                together: Number(sc.together) || 0,
            },
            myReaction: typeof mr === "string" && SUPPORT_TYPES.has(mr) ? mr : null,
        };
    }, [comment?.id, comment?.supportCounts, comment?.mySupportReaction]);

    const { support, reactingSupport, react, reloadSupport } = useCommentSupport(comment.id, commentSupportBootstrap);

    const replyCount = comment.replies?.length || 0;

    const isOwnComment =
        Boolean(comment.viewerIsAuthor) ||
        (user?.id != null &&
            comment.user?.id != null &&
            Number(user.id) === Number(comment.user.id));

    const canHide = hasPermission(user, "moderation.content.hide");

    const handleHide = async () => {
        try {
            await hideModerationContent("comment", comment.id);
            toast({ status: "success", title: "Komentar skrit" });
            window.dispatchEvent(new Event("moderation-queue-changed"));
            await onAppealSubmitted?.();
        } catch (e) {
            toast({ status: "error", title: "Napaka", description: e?.message || "Skrivanje ni uspelo." });
        }
    };

    const handleCommentAppeal = async () => {
        if (!comment.id || comment.appealPending) return;
        setAppealBusy(true);
        try {
            await submitModerationAppeal({ targetType: "comment", targetId: comment.id });
            window.dispatchEvent(new Event("moderation-queue-changed"));
            toast({
              status: "success",
              title: "Zahteva poslana",
              description: "Moderatorji jo bodo obravnavali, ko bo mogoče.",
            });
            await onAppealSubmitted?.();
        } catch (e) {
            toast({ status: "error", title: "Napaka", description: e?.message || "Poskusite znova." });
        } finally {
            setAppealBusy(false);
        }
    };

    const formatDate = (iso) =>
        new Date(iso).toLocaleString(undefined, {
            year: "numeric", month: "short", day: "2-digit",
            hour: "2-digit", minute: "2-digit",
        });

    const handleSubmitReply = async () => {
        if (!replyText.trim()) return;
        if (!user) {
            requestAuth({ tab: "login", reason: "Za odgovor na komentar se morate prijaviti." });
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/api/comments/${comment.id}/replies`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ content: replyText.trim(), isAnonymous }),
            });
            if (res.ok) {
                setReplyText("");
                setIsAnonymous(false);
                setReplyFormOpen(false);
                onReplyAdded?.();
                toast({ status: "success", title: "Odgovor dodan." });
            } else {
                toast({ status: "error", title: "Napaka pri dodajanju odgovora." });
            }
        } catch {
            toast({ status: "error", title: "Napaka pri dodajanju odgovora." });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box py={3} data-comment-id={comment?.id != null ? String(comment.id) : undefined}>
            <HStack align="flex-start" spacing={3}>
                <Avatar
                    src={buildAvatarDisplayUrl(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME, comment.user?.avatarUrl)}
                    size="sm"
                    name={comment.user?.username || "Anonim"}
                    bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
                    color="white"
                    sx={{
                      "& .chakra-avatar__initials": {
                        lineHeight: "1",
                        transform: "translateY(1px)",
                      },
                    }}
                />
                <VStack align="stretch" spacing={1} flex="1">
                    <HStack justify="space-between" align="center" w="full">
                        <HStack spacing={2}>
                            <Text fontSize="sm" fontWeight="600">
                                {comment.user?.username || "Anonim"}
                            </Text>
                            <Text fontSize="xs" color="gray.400">
                                {formatDate(comment.createdAt)}
                            </Text>
                        </HStack>
                        {user?.id && (
                            <Menu placement="bottom-end">
                                <MenuButton
                                    as={IconButton}
                                    icon={<BsThreeDotsVertical />}
                                    variant="ghost"
                                    size="xs"
                                    aria-label="Možnosti"
                                    onClick={(_e) => _e.stopPropagation()}
                                />
                                <MenuList>
                                    {!isOwnComment && (
                                        <MenuItem icon={<FiFlag />} onClick={() => onReport && onReport(comment)}>
                                            Prijavi neprimeren komentar
                                        </MenuItem>
                                    )}
                                    {canHide && !comment.isHidden && (
                                        <MenuItem icon={<FiEyeOff />} color="orange.700" onClick={handleHide}>
                                            Skrij komentar
                                        </MenuItem>
                                    )}
                                    {(isOwnComment || isAdmin) && (
                                        <MenuItem icon={<FiTrash2 />} color="red.600" onClick={() => onDelete?.(comment.id)}>
                                            {isAdmin && !isOwnComment ? "Izbriši komentar (Admin)" : "Odstrani komentar"}
                                        </MenuItem>
                                    )}
                                    {isAdmin && (
                                        <MenuItem
                                            icon={comment.isFeatured ? <FaRegStar /> : <FaStar />}
                                            onClick={() => onFeature?.(comment.id, !comment.isFeatured)}
                                        >
                                            {comment.isFeatured ? "Odstrani zvezdico" : "Označi kot najboljši tedna"}
                                        </MenuItem>
                                    )}
                                </MenuList>
                            </Menu>
                        )}
                    </HStack>

                    {comment.isHidden && isOwnComment && (
                        <Alert status="warning" variant="subtle" borderRadius="lg" py={2} mb={2}>
                            <AlertIcon boxSize="14px" />
                            <Box flex="1">
                                <AlertTitle fontSize="xs">Komentar je skrit od javnosti</AlertTitle>
                                <AlertDescription fontSize="xs" display="block">
                                    Če menite, da gre za napako, lahko zahtevate pregled (največ 3 na komentar; po zavrnitvi počitek 30 dni).
                                </AlertDescription>
                                <Button
                                    mt={2}
                                    size="xs"
                                    colorScheme="orange"
                                    rounded="md"
                                    isLoading={appealBusy}
                                    isDisabled={comment.appealPending}
                                    onClick={handleCommentAppeal}
                                >
                                    {comment.appealPending ? "Zahteva v teku" : "Zahtevaj pregled"}
                                </Button>
                            </Box>
                        </Alert>
                    )}

                    <ExpandableText
                        text={comment.content}
                        maxLines={6}
                        fontSize="sm"
                        lineHeight="1.5"
                        color="gray.800"
                    />

                    <HStack spacing={4} pt={1} flexWrap="wrap">
                        <ForumReactionSummary
                            likeCount={commentLikes?.[comment.id]?.count || 0}
                            isLiked={Boolean(commentLikes?.[comment.id]?.isLiked)}
                            isLiking={Boolean(likingComments?.[comment.id])}
                            onLike={async (e) => {
                                e?.stopPropagation?.();
                                if (support.myReaction) await react(support.myReaction);
                                onLike?.(comment.id, e);
                            }}
                            counts={support.counts}
                            myReaction={support.myReaction}
                            onReact={async (type, e) => {
                                e?.stopPropagation?.();
                                if (commentLikes?.[comment.id]?.isLiked) await onLike?.(comment.id, e);
                                react(type);
                            }}
                            reactingSupport={reactingSupport}
                            reactors={support.reactors}
                            reloadSupport={reloadSupport}
                            commentCount={replyCount}
                        />

                        {replyCount > 0 && (
                            <Button
                                size="xs"
                                variant="ghost"
                                fontWeight="normal"
                                fontSize="xs"
                                color="gray.500"
                                rightIcon={repliesExpanded ? <FaChevronUp size="10px" /> : <FaChevronDown size="10px" />}
                                onClick={onToggleReplies}
                                _hover={{ color: "#EC5F8C", bg: "rgba(236, 95, 140, 0.08)" }}
                            >
                                {replyCount} {replyCount === 1 ? "odgovor" : replyCount === 2 ? "odgovora" : "odgovorov"}
                            </Button>
                        )}

                        <Button
                            size="xs"
                            variant="ghost"
                            leftIcon={<FaComment size="10px" />}
                            onClick={() => setReplyFormOpen((v) => !v)}
                        >
                            Odgovori
                        </Button>
                    </HStack>

                    <Collapse in={replyFormOpen} animateOpacity>
                        <Box mt={3} pt={3} borderTop="1px solid" borderColor="gray.100">
                            <FormControl mb={2}>
                                <Textarea
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    maxLength={INPUT_LIMITS.COMMENT}
                                    placeholder="Napiši odgovor…"
                                    rows={3}
                                    size="sm"
                                    borderRadius="8px"
                                    borderColor="gray.200"
                                    _focus={{ borderColor: "#EC5F8C" }}
                                />
                            </FormControl>
                            <FormControl mb={2}>
                                <Checkbox
                                    size="sm"
                                    isChecked={isAnonymous}
                                    onChange={(e) => setIsAnonymous(e.target.checked)}
                                >
                                    <Text fontSize="xs">Objavi kot anonimen član</Text>
                                </Checkbox>
                            </FormControl>
                            <HStack spacing={2}>
                                <Button size="xs" variant="ghost" onClick={() => { setReplyFormOpen(false); setReplyText(""); }}>
                                    Prekliči
                                </Button>
                                <Button
                                    size="xs"
                                    bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
                                    color="white"
                                    onClick={handleSubmitReply}
                                    isLoading={submitting}
                                    isDisabled={!replyText.trim()}
                                >
                                    Objavi
                                </Button>
                            </HStack>
                        </Box>
                    </Collapse>
                </VStack>
            </HStack>
        </Box>
    );
}
