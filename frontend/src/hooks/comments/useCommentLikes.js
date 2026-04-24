import { useState, useEffect, useCallback } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { API_BASE } from "../../api/config";
import { useAuthGate } from "../../context/AuthGateContext";

export function useCommentLikes(comments) {
    const [commentLikes, setCommentLikes] = useState({});
    const [likingComments, setLikingComments] = useState({});
    const { toast } = useAppToast();
    const { requestAuth } = useAuthGate();

    useEffect(() => {
        const next = {};
        for (const c of comments) {
            if (c?.id == null) continue;
            next[c.id] = {
                count: typeof c.likeCount === "number" ? c.likeCount : 0,
                isLiked: Boolean(c.isLiked),
            };
        }
        setCommentLikes(next);
    }, [comments]);

    const handleLike = useCallback(async (commentId, e) => {
        if (e) e.stopPropagation();
        const user = JSON.parse(localStorage.getItem("user") || "null");
        if (!user) {
            requestAuth({ tab: "login", reason: "Za lajkanje komentarja se morate prijaviti." });
            return;
        }

        setLikingComments((prev) => ({ ...prev, [commentId]: true }));
        try {
            const res = await fetch(`${API_BASE}/api/comments/${commentId}/likes`, {
                method: "POST",
                credentials: "include",
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            setCommentLikes((prev) => ({
                ...prev,
                [commentId]: {
                    count:
                        data.action === "liked"
                            ? (prev[commentId]?.count || 0) + 1
                            : Math.max((prev[commentId]?.count || 0) - 1, 0),
                    isLiked: data.action === "liked",
                },
            }));
        } catch (err) {
            console.error(err);
            toast({ status: "error", title: "Napaka pri lajkanju." });
        } finally {
            setLikingComments((prev) => ({ ...prev, [commentId]: false }));
        }
    }, [toast, requestAuth]);

    return {
        commentLikes,
        likingComments,
        handleLike,
    };
}
