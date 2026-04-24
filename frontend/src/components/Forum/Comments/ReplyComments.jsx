import { useState, useEffect } from "react";
import { useAppToast } from "../../../context/ApiAlertModalContext.jsx";
import {Box, VStack, HStack, Text, Avatar, Button, IconButton, Textarea, FormControl, Checkbox, Collapse} from "@chakra-ui/react";
import { FaHeart, FaRegHeart, FaComment } from "react-icons/fa";
import { API_BASE } from "../../../api/config";
import { INPUT_LIMITS } from "../../../constants/inputLimits";
import ExpandableText from "../../common/ExpandableText";
import { useAuthGate } from "../../../context/AuthGateContext";
import { buildAvatarDisplayUrl } from "../../../utils/cloudinaryUpload";

export default function ReplyComments({
    parentCommentId,
    replies = [],
    onReplyAdded,
    user
}) {
    const [replyOpen, setReplyOpen] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [likes, setLikes] = useState({});
    const [liking, setLiking] = useState({});
    const { toast } = useAppToast();
    const { requestAuth } = useAuthGate();

    useEffect(() => {
        replies.forEach(r => loadLikes(r.id));
    }, [replies]);

    const loadLikes = async (id) => {
        const res = await fetch(`${API_BASE}/api/comments/${id}/likes`, {
            credentials: "include"
        });
        if (res.ok) {
            const data = await res.json();
            setLikes(p => ({ ...p, [id]: data }));
        }
    };

    const handleLike = async (id, e) => {
        e.stopPropagation();
        if (!user) {
            requestAuth({ tab: "login", reason: "Za lajkanje odgovora se morate prijaviti." });
            return;
        }
        setLiking(p => ({ ...p, [id]: true }));
        const res = await fetch(`${API_BASE}/api/comments/${id}/likes`, {
            method: "POST",
            credentials: "include"
        });
        if (res.ok) loadLikes(id);
        setLiking(p => ({ ...p, [id]: false }));
    };

    const submitReply = async () => {
        if (!replyText.trim()) return;
        if (!user) {
            requestAuth({ tab: "login", reason: "Za odgovor se morate prijaviti." });
            return;
        }
        setSubmitting(true);
        const res = await fetch(`${API_BASE}/api/comments/${parentCommentId}/replies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                content: replyText.trim(),
                isAnonymous: isAnonymous
            })
        });
        if (res.ok) {
            setReplyText("");
            setIsAnonymous(false);
            setReplyOpen(false);
            onReplyAdded?.();
            toast({ status: "success", title: "Odgovor dodan." });
        }
        setSubmitting(false);
    };

    return (
        <VStack
            align="stretch"
            spacing={3}
            mt={3}
            ml={6}
        >

            <Box
                position="relative"
                pl={4}
                _before={{
                    content: '""',
                    position: "absolute",
                    left: "6px",
                    top: "0",
                    bottom: "0",
                    width: "2px",
                    bg: "rgba(236,95,140,0.25)",
                    borderRadius: "full"
                }}
            >

                {replies.map(reply => (
                    <Box
                        key={reply.id}
                        bg="rgba(236,95,140,0.04)"
                        borderRadius="14px"
                        p={3}
                        mb={2}
                        border="1px solid rgba(236,95,140,0.12)"
                    >

                        {/* HEADER */}
                        <HStack spacing={2} mb={1}>
                            <Avatar
                                src={buildAvatarDisplayUrl(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME, reply.user?.avatarUrl)}
                                size="xs"
                                name={reply.user?.username || "Anonim"}
                                bgGradient="linear(135deg,#EC5F8C,#F48FB1)"
                                color="white"
                                sx={{
                                  "& .chakra-avatar__initials": {
                                    lineHeight: "1",
                                    transform: "translateY(1px)",
                                  },
                                }}
                            />
                            <Text fontSize="xs" fontWeight="600">
                                {reply.user?.username || "Anonim"}
                            </Text>
                            <Text fontSize="2xs" color="gray.400">
                                Odgovor
                            </Text>
                        </HStack>

                        <Box mb={2}>
                            <ExpandableText
                                text={reply.content}
                                maxLines={6}
                                fontSize="xs"
                                color="gray.700"
                            />
                        </Box>

                        <HStack justify="space-between">
                            <Text fontSize="2xs" color="gray.400">
                                {new Date(reply.createdAt).toLocaleString()}
                            </Text>

                            <HStack spacing={1}>
                                <IconButton
                                    size="2xs"
                                    variant="ghost"
                                    icon={likes[reply.id]?.isLiked ? <FaHeart /> : <FaRegHeart />}
                                    color={likes[reply.id]?.isLiked ? "red.500" : "gray.400"}
                                    onClick={(e) => handleLike(reply.id, e)}
                                    isLoading={liking[reply.id]}
                                />
                                <Text fontSize="2xs">
                                    {likes[reply.id]?.count || 0}
                                </Text>
                            </HStack>
                        </HStack>
                    </Box>
                ))}
            </Box>

            <Button
                size="xs"
                variant="ghost"
                leftIcon={<FaComment size="10px" />}
                alignSelf="flex-start"
                onClick={() => setReplyOpen(v => !v)}
            >
                Odgovori
            </Button>

            <Collapse in={replyOpen}>
                <Box pl={4}>
                    <Textarea
                        size="sm"
                        placeholder="Napiši odgovor…"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        maxLength={INPUT_LIMITS.COMMENT}
                    />
                    <Checkbox
                        mt={2}
                        isChecked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                    >
                        Objavi kot anonimen
                    </Checkbox>
                    <HStack mt={2}>
                        <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setReplyOpen(false)}
                        >
                            Prekliči
                        </Button>
                        <Button
                            size="xs"
                            onClick={submitReply}
                            isLoading={submitting}
                            bg="#EC5F8C"
                            color="white"
                        >
                            Objavi
                        </Button>
                    </HStack>
                </Box>
            </Collapse>

        </VStack>
    );
}
