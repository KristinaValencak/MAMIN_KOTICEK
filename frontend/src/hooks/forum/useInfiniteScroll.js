import { useEffect, useRef } from "react";
import { throttle } from "../../utils/helpers";

const WINDOW_SCROLL_THROTTLE_MS = 200;
/** Kratek razmik med zaporednimi „append“ klici — ob kratki vsebini sentinel ostane v viewportu in sicer zverižni fetchi. */
const APPEND_COOLDOWN_MS = 500;

/**
 * @param {(append: boolean) => void} loadMore
 * @param {boolean} hasMore
 * @param {boolean} loading
 * @param {boolean} loadingMore
 * @param {string} [pauseWhenTruthy] — če je neprazen niz, scroll se ne sproži (npr. napačen zavihek)
 * @param {{ current: HTMLElement | null }} [rootRef] — scroll container; če manjka, uporabi window
 */
export const useInfiniteScroll = (loadMore, hasMore, loading, loadingMore, pauseWhenTruthy, rootRef) => {
  const sentinelRef = useRef(null);
  const lastAppendAtRef = useRef(0);

  useEffect(() => {
    if (pauseWhenTruthy) {
      lastAppendAtRef.current = 0;
      return;
    }
    if (!hasMore || loading || loadingMore) return;

    const fireAppend = () => {
      const now = Date.now();
      if (now - lastAppendAtRef.current < APPEND_COOLDOWN_MS) return;
      lastAppendAtRef.current = now;
      loadMore(true);
    };

    const root = rootRef?.current ?? null;
    const sentinel = sentinelRef.current;

    if (root && sentinel) {
      const io = new IntersectionObserver(
        (entries) => {
          const hit = entries.some((e) => e.isIntersecting);
          if (hit) fireAppend();
        },
        { root, rootMargin: "120px", threshold: 0 }
      );
      io.observe(sentinel);
      return () => io.disconnect();
    }

    const throttledHandleScroll = throttle(() => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      if (scrollTop + windowHeight >= documentHeight - 200) fireAppend();
    }, WINDOW_SCROLL_THROTTLE_MS, { leading: true, trailing: false });
    window.addEventListener("scroll", throttledHandleScroll, { passive: true });
    return () => window.removeEventListener("scroll", throttledHandleScroll);
  }, [hasMore, loading, loadingMore, pauseWhenTruthy, loadMore, rootRef]);

  return sentinelRef;
};
