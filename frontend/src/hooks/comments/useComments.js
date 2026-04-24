import { useState, useEffect, useCallback } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { API_BASE } from "../../api/config";
import { COMMENTS_FIRST_PAGE_LIMIT as DEFAULT_COMMENTS_PAGE } from "../../constants/forumPrefetch.js";

/**
 * @param {string|number} postId
 * @param {{
 *   deferMs?: number,
 *   enabled?: boolean,
 *   initialLimit?: number,
 * }} [options]
 * - deferMs: zakasnitev prvega fetcha (npr. da objava/slika dobi prednost).
 * - enabled: false = brez omrežja (npr. čakamo na viewport ali obrazec za odgovor).
 * - initialLimit: velikost prve strani + „Naloži več“ (privzeto iz forumPrefetch).
 */
export function useComments(postId, options = {}) {
    const enabled = options.enabled !== false;
    const deferMs =
        typeof options.deferMs === "number" && options.deferMs > 0 ? Math.min(options.deferMs, 5000) : 0;
    const pageSize = Math.min(
        Math.max(typeof options.initialLimit === "number" ? options.initialLimit : DEFAULT_COMMENTS_PAGE, 1),
        50
    );

    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(() => enabled);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const { toast } = useAppToast();

    useEffect(() => {
        if (!enabled) {
            setComments([]);
            setTotalCount(0);
            setHasMore(false);
            setLoading(false);
            return () => {};
        }

        let abort = false;
        let timeoutId = null;

        async function loadComments() {
            setLoading(true);
            try {
                const r = await fetch(`${API_BASE}/api/posts/${postId}/comments?limit=${pageSize}&offset=0`, {
                    credentials: 'include'
                });
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const data = await r.json();
                const list = data.items || [];
                if (!abort) {
                    setComments(list);
                    setTotalCount(data.pagination?.total || list.length);
                    setHasMore(list.length < (data.pagination?.total || list.length));
                }
            } catch (e) {
                console.error(e);
                if (!abort) toast({ status: "error", title: "Komentarjev ne morem prebrati." });
            } finally {
                if (!abort) setLoading(false);
            }
        }

        if (deferMs > 0) {
            timeoutId = setTimeout(() => {
                if (!abort) void loadComments();
            }, deferMs);
        } else {
            void loadComments();
        }

        return () => {
            abort = true;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [postId, deferMs, enabled, pageSize, toast]);

    const loadMoreComments = useCallback(async () => {
        if (loadingMore || !hasMore) return;

        setLoadingMore(true);
        try {
            const currentOffset = comments.length;
            const r = await fetch(`${API_BASE}/api/posts/${postId}/comments?limit=${pageSize}&offset=${currentOffset}`, {
                credentials: 'include'
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();
            const newComments = data.items || [];

            setComments(prev => {
                const updated = [...prev, ...newComments];
                const totalLoaded = updated.length;
                setHasMore(totalLoaded < totalCount);
                return updated;
            });
        } catch (e) {
            console.error(e);
            toast({ status: "error", title: "Napaka pri nalaganju komentarjev." });
        } finally {
            setLoadingMore(false);
        }
    }, [postId, hasMore, loadingMore, totalCount, comments.length, toast, pageSize]);

    const addComment = async (content, isAnonymous) => {
        try {
            const r = await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify({ content: content.trim(), isAnonymous }),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const newComment = await r.json();
            setComments((prev) => [newComment, ...prev]);
            setTotalCount(prev => prev + 1);
            toast({ status: "success", title: "Komentar dodan." });
            return newComment;
        } catch (e) {
            console.error(e);
            toast({ status: "error", title: "Komentarja ni bilo mogoče dodati." });
            return null;
        }
    };

    const deleteComment = async (commentId) => {
        try {
            const res = await fetch(`${API_BASE}/api/comments/${commentId}`, {
                method: "DELETE",
                credentials: 'include'
            });
            if (res.ok) {
                setComments(prev => prev.filter(comm => comm.id !== commentId));
                setTotalCount(prev => Math.max(0, prev - 1));
                toast({ status: "success", title: "Komentar izbrisan" });
                return true;
            }
            return false;
        } catch {
            toast({ status: "error", title: "Napaka pri brisanju" });
            return false;
        }
    };

    const toggleFeature = async (commentId, isFeatured) => {
        try {
            const res = await fetch(`${API_BASE}/api/comments/${commentId}/feature`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify({ isFeatured })
            });
            if (res.ok) {
                const data = await res.json();
                setComments(prev => prev.map(comm =>
                    comm.id === commentId ? { ...comm, isFeatured: data.isFeatured } : comm
                ));
                toast({
                    status: "success",
                    title: data.isFeatured ? "Komentar označen kot najboljši tedna" : "Označba odstranjena"
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

    const reloadComments = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/posts/${postId}/comments?limit=${pageSize}&offset=0`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                const list = data.items || [];
                setComments(list);
                setTotalCount(data.pagination?.total || list.length);
                setHasMore(list.length < (data.pagination?.total || list.length));
            }
        } catch (e) {
            console.error(e);
        }
    }, [postId, pageSize]);

    return {
        comments,
        loading,
        loadingMore,
        hasMore,
        totalCount,
        loadMoreComments,
        addComment,
        deleteComment,
        toggleFeature,
        reloadComments,
        setComments
    };
}