import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "../../api/config";

const featuredFetchInit = { credentials: "include" };

export const useFeaturedContent = () => {
  const [featuredPost, setFeaturedPost] = useState(null);
  const [featuredComment, setFeaturedComment] = useState(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [loadingComment, setLoadingComment] = useState(true);

  const loadFeaturedPost = useCallback(async (signal) => {
    setLoadingPost(true);
    try {
      const postRes = await fetch(`${API_BASE}/api/posts/featured`, {
        ...featuredFetchInit,
        signal,
      });
      if (!postRes.ok) throw new Error("Napaka pri branju featured objave");
      const postData = await postRes.json();
      if (postData.post) setFeaturedPost(postData.post);
      else setFeaturedPost(null);
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error(e);
      setFeaturedPost(null);
    } finally {
      setLoadingPost(false);
    }
  }, []);

  const loadFeaturedComment = useCallback(async (signal) => {
    setLoadingComment(true);
    try {
      const commentRes = await fetch(`${API_BASE}/api/comments/featured`, {
        ...featuredFetchInit,
        signal,
      });
      if (commentRes.ok) {
        const commentData = await commentRes.json();
        if (commentData.comment) setFeaturedComment(commentData.comment);
        else setFeaturedComment(null);
      } else {
        setFeaturedComment(null);
      }
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error(e);
      setFeaturedComment(null);
    } finally {
      setLoadingComment(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    loadFeaturedPost(ac.signal);
    return () => ac.abort();
  }, [loadFeaturedPost]);

  useEffect(() => {
    const ac = new AbortController();
    loadFeaturedComment(ac.signal);
    return () => ac.abort();
  }, [loadFeaturedComment]);

  useEffect(() => {
    const handleFeaturedChange = () => {
      loadFeaturedPost();
      loadFeaturedComment();
    };
    const handleAuthChanged = () => {
      loadFeaturedPost();
      loadFeaturedComment();
    };
    window.addEventListener("featured-changed", handleFeaturedChange);
    window.addEventListener("auth-changed", handleAuthChanged);
    return () => {
      window.removeEventListener("featured-changed", handleFeaturedChange);
      window.removeEventListener("auth-changed", handleAuthChanged);
    };
  }, [loadFeaturedPost, loadFeaturedComment]);

  return { featuredPost, featuredComment, loadingPost, loadingComment };
};
