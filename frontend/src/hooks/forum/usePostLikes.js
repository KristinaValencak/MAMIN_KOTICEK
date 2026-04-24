import { useState, useCallback } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { API_BASE } from "../../api/config";
import { getStoredUser } from "../../utils/helpers";
import { useAuthGate } from "../../context/AuthGateContext";

export const usePostLikes = () => {
  const [postLikes, setPostLikes] = useState({});
  const [likingPosts, setLikingPosts] = useState({});
  const { toast } = useAppToast();
  const { requestAuth } = useAuthGate();

  const handleLike = useCallback(async (postId, e) => {
    e?.stopPropagation();
    const user = getStoredUser();
    if (!user) {
      requestAuth({ tab: "login", reason: "Za lajkanje objave se morate prijaviti." });
      return;
    }
    setLikingPosts(prev => ({ ...prev, [postId]: true }));
    try {
      const r = await fetch(`${API_BASE}/api/posts/${postId}/likes`, {
        method: "POST",
        credentials: 'include'
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setPostLikes(prev => ({
        ...prev,
        [postId]: {
          count: data.action === "liked" ? (prev[postId]?.count || 0) + 1 : Math.max((prev[postId]?.count || 0) - 1, 0),
          isLiked: data.action === "liked",
          commentCount: prev[postId]?.commentCount ?? 0
        }
      }));
    } catch (e) {
      console.error(e);
      toast({ status: "error", title: "Napaka pri lajkanju." });
    } finally {
      setLikingPosts(prev => ({ ...prev, [postId]: false }));
    }
  }, [toast, requestAuth]);

  const updateLikesFromPosts = useCallback((posts) => {
    const likesMap = {};
    posts.forEach(post => {
      likesMap[post.id] = {
        count: post.likeCount || 0,
        isLiked: post.isLiked || false,
        commentCount: post.commentCount || 0
      };
    });
    setPostLikes(prev => ({ ...prev, ...likesMap }));
  }, []);

  return { postLikes, likingPosts, handleLike, updateLikesFromPosts };
};
