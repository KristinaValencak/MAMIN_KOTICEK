import { useMemo } from "react";
import { useAppToast } from "../../../context/ApiAlertModalContext.jsx";
import { Box, HStack, VStack, Text, Avatar, IconButton, Menu, MenuButton, MenuList, MenuItem } from "@chakra-ui/react";
import ExpandableText from "../../common/ExpandableText";
import { buildAvatarDisplayUrl } from "../../../utils/cloudinaryUpload";
import { BsThreeDotsVertical } from "react-icons/bs";
import ForumReactionSummary from "../../Interactions/ForumReactionSummary";
import { useCommentSupport } from "../../../hooks/support/useCommentSupport";
import { hasPermission } from "../../../utils/authz";
import { hideModerationContent } from "../../../api/moderation";
import { FiEyeOff, FiFlag, FiTrash2 } from "react-icons/fi";

const SUPPORT_TYPES = new Set(["support", "hug", "understand", "together"]);

const formatDate = (iso) =>
    new Date(iso).toLocaleString(undefined, {
        year: "numeric", month: "short", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
    });

export default function ReplyCard({ reply, isAdmin, user, commentLikes, likingComments, onLike, onDelete, onReport }) {
    const { toast } = useAppToast();
    const replySupportBootstrap = useMemo(() => {
        const sc = reply?.supportCounts;
        if (!sc || typeof sc !== "object" || typeof sc.support !== "number") return null;
        const mr = reply?.mySupportReaction;
        return {
            counts: {
                support: Number(sc.support) || 0,
                hug: Number(sc.hug) || 0,
                understand: Number(sc.understand) || 0,
                together: Number(sc.together) || 0,
            },
            myReaction: typeof mr === "string" && SUPPORT_TYPES.has(mr) ? mr : null,
        };
    }, [reply?.id, reply?.supportCounts, reply?.mySupportReaction]);

    const { support, reactingSupport, react, reloadSupport } = useCommentSupport(reply.id, replySupportBootstrap);
    const isOwnReply =
        Boolean(reply.viewerIsAuthor) ||
        (user?.id != null &&
            reply.user?.id != null &&
            Number(user.id) === Number(reply.user.id));

    const canHide = hasPermission(user, "moderation.content.hide");

    const handleHide = async () => {
        try {
            await hideModerationContent("comment", reply.id);
            toast({ status: "success", title: "Komentar skrit" });
            window.dispatchEvent(new Event("moderation-queue-changed"));
        } catch (e) {
            toast({ status: "error", title: "Napaka", description: e?.message || "Skrivanje ni uspelo." });
        }
    };

    return (
        <Box
            pl={10}
            py={2}
            position="relative"
            data-comment-id={reply?.id != null ? String(reply.id) : undefined}
        >
            <Box position="absolute" left="18px" top="0" bottom="0" w="2px" bg="gray.200" />

            <HStack align="flex-start" spacing={2}>
                <Avatar
                    src={buildAvatarDisplayUrl(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME, reply.user?.avatarUrl)}
                    size="xs"
                    name={reply.user?.username || "Anonim"}
                    bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
                    color="white"
                    sx={{
                      "& .chakra-avatar__initials": {
                        lineHeight: "1",
                        transform: "translateY(1px)",
                      },
                    }}
                />
                <VStack align="stretch" spacing={0} flex="1">
                    <HStack spacing={2} justify="space-between" align="center">
                        <HStack spacing={2}>
                            <Text fontSize="xs" fontWeight="600">
                                {reply.user?.username || "Anonim"}
                            </Text>
                            <Text fontSize="xs" color="gray.400">
                                {formatDate(reply.createdAt)}
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
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <MenuList>
                                    {!isOwnReply && (
                                        <MenuItem icon={<FiFlag />} onClick={() => onReport?.(reply)}>
                                            Prijavi neprimeren komentar
                                        </MenuItem>
                                    )}
                                    {canHide && !reply.isHidden && (
                                        <MenuItem icon={<FiEyeOff />} color="orange.700" onClick={handleHide}>
                                            Skrij komentar
                                        </MenuItem>
                                    )}
                                    {(isOwnReply || isAdmin) && (
                                        <MenuItem icon={<FiTrash2 />} color="red.600" onClick={() => onDelete?.(reply.id)}>
                                            {isAdmin && !isOwnReply ? "Izbriši komentar (Admin)" : "Odstrani komentar"}
                                        </MenuItem>
                                    )}
                                </MenuList>
                            </Menu>
                        )}
                    </HStack>
                    <Box pt={0.5}>
                        <ExpandableText
                            text={reply.content}
                            maxLines={6}
                            fontSize="sm"
                            color="gray.700"
                        />
                    </Box>
                    <HStack spacing={4} pt={1} flexWrap="wrap">
                        <ForumReactionSummary
                            likeCount={commentLikes?.[reply.id]?.count || 0}
                            isLiked={Boolean(commentLikes?.[reply.id]?.isLiked)}
                            isLiking={Boolean(likingComments?.[reply.id])}
                            onLike={async (e) => {
                                e?.stopPropagation?.();
                                if (support.myReaction) await react(support.myReaction);
                                onLike?.(reply.id, e);
                            }}
                            counts={support.counts}
                            myReaction={support.myReaction}
                            onReact={async (type, e) => {
                                e?.stopPropagation?.();
                                if (commentLikes?.[reply.id]?.isLiked) await onLike?.(reply.id, e);
                                react(type);
                            }}
                            reactingSupport={reactingSupport}
                            reactors={support.reactors}
                            reloadSupport={reloadSupport}
                            commentCount={0}
                        />
                    </HStack>
                </VStack>
            </HStack>
        </Box>
    );
}
