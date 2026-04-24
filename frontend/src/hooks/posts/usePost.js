import { useState, useEffect } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { API_BASE } from "../../api/config";
import { useAuthGate } from "../../context/AuthGateContext";
import { mapFeedPostToDetailPreview } from "../../utils/mapFeedPostToDetailPreview";
import { peekPostDetailCache, seedPostDetailCache } from "../../utils/postDetailPrefetch";

/**
 * @param {string|number} postId
 * @param {object|null} [previewPost] — objava z lista (feed / profil); takojšen UI + ista slika kot na kartici do polnega fetcha
 */
export function usePost(postId, previewPost = null) {
  const previewMatch =
    Boolean(previewPost) && postId != null && String(previewPost.id) === String(postId);

  const [post, setPost] = useState(() => {
    if (previewMatch) return mapFeedPostToDetailPreview(previewPost);
    const cached = peekPostDetailCache(postId);
    return cached || null;
  });
  const [loading, setLoading] = useState(() => {
    if (previewMatch) return false;
    return !peekPostDetailCache(postId);
  });
  /** Po prvem uspešnem GET: true; če začnemo s predogledom z lista, false dokler fetch ne konča (za zamenjavo feed→detail slike). */
  const [fullDetailSynced, setFullDetailSynced] = useState(() => {
    if (previewMatch) return false;
    return Boolean(peekPostDetailCache(postId));
  });
  const [error, setError] = useState("");
  const [likes, setLikes] = useState(() => {
    const p = previewMatch
      ? mapFeedPostToDetailPreview(previewPost)
      : peekPostDetailCache(postId);
    if (p && typeof p.likeCount === "number") {
      return { count: p.likeCount, isLiked: Boolean(p.isLiked) };
    }
    return { count: 0, isLiked: false };
  });
  const [liking, setLiking] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const { toast } = useAppToast();
  const { requestAuth } = useAuthGate();

  useEffect(() => {
    let abort = false;
    const pm =
      Boolean(previewPost) && postId != null && String(previewPost.id) === String(postId);
    const cached = !pm ? peekPostDetailCache(postId) : null;
    const hadBootstrap = pm || Boolean(cached);

    if (pm) setFullDetailSynced(false);

    async function loadPost() {
      if (!hadBootstrap) setLoading(true);
      setError("");
      try {
        const r = await fetch(`${API_BASE}/api/posts/${postId}`, {
          credentials: "include",
        });
        if (!r.ok) {
          if (r.status === 404) throw new Error("Objava ne obstaja ali je izbrisana.");
          throw new Error(`HTTP ${r.status}`);
        }
        const data = await r.json();
        if (!abort) {
          seedPostDetailCache(postId, data);
          setPost(data);
          if (typeof data.likeCount === "number") {
            setLikes({ count: data.likeCount, isLiked: Boolean(data.isLiked) });
          } else {
            setLikes({ count: 0, isLiked: false });
          }
          setFullDetailSynced(true);
        }
      } catch (e) {
        console.error(e);
        if (!abort) {
          if (hadBootstrap) {
            setError("");
            toast({
              status: "warning",
              title: "Podatki morda niso najnovejši",
              description: "Povezava do strežnika je spodletela. Osvežite stran ali poskusite znova.",
              isClosable: true,
            });
          } else {
            setError(e?.message || "Ne morem prebrati objave.");
          }
        }
      } finally {
        if (!abort) setLoading(false);
      }
    }
    loadPost();
    return () => {
      abort = true;
    };
  }, [postId, previewPost?.id]);

  const handleLike = async () => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user) {
      requestAuth({ tab: "login", reason: "Za lajkanje objave se morate prijaviti." });
      return;
    }

    setLiking(true);
    try {
      const r = await fetch(`${API_BASE}/api/posts/${postId}/likes`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();

      setLikes((prev) => ({
        count: data.action === "liked" ? prev.count + 1 : prev.count - 1,
        isLiked: data.action === "liked",
      }));
    } catch (e) {
      console.error(e);
      toast({ status: "error", title: "Napaka pri lajkanju." });
    } finally {
      setLiking(false);
    }
  };

  const deletePost = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        toast({ status: "success", title: "Objava izbrisana" });
        return true;
      }
      return false;
    } catch {
      toast({ status: "error", title: "Napaka pri brisanju" });
      return false;
    }
  };

  const toggleFavorite = async () => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user) {
      requestAuth({ tab: "login", reason: "Za shranjevanje med priljubljene se morate prijaviti." });
      return;
    }
    if (!post) return;
    const prevFav = Boolean(post.isFavorited);
    const nextFav = !prevFav;
    setPost((p) => (p ? { ...p, isFavorited: nextFav } : p));
    setFavoriting(true);
    try {
      const r = await fetch(`${API_BASE}/api/posts/${postId}/favorite`, {
        method: nextFav ? "POST" : "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      console.error(e);
      setPost((p) => (p ? { ...p, isFavorited: prevFav } : p));
      toast({ status: "error", title: "Napaka pri priljubljeni objavi." });
    } finally {
      setFavoriting(false);
    }
  };

  const toggleFeature = async (isFeatured) => {
    try {
      const res = await fetch(`${API_BASE}/api/posts/${postId}/feature`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isFeatured }),
      });
      if (res.ok) {
        const data = await res.json();
        setPost((prev) => ({ ...prev, isFeatured: data.isFeatured }));
        toast({
          status: "success",
          title: data.isFeatured ? "Objava označena kot najboljša tedna" : "Označba odstranjena",
        });
        window.dispatchEvent(new Event("featured-changed"));
        return data.isFeatured;
      }
      return null;
    } catch {
      toast({ status: "error", title: "Napaka pri označevanju" });
      return null;
    }
  };

  return {
    post,
    loading,
    error,
    likes,
    liking,
    favoriting,
    handleLike,
    deletePost,
    toggleFavorite,
    toggleFeature,
    setPost,
    fullDetailSynced,
  };
}
