import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Box, Flex, HStack, VStack, IconButton, Button, Image, Heading, Menu, MenuButton, MenuList, MenuItem, Avatar, Text, Stack, useDisclosure, Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerBody, DrawerCloseButton, Container, Divider, Badge, useBreakpointValue, Link, Spinner, Center, Icon, Portal } from "@chakra-ui/react";
import { HamburgerIcon, CloseIcon, ChevronDownIcon, BellIcon } from "@chakra-ui/icons";
import { Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import Logo from "../../assets/Logo.webp";
import { FiUser, FiLogOut, FiSettings, FiHeart, FiMessageCircle, FiUserPlus, FiShield, FiEyeOff, FiHome, FiShoppingBag, FiStar } from "react-icons/fi";
import { API_BASE } from "../../api/config";
import { getStoredUser, profilePathForUserId } from "../../utils/helpers";
import { buildAvatarDisplayUrl } from "../../utils/cloudinaryUpload";
import { invalidateUserSessionCache } from "../../utils/userSession";
import { canAccessModeration } from "../../utils/authz";
import { useAuthGate } from "../../context/AuthGateContext";
import { fetchModerationReports, fetchPendingAppealsCount } from "../../api/moderation";
import { FaInstagram, FaFacebookF } from "react-icons/fa";
import { OPEN_LISTING_DETAIL_MODAL } from "../Marketplace/marketplaceModalConstants";

const NOTIF_PAGE = 20;
const NOTIF_FEED_DAYS = 7;
const FRIEND_REQUEST_UPDATED_EVENT = "friend-request-updated";

const hideScrollbarSx = {
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  WebkitOverflowScrolling: "touch",
  "&::-webkit-scrollbar": {
    display: "none",
  },
};

function formatTimeAgo(iso) {
  if (!iso) return "";
  const raw = iso instanceof Date ? iso.toISOString() : String(iso);
  const s = raw.trim();
  if (!s) return "";

  // If timestamp has no timezone, treat it as UTC to avoid local-time shifts (common +2h bug).
  const noTz =
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s) &&
    !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s);
  const normalized = noTz ? s.replace(" ", "T") + "Z" : s;

  const t = new Date(normalized).getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 45) return "prav zdaj";
  if (sec < 3600) return `pred ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `pred ${Math.floor(sec / 3600)} h`;
  if (sec < 604800) return `pred ${Math.floor(sec / 86400)} d`;
  return new Date(iso).toLocaleDateString("sl-SI", { day: "numeric", month: "short" });
}

function parseActors(actors) {
  if (Array.isArray(actors)) return actors.filter((a) => a && typeof a === "object");
  if (typeof actors === "string") {
    try {
      const p = JSON.parse(actors);
      return Array.isArray(p) ? p.filter((a) => a && typeof a === "object") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseNotificationIds(ids) {
  if (Array.isArray(ids)) return ids;
  if (typeof ids === "string") {
    try {
      const p = JSON.parse(ids);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function resolveLikeGroupCount(notif, actors, ids) {
  const raw = notif.likeCount ?? notif.likecount;
  let n = 0;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    n = Math.floor(raw);
  } else if (raw != null && String(raw).trim() !== "") {
    const p = Number.parseInt(String(raw), 10);
    if (Number.isFinite(p) && p >= 0) n = p;
  }
  return Math.max(n, actors.length, ids.length, 1);
}

function formatLikeActivityText(notif) {
  const actors = parseActors(notif.actors ?? notif.Actors);
  const ids = parseNotificationIds(notif.notificationIds ?? notif.notificationids);
  const count = resolveLikeGroupCount(notif, actors, ids);
  const nameAt = (i) => actors[i]?.username || (i === 0 ? notif.actorUsername : null) || "Nekdo";
  if (count <= 1) {
    return `${nameAt(0)} je všečkala tvojo objavo`;
  }
  if (count === 2) {
    const a = nameAt(0);
    if (actors.length >= 2 && String(actors[0]?.id) !== String(actors[1]?.id)) {
      const b = actors[1]?.username || "Nekdo";
      return `${a} in ${b} sta všečkali tvojo objavo`;
    }
    return `${a} in še 1 sta všečkali tvojo objavo`;
  }
  const first = nameAt(0);
  const others = count - 1;
  return `${first} in še ${others} so všečkali tvojo objavo`;
}

function notificationPresentation(notif) {
  const t = String(notif?.type || "").trim();

  if (t === "friend_request") {
    return {
      icon: FiUserPlus,
      accentColor: "pink.500",
      title: "Prošnja za prijateljstvo",
      subtitle: notif.actorUsername ? `${notif.actorUsername} želi biti tvoj prijatelj` : "Nova prošnja za prijateljstvo",
    };
  }

  if (t === "friend_accept") {
    return {
      icon: FiUserPlus,
      accentColor: "pink.500",
      title: "Prošnja sprejeta",
      subtitle: notif.actorUsername
        ? `${notif.actorUsername} je sprejela tvojo prošnjo za prijateljstvo`
        : "Tvoja prošnja za prijateljstvo je bila sprejeta",
    };
  }

  if (t === "support_react") {
    const rt = String(notif?.metadata?.reactionType || "").trim();
    const emoji =
      rt === "support" ? "💗" :
      rt === "hug" ? "🤗" :
      rt === "understand" ? "🌸" :
      rt === "together" ? "🥰" :
      "✨";
    return {
      icon: FiHeart,
      accentColor: "pink.500",
      title: "Nova podpora",
      subtitle: notif.actorUsername ? `${notif.actorUsername} je reagirala ${emoji}` : `Nova reakcija ${emoji}`,
    };
  }

  if (t === "appeal_resolved") {
    const decision = String(notif?.metadata?.decision || "").trim().toLowerCase();
    const tt = String(notif?.metadata?.targetType || "").trim();
    const tl =
      tt === "post"
        ? "objavo"
        : tt === "comment"
          ? "komentar"
          : tt === "marketplace_listing"
            ? "oglas"
            : tt === "user_profile"
              ? "profil"
              : "vsebino";
    return {
      icon: FiShield,
      accentColor: decision === "reversed" ? "green.500" : "orange.500",
      title:
        decision === "reversed"
          ? "Zahtevek za pregled je bil sprejet"
          : decision === "upheld"
            ? "Zahtevek za pregled je bil zavrnjen"
            : "Zahtevek za pregled",
      subtitle:
        decision === "reversed"
          ? "Vsebina je ponovno vidna skupnosti."
          : decision === "upheld"
            ? "Vsebina ostaja skrita."
            : "Odgovor na zahtevek za pregled",
    };
  }

  const isLike = t === "like";
  const isReply = t === "reply";
  const isPostHidden = t === "post_hidden";
  const isCommentHidden = t === "comment_hidden";
  const isListingHidden = t === "listing_hidden";
  const isModerationHideAny = isPostHidden || isCommentHidden || isListingHidden;

  if (isModerationHideAny) {
    return {
      icon: FiEyeOff,
      accentColor: "orange.500",
      title: isPostHidden
        ? "Vaša objava je začasno skrita"
        : isCommentHidden
          ? "Vaš komentar je začasno skrit"
          : "Vaš oglas je začasno skrit",
      subtitle:
        "Ker lahko krši pravila skupnosti, je vsebina začasno skrita. Če menite, da gre za napako, lahko zahtevate pregled.",
    };
  }

  if (t === "post_unhidden" || t === "comment_unhidden" || t === "listing_unhidden") {
    return {
      icon: FiShield,
      accentColor: "green.500",
      title:
        t === "post_unhidden"
          ? "Vaša objava je ponovno vidna"
          : t === "comment_unhidden"
            ? "Vaš komentar je ponovno viden"
            : "Vaš oglas je ponovno viden",
      subtitle: "Vsebino smo pregledali in je ponovno vidna skupnosti.",
    };
  }

  if (t === "profile_suspended") {
    return {
      icon: FiShield,
      accentColor: "orange.500",
      title: "Vaš profil je začasno onemogočen",
      subtitle: "Če menite, da gre za napako, lahko zahtevate pregled.",
    };
  }

  if (t === "profile_unsuspended") {
    return {
      icon: FiShield,
      accentColor: "green.500",
      title: "Vaš profil je ponovno aktiven",
      subtitle: "Profil je ponovno dostopen.",
    };
  }

  if (isLike) {
    return {
      icon: FiHeart,
      accentColor: "pink.500",
      title: "Všečki",
      subtitle: formatLikeActivityText(notif),
    };
  }

  if (t === "comment") {
    return {
      icon: FiMessageCircle,
      accentColor: "purple.500",
      title: "Nov komentar",
      subtitle: notif.actorUsername ? `${notif.actorUsername} je komentiral/a tvojo objavo` : "Nov komentar na tvoji objavi",
    };
  }

  if (isReply) {
    return {
      icon: FiMessageCircle,
      accentColor: "purple.500",
      title: "Nov odgovor",
      subtitle: notif.actorUsername ? `${notif.actorUsername} je odgovoril/a na tvoj komentar` : "Nov odgovor na tvoj komentar",
    };
  }

  return {
    icon: FiMessageCircle,
    accentColor: "purple.500",
    title: "Novo obvestilo",
    subtitle: notif.actorUsername ? `Od: ${notif.actorUsername}` : "",
  };
}

function notificationRoute(notif) {
  const t = String(notif?.type || "").trim();
  const notifId = notif?.id != null ? String(notif.id) : null;
  const mt = String(notif?.metadata?.targetType || "").trim();
  const midRaw = notif?.metadata?.targetId;
  const metaTargetId =
    midRaw != null && String(midRaw).trim() !== "" && Number.isFinite(Number(midRaw)) ? Number(midRaw) : null;
  const bannerKey =
    (notif?.metadata?.bannerKey != null && String(notif.metadata.bannerKey).trim() !== "")
      ? String(notif.metadata.bannerKey).trim()
      : null;

  if (t === "friend_request") {
    if (notif.actorId != null) return profilePathForUserId(notif.actorId);
    return "/nastavitve?section=notifications";
  }

  if (t === "friend_accept") {
    if (notif.actorId != null) return profilePathForUserId(notif.actorId);
    return "/nastavitve?section=notifications";
  }

  if (t === "listing_hidden" || t === "listing_unhidden") {
    const listingId = metaTargetId;
    if (listingId != null) {
      window.dispatchEvent(
        new CustomEvent(OPEN_LISTING_DETAIL_MODAL, {
          detail: { listingId, notifId, bannerKey: bannerKey || (t === "listing_unhidden" ? "unhidden" : "hidden") },
        })
      );
    }
    return null;
  }

  if (t === "profile_suspended" || t === "profile_unsuspended") {
    const uid = metaTargetId;
    if (uid != null) {
      const params = new URLSearchParams();
      if (notifId) params.set("notif", notifId);
      params.set("banner", bannerKey || (t === "profile_suspended" ? "suspended" : "unsuspended"));
      // If this is MY profile, open personal profile (owner UX: request review).
      const me = getStoredUser();
      if (me?.id != null && Number(me.id) === Number(uid)) {
        return `/profile?${params.toString()}`;
      }
      return `/user/${uid}?${params.toString()}`;
    }
    return "/nastavitve?section=notifications";
  }

  if (t === "appeal_resolved") {
    const decision = String(notif?.metadata?.decision || "").trim().toLowerCase();
    const params = new URLSearchParams();
    if (notifId) params.set("notif", notifId);
    if (decision === "reversed") params.set("banner", "unhidden");
    else if (decision === "upheld") params.set("banner", "appeal_upheld");
    else if (bannerKey) params.set("banner", bannerKey);

    if (mt === "marketplace_listing" && metaTargetId != null) {
      window.dispatchEvent(
        new CustomEvent(OPEN_LISTING_DETAIL_MODAL, {
          detail: { listingId: metaTargetId, notifId, bannerKey: params.get("banner") || bannerKey || null },
        })
      );
      return null;
    }

    if (mt === "user_profile" && metaTargetId != null) {
      const me = getStoredUser();
      if (me?.id != null && Number(me.id) === Number(metaTargetId)) {
        return `/profile?${params.toString()}`;
      }
      return `/user/${metaTargetId}?${params.toString()}`;
    }

    // Default to forum post route (supports comment deep-link via notif.commentId).
    const pid =
      notif.postId != null && String(notif.postId).trim() !== ""
        ? String(notif.postId)
        : mt === "post" && metaTargetId != null
          ? String(metaTargetId)
          : null;
    if (!pid) return "/nastavitve?section=notifications";
    params.set("post", pid);
    if (notif.commentId != null && String(notif.commentId).trim() !== "") {
      params.set("comment", String(notif.commentId));
    }
    return `/?${params.toString()}`;
  }

  if (
    t === "like" ||
    t === "comment" ||
    t === "reply" ||
    t === "post_hidden" ||
    t === "comment_hidden" ||
    t === "post_unhidden" ||
    t === "comment_unhidden" ||
    t === "support_react"
  ) {
    const pid = notif.postId;
    if (pid == null || String(pid).trim() === "") return "/nastavitve?section=notifications";
    const params = new URLSearchParams();
    params.set("post", String(pid));
    // Optional: future-proofing for scroll-to-comment.
    if (notif.commentId != null && String(notif.commentId).trim() !== "") {
      params.set("comment", String(notif.commentId));
    }
    if (notifId) params.set("notif", notifId);
    if (bannerKey) params.set("banner", bannerKey);
    return `/?${params.toString()}`;
  }

  return "/nastavitve?section=notifications";
}

function HamburgerDrawerFooter({ onClose }) {
  const close = typeof onClose === "function" ? onClose : undefined;
  return (
    <Stack spacing={3} pt={1}>
      <Divider borderColor="rgba(255, 255, 255, 0.2)" />
      <Text fontSize="xs" fontWeight="800" color="whiteAlpha.800" letterSpacing="0.06em" px={1}>
        Skupnost
      </Text>
      <Text fontSize="sm" color="whiteAlpha.900" lineHeight="1.65" px={1}>
        Mamin kotiček je varen prostor za vse mamice, kjer delimo izkušnje, podporo in toplino – ker je materinstvo lažje skupaj.
      </Text>
      <Stack spacing={1} px={1}>
        {[
          { to: "/o-nas", label: "O maminem kotičku", weight: 400 },
          { to: "/pogoji-uporabe", label: "Pogoji uporabe", weight: 500 },
          { to: "/politika-zasebnosti", label: "Politika zasebnosti", weight: 500 },
          { to: "/politika-piskotkov", label: "Politika piškotkov", weight: 500 },
        ].map((l) => (
          <Link
            key={l.to}
            as={RouterLink}
            to={l.to}
            onClick={close}
            fontSize="xs"
            color="whiteAlpha.950"
            fontWeight={l.weight}
            lineHeight="1.5"
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
            _focusVisible={{ boxShadow: "0 0 0 3px rgba(255,255,255,0.22)" }}
            w="full"
            px={0}
            py={0.5}
            rounded="md"
            _active={{ bg: "rgba(255,255,255,0.10)" }}
            _hover={{ bg: "rgba(255,255,255,0.10)", color: "white" }}
          >
            {l.label}
          </Link>
        ))}
      </Stack>
      <HStack spacing={3} justify="center" py={2}>
        {[
          { icon: FaFacebookF, label: "Facebook", href: "#" },
          { icon: FaInstagram, label: "Instagram", href: "https://www.instagram.com/mamin.koticek?igsh=ZW10Mm13NG9jcmV4" },
        ].map(({ icon: I, label, href }) => (
          <Link key={label} href={href} isExternal aria-label={label} onClick={close}>
            <Box
              p={2.5}
              bg="rgba(255,255,255,0.15)"
              rounded="full"
              border="1px solid"
              borderColor="rgba(255,255,255,0.25)"
              _hover={{ bg: "rgba(255,255,255,0.25)" }}
              transition="background 0.2s"
            >
              <Icon as={I} boxSize={4} color="white" />
            </Box>
          </Link>
        ))}
      </HStack>
      <Text fontSize="xs" color="whiteAlpha.700" textAlign="center" px={2}>
        © {new Date().getFullYear()} Mamin kotiček. Vse pravice pridržane.
      </Text>
    </Stack>
  );
}

const NavbarForum = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [user, setUser] = useState(getStoredUser());
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { requestAuth } = useAuthGate();
  const authButtonsUseModal = location.pathname === "/";
  const headingSize = useBreakpointValue({ base: "sm", md: "md" });
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsLoadingMore, setNotificationsLoadingMore] = useState(false);
  const [notificationsHasMore, setNotificationsHasMore] = useState(true);
  const notifOffsetRef = useRef(0);
  const notifHasMoreRef = useRef(true);
  const notifLoadingRef = useRef(false);
  const notifLoadingMoreRef = useRef(false);
  const notifBootstrapDoneRef = useRef(false);

  useEffect(() => {
    notifHasMoreRef.current = notificationsHasMore;
  }, [notificationsHasMore]);

  useEffect(() => {
    if (!user?.id) {
      notifBootstrapDoneRef.current = false;
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    notifBootstrapDoneRef.current = false;
    setNotifications([]);
  }, [user?.id]);
  const [modPendingCount, setModPendingCount] = useState(null);

  const loadModerationPendingCount = useCallback(async () => {
    const u = getStoredUser();
    if (!canAccessModeration(u)) {
      setModPendingCount(null);
      return;
    }
    try {
      const [rep, app] = await Promise.all([
        fetchModerationReports({ status: "pending", limit: 1, offset: 0 }),
        fetchPendingAppealsCount().catch(() => ({ count: 0 })),
      ]);
      const nReports = typeof rep.pagination?.total === "number" ? rep.pagination.total : 0;
      const nAppeals = typeof app.count === "number" ? app.count : 0;
      setModPendingCount(nReports + nAppeals);
    } catch {
      setModPendingCount(null);
    }
  }, []);

  const fetchNotifications = useCallback(
    async (append = false) => {
      if (!user) return;
      let fetchSucceeded = false;
      try {
        if (append) {
          if (notifLoadingMoreRef.current || !notifHasMoreRef.current) return;
          notifLoadingMoreRef.current = true;
          setNotificationsLoadingMore(true);
        } else {
          if (notifLoadingRef.current) return;
          notifLoadingRef.current = true;
          if (!notifBootstrapDoneRef.current) {
            setNotificationsLoading(true);
          }
          setNotificationsHasMore(true);
          notifHasMoreRef.current = true;
          notifOffsetRef.current = 0;
        }
        const offset = append ? notifOffsetRef.current : 0;
        const res = await fetch(
          `${API_BASE}/api/notifications?limit=${NOTIF_PAGE}&offset=${offset}&days=${NOTIF_FEED_DAYS}`,
          { credentials: "include" }
        );
        let data = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }
        if (res.status === 401) {
          setNotifications([]);
          setUnreadCount(0);
          notifBootstrapDoneRef.current = false;
          return;
        }
        if (!res.ok) throw new Error(data.error || data.message || "Napaka pri branju notifikacij");
        const batch = data.items || [];
        const total = data.pagination?.total ?? batch.length;
        const hasMore = offset + batch.length < total;
        notifHasMoreRef.current = hasMore;
        setNotificationsHasMore(hasMore);
        setNotifications((prev) => {
          const next = append ? [...prev, ...batch] : batch;
          notifOffsetRef.current = next.length;
          return next;
        });
        if (typeof data.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
        } else if (!append) {
          setUnreadCount(0);
        }
        fetchSucceeded = true;
      } catch (err) {
        console.error(err);
      } finally {
        notifLoadingRef.current = false;
        notifLoadingMoreRef.current = false;
        setNotificationsLoading(false);
        setNotificationsLoadingMore(false);
        if (!append && fetchSucceeded) {
          notifBootstrapDoneRef.current = true;
        }
      }
    },
    [user]
  );

  const loadMoreNotifications = useCallback(() => {
    fetchNotifications(true);
  }, [fetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/read-all`, { method: "PUT", credentials: "include" });
      if (!res.ok) return;
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      if (typeof data.unreadCount === "number") setUnreadCount(data.unreadCount);
      else setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const markNotificationRead = useCallback(
    async (notif) => {
      const t = String(notif?.type || "").trim();
      try {
        if (t === "like") {
          const res = await fetch(`${API_BASE}/api/notifications/read-likes`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ postId: notif.postId }),
          });
          let data = {};
          try {
            data = await res.json();
          } catch {
            data = {};
          }
          if (!res.ok) throw new Error(data.error || data.message || "Napaka pri označevanju notifikacije");
          if (typeof data.unreadCount === "number") setUnreadCount(data.unreadCount);
          return;
        }

        const res = await fetch(`${API_BASE}/api/notifications/${encodeURIComponent(String(notif.id))}/read`, {
          method: "PUT",
          credentials: "include",
        });
        let data = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }
        if (!res.ok) throw new Error(data.error || data.message || "Napaka pri označevanju notifikacije");
        if (typeof data.unreadCount === "number") setUnreadCount(data.unreadCount);
      } catch {
        // If read failed, immediately resync from server so we don't "flip back" later.
        fetchNotifications(false);
      }
    },
    [fetchNotifications]
  );

  useEffect(() => {
    const onFriendRequestUpdated = (e) => {
      const d = e?.detail || {};
      // Keep the list fresh so the badge and read-state can sync.
      fetchNotifications(false);
    };

    window.addEventListener(FRIEND_REQUEST_UPDATED_EVENT, onFriendRequestUpdated);
    return () => window.removeEventListener(FRIEND_REQUEST_UPDATED_EVENT, onFriendRequestUpdated);
  }, [fetchNotifications]);

  useEffect(() => {
    if (user) {
      fetchNotifications(false);
      const interval = setInterval(() => fetchNotifications(false), 30000);
      return () => {
        clearInterval(interval);
      };
    }
  }, [user, fetchNotifications]);

  useEffect(() => {
    let raf = 0;
    const handleScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setScrolled(window.scrollY > 10);
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    const sync = () => setUser(getStoredUser());
    const onStorage = (e) => { if (e.key === "user") sync(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("auth-changed", sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth-changed", sync);
    };
  }, []);

  useEffect(() => {
    const u = getStoredUser();
    if (!u || !canAccessModeration(u)) return undefined;
    loadModerationPendingCount();
    const onQueue = () => loadModerationPendingCount();
    window.addEventListener("moderation-queue-changed", onQueue);
    const t = setInterval(loadModerationPendingCount, 60000);
    return () => {
      window.removeEventListener("moderation-queue-changed", onQueue);
      clearInterval(t);
    };
  }, [user, loadModerationPendingCount]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/logout`, { method: "POST", credentials: 'include' });
    } catch (err) {
      console.error("Napaka pri odjavi:", err);
    }
    localStorage.removeItem("user");
    invalidateUserSessionCache();
    window.dispatchEvent(new Event("auth-changed"));
    setUser(null);
    navigate("/");
  }, [navigate]);

  const displayName = useMemo(() => {
    if (!user?.username) return "";
    return user.username.length > 15 ? user.username.slice(0, 14) + "…" : user.username;
  }, [user]);

  const Left = (
    <HStack spacing={3} minW={0} flex={{ base: 1, md: "none" }} overflow="hidden" align="center">
      <Link as={RouterLink} to="/" flexShrink={0} _hover={{ transform: "scale(1.05)", transition: "all 0.2s" }}>
        <Image
          src={Logo}
          alt="Mamin kotiček"
          boxSize={{ base: "40px", md: "52px" }}
          objectFit="contain"
          transition="transform 0.2s"
        />
      </Link>
      <Box minW={0} flex={1} overflow="hidden" display={{ base: "block", md: "none" }}>
        <Heading
          as={RouterLink}
          to="/"
          size={headingSize}
          color="white"
          noOfLines={1}
          _hover={{ opacity: 0.9 }}
          transition="opacity 0.2s"
        >
          Mamin kotiček
        </Heading>
      </Box>
      <Heading
        as={RouterLink}
        to="/"
        size={headingSize}
        color="white"
        whiteSpace="nowrap"
        _hover={{ opacity: 0.9 }}
        transition="opacity 0.2s"
        display={{ base: "none", md: "block" }}
      >
        Mamin kotiček
      </Heading>
    </HStack>
  );

  const NavLinks = (
    <HStack spacing={1} display={{ base: "none", md: "flex" }} px={2} flexShrink={0}>
      <Button
        as={RouterLink}
        to="/"
        variant="ghost"
        color="white"
        fontWeight="700"
        _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
      >
        Kotiček
      </Button>
      <Button
        as={RouterLink}
        to="/top-moms"
        variant="ghost"
        color="white"
        fontWeight="700"
        _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
      >
        Top mame
      </Button>
      <Button
        as={RouterLink}
        to="/marketplace"
        variant="ghost"
        color="white"
        fontWeight="700"
        _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
      >
        Marketplace
      </Button>
      <Button
        as={RouterLink}
        to="/za-mamo"
        variant="ghost"
        color="white"
        fontWeight="700"
        _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
      >
        Za mamo
      </Button>
    </HStack>
  );

  const renderNotificationsMenu = () => (
    <Menu
      placement="bottom-end"
      strategy="fixed"
      onOpen={() => {
        fetchNotifications(false);
      }}
    >
      <Box position="relative">
        <MenuButton
          as={IconButton}
          icon={<BellIcon />}
          variant="ghost"
          color="white"
          size="lg"
          rounded="full"
          aria-label="Obvestila"
          _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
          _active={{ bg: "rgba(255, 255, 255, 0.2)" }}
          onMouseUp={(e) => e.currentTarget.blur()}
        />
        {(() => {
          const total = unreadCount;
          if (!total || total <= 0) return null;
          const label = total > 99 ? "99+" : String(total);
          return (
            <Badge
              position="absolute"
              top="0"
              right="-5px"
              bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
              color="white"
              borderRadius="999px"
              fontSize="xs"
              minW="18px"
              h="18px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              boxShadow="0 10px 22px rgba(236, 95, 140, 0.35), 0 2px 8px rgba(0,0,0,0.12)"
              px={total > 9 ? 2 : 0}
              lineHeight="1"
              fontWeight="800"
            >
              {label}
            </Badge>
          );
        })()}
      </Box>
      <Portal>
        <MenuList
          zIndex={2000}
          bg="white"
          maxH="min(420px, 70vh)"
          overflowY="auto"
          overflowX="hidden"
          minW={{ base: "min(100vw - 2rem, 280px)", sm: "min(100vw - 2rem, 360px)" }}
          maxW="min(400px, calc(100vw - 1rem))"
          p={0}
          mt={2}
          rounded="2xl"
          shadow="0 24px 48px rgba(15, 23, 42, 0.12)"
          border="1px solid"
          borderColor="gray.100"
          sx={hideScrollbarSx}
        >
          <Box px={4} py={3} borderBottom="1px solid" borderColor="gray.100" bg="gray.50">
            <HStack justify="space-between" align="center">
              <Heading size="sm" fontWeight="800" color="gray.800" letterSpacing="-0.02em">
                Obvestila
              </Heading>
              {unreadCount > 0 && (
                <Button
                  size="xs"
                  variant="ghost"
                  colorScheme="pink"
                  fontWeight="600"
                  onClick={(e) => {
                    e.preventDefault();
                    markAllAsRead();
                  }}
                >
                  Označi prebrane
                </Button>
              )}
            </HStack>
          </Box>

          <Box px={4} pt={3} pb={4}>
            <HStack spacing={2} mb={3}>
            </HStack>
            {notificationsLoading ? (
              <Center py={8}>
                <Spinner size="md" color="pink.400" thickness="3px" />
              </Center>
            ) : notifications.length === 0 ? (
              <Text fontSize="sm" color="gray.500" py={4} textAlign="center">
                Tukaj bodo tvoja obvestila
              </Text>
            ) : (
              <VStack spacing={1.5} align="stretch">
                {notifications.map((notif) => {
                  const unread = !notif.read;
                  const pres = notificationPresentation(notif);
                  const listKey = String(notif.type).trim() === "like" ? `like-${notif.postId}` : String(notif.id);
                  const t = String(notif?.type || "").trim();
                  const showPostTitle =
                    Boolean(notif.postId) &&
                    Boolean(notif.postTitle) &&
                    String(notif.postTitle).trim() !== "Objava ni več na voljo" &&
                    (t === "like" ||
                      t === "comment" ||
                      t === "reply" ||
                      t === "post_hidden" ||
                      t === "comment_hidden" ||
                      t === "post_unhidden" ||
                      t === "comment_unhidden" ||
                      t === "support_react");
                  return (
                    <MenuItem
                      key={listKey}
                      onClick={async () => {
                        const wasUnread = !notif.read;

                        // Optimistic UI: decrement badge immediately and mark read visually.
                        if (wasUnread) {
                          setNotifications((prev) =>
                            prev.map((n) => {
                              const nk = String(n.type).trim() === "like" ? `like-${n.postId}` : String(n.id);
                              const same = nk === listKey;
                              return same ? { ...n, read: true } : n;
                            })
                          );
                        }

                        await markNotificationRead(notif);

                        try {
                          const route = notificationRoute(notif);
                          if (route) navigate(route);
                        } catch (e) {
                          console.error("notificationRoute failed:", e);
                        }
                      }}
                      p={0}
                      bg="transparent"
                      _hover={{ bg: "transparent" }}
                      _focus={{ bg: "transparent" }}
                      _focusVisible={{ boxShadow: "none", outline: "none" }}
                      _active={{ bg: "transparent" }}
                    >
                      <HStack
                        align="start"
                        spacing={3}
                        w="full"
                        p={3}
                        rounded="xl"
                        bg={unread ? "pink.50" : "gray.50"}
                        borderWidth="0"
                        transition="background 0.15s ease"
                        _hover={{ bg: unread ? "pink.100" : "gray.100" }}
                      >
                        <Flex
                          align="center"
                          justify="center"
                          w="40px"
                          h="40px"
                          rounded="full"
                          bg="white"
                          color={pres.accentColor}
                          borderWidth="1px"
                          borderColor="gray.100"
                          flexShrink={0}
                        >
                          <pres.icon size={18} />
                        </Flex>
                        <VStack align="start" spacing={0.5} flex={1} minW={0}>
                          <Text fontSize="sm" fontWeight="700" color="gray.800" lineHeight="1.35">
                            {pres.title}
                          </Text>
                          <Text fontSize="sm" color="gray.800" lineHeight="1.35" fontWeight="500">
                            {pres.subtitle}
                          </Text>
                          {showPostTitle ? (
                            <Text fontSize="xs" color="gray.500" noOfLines={1} fontWeight="500">
                              {notif.postTitle}
                            </Text>
                          ) : null}
                          <Text fontSize="10px" color="gray.400" mt={0.5}>
                            {formatTimeAgo(notif.createdAt)}
                          </Text>
                        </VStack>
                        {unread && (
                          <Box w="9px" h="9px" bg="pink.500" borderRadius="full" mt={1.5} flexShrink={0} boxShadow="0 0 0 3px rgba(236, 95, 140, 0.25)" />
                        )}
                      </HStack>
                    </MenuItem>
                  );
                })}
              </VStack>
            )}
            {notificationsHasMore && notifications.length > 0 ? (
              <Box px={4} pb={3} pt={1} textAlign="center">
                <Button
                  size="xs"
                  variant="link"
                  colorScheme="pink"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    loadMoreNotifications();
                  }}
                  isLoading={notificationsLoadingMore}
                >
                  Naloži več
                </Button>
              </Box>
            ) : null}
          </Box>
        </MenuList>
      </Portal>
    </Menu>
  );

  const RightAuth = user ? (
    <HStack spacing={{ base: 2, md: 3 }}>
      {renderNotificationsMenu()}
      <Menu
        placement="bottom-end"
        strategy="fixed"
        onOpen={() => {
          loadModerationPendingCount();
        }}
      >
        <MenuButton as={Button} rightIcon={<ChevronDownIcon color="white" />} variant="ghost" px={2} h={{ base: "36px", md: "38px" }} rounded="full" _hover={{ bg: "rgba(255, 255, 255, 0.15)" }} _active={{ bg: "rgba(255, 255, 255, 0.2)" }} transition="all 0.2s">
          <HStack spacing={2}>
            <Avatar
              src={buildAvatarDisplayUrl(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME, user.avatarUrl)}
              name={user.username}
              size="sm"
              bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
              color="white"
            />
            <Text fontWeight="600" color="white" fontSize="sm" display={{ base: "none", lg: "block" }}>{displayName}</Text>
          </HStack>
        </MenuButton>
        <Portal>
          <MenuList
            zIndex={2000}
            bg="white"
            boxShadow="0 20px 40px rgba(0, 0, 0, 0.12)"
            border="1px solid"
            borderColor="gray.100"
            rounded="xl"
            py={2}
            minW="200px"
            maxW="min(320px, calc(100vw - 1rem))"
            maxH="min(360px, 70vh)"
            overflowY="auto"
            overflowX="hidden"
            sx={hideScrollbarSx}
          >
            <Box px={3} py={2} mb={2}>
              <Text fontWeight="600" fontSize="sm" color="gray.700">{user.username}</Text>
              <Text fontSize="xs" color="gray.500">{user.email}</Text>
            </Box>
            <Divider mb={2} />
            <MenuItem as={RouterLink} to="/profile" icon={<FiUser />} rounded="md" mx={2} fontSize="sm" _hover={{ bg: "brand.50", color: "brand.600" }}>Moj profil</MenuItem>
            {canAccessModeration(user) && (
              <MenuItem as={RouterLink} to="/moderacija" icon={<FiShield />} rounded="md" mx={2} fontSize="sm" _hover={{ bg: "brand.50", color: "brand.600" }}>
                <HStack justify="space-between" w="full">
                  <Text>Moderacija</Text>
                  {modPendingCount != null && modPendingCount > 0 && (
                    <Badge colorScheme="orange" borderRadius="full" fontSize="10px">
                      {modPendingCount > 99 ? "99+" : modPendingCount}
                    </Badge>
                  )}
                </HStack>
              </MenuItem>
            )}
            <MenuItem as={RouterLink} to="/nastavitve" icon={<FiSettings />} rounded="md" mx={2} fontSize="sm" _hover={{ bg: "brand.50", color: "brand.600" }}>Nastavitve</MenuItem>
            <Divider my={2} />
            <MenuItem onClick={handleLogout} icon={<FiLogOut />} color="red.600" rounded="md" mx={2} fontSize="sm" _hover={{ bg: "red.50" }}>Odjava</MenuItem>
          </MenuList>
        </Portal>
      </Menu>
    </HStack>
  ) : (
    <HStack spacing={{ base: 2, md: 3 }}>
      {authButtonsUseModal ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size={{ base: "sm", md: "md" }}
            fontWeight="600"
            color="white"
            rounded="full"
            _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
            onClick={() => requestAuth({ tab: "register" })}
          >
            Registracija
          </Button>
          <Button
            type="button"
            bg="white"
            color="brand.500"
            size={{ base: "sm", md: "md" }}
            fontWeight="600"
            px={{ base: 4, md: 6 }}
            rounded="full"
            boxShadow="0 4px 12px rgba(255, 255, 255, 0.3)"
            _hover={{ bg: "rgba(255, 255, 255, 0.95)", transform: "translateY(-2px)", boxShadow: "0 6px 20px rgba(255, 255, 255, 0.4)" }}
            _active={{ transform: "translateY(0)", boxShadow: "0 2px 8px rgba(255, 255, 255, 0.3)" }}
            transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
            onClick={() => requestAuth({ tab: "login" })}
          >
            Prijava
          </Button>
        </>
      ) : (
        <>
          <Button as={RouterLink} to="/registracija" variant="ghost" size={{ base: "sm", md: "md" }} fontWeight="600" color="white" rounded="full" _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}>Registracija</Button>
          <Button as={RouterLink} to="/prijava" bg="white" color="brand.500" size={{ base: "sm", md: "md" }} fontWeight="600" px={{ base: 4, md: 6 }} rounded="full" boxShadow="0 4px 12px rgba(255, 255, 255, 0.3)" _hover={{ bg: "rgba(255, 255, 255, 0.95)", transform: "translateY(-2px)", boxShadow: "0 6px 20px rgba(255, 255, 255, 0.4)" }} _active={{ transform: "translateY(0)", boxShadow: "0 2px 8px rgba(255, 255, 255, 0.3)" }} transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)">Prijava</Button>
        </>
      )}
    </HStack>
  );

  return (
    <>
      <Box
        display={{ base: "block", md: "none" }}
        h="calc(68px + env(safe-area-inset-top, 0px))"
        flexShrink={0}
        aria-hidden
      />
      <Box
        as="nav"
        bgGradient="linear(to-r, brand.500, brand.600)"
        backdropFilter={{ base: "none", md: "blur(12px)" }}
        position={{ base: "fixed", md: "sticky" }}
        top={0}
        left={0}
        right={0}
        zIndex={1400}
        w="100%"
        pt={{ base: "env(safe-area-inset-top, 0px)", md: 0 }}
        overflowX="hidden"
        overflowY="visible"
        sx={{
          WebkitBackfaceVisibility: "hidden",
          backfaceVisibility: "hidden",
          transform: "translateZ(0)",
          WebkitTransform: "translateZ(0)",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
        boxShadow={scrolled ? "0 8px 32px rgba(236, 95, 140, 0.35), 0 4px 16px rgba(0, 0, 0, 0.12)" : "0 4px 20px rgba(236, 95, 140, 0.25), 0 2px 8px rgba(0, 0, 0, 0.08)"}
        borderBottom="1px solid"
        borderColor="rgba(255, 255, 255, 0.2)"
        transition="box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        _after={{ content: '""', position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', bgGradient: 'linear(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)' }}
      >
        <Container maxW="8xl" mx="auto" px={{ base: 5, sm: 6, md: 8 }} minW={0}>
          <Flex align="center" h={{ base: "68px", md: "76px" }} justify="space-between" w="100%" minW={0} gap={2}>
            {Left}
            <HStack flex="1" justifyContent="center" spacing={4} minW={0} display={{ base: "none", md: "flex" }}>
              {NavLinks}
            </HStack>
            <HStack spacing={4} display={{ base: "none", md: "flex" }} flexShrink={0}>{RightAuth}</HStack>
            <HStack spacing={2} display={{ base: "flex", md: "none" }} flexShrink={0}>
              {user && renderNotificationsMenu()}
              <IconButton aria-label={isOpen ? "Zapri meni" : "Odpri meni"} icon={isOpen ? <CloseIcon boxSize={4} /> : <HamburgerIcon boxSize={5} />} variant="ghost" color="white" rounded="lg" _hover={{ bg: "rgba(255, 255, 255, 0.15)" }} onClick={isOpen ? onClose : onOpen} size="md" />
            </HStack>
          </Flex>
        </Container>
      </Box>
      <Drawer placement="right" isOpen={isOpen} onClose={onClose} size="xs">
        <DrawerOverlay bg="rgba(0, 0, 0, 0.4)" backdropFilter="blur(4px)" />
        <DrawerContent
          bgGradient="linear(to-r, brand.500, brand.600)"
          boxShadow="0 0 60px rgba(236, 95, 140, 0.4)"
          color="white"
          display="flex"
          flexDirection="column"
          maxH="100dvh"
          overflowX="hidden"
          sx={hideScrollbarSx}
        >
          <DrawerCloseButton mt={4} mr={2} color="white" _hover={{ bg: "rgba(255, 255, 255, 0.15)" }} rounded="lg" />
          <DrawerHeader flexShrink={0} borderBottomWidth="1px" borderColor="rgba(255, 255, 255, 0.2)" pb={4}>
            <HStack spacing={3}>
              <Image src={Logo} alt="" boxSize="32px" filter="brightness(0) invert(1)" />
              <Text fontSize="lg" fontWeight="700" color="white">Mamin kotiček</Text>
            </HStack>
          </DrawerHeader>
          <DrawerBody flex="1" minH={0} overflowY="auto" overflowX="hidden" pt={4} sx={hideScrollbarSx}>
            <Stack spacing={2}>
              {user ? (
                <>
                  <Button
                    as={RouterLink}
                    to="/profile"
                    onClick={onClose}
                    leftIcon={<Icon as={FiUser} boxSize={4} />}
                    iconSpacing={3}
                    variant="ghost"
                    color="white"
                    justifyContent="flex-start"
                    alignItems="center"
                    fontWeight="500"
                    _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
                    rounded="lg"
                    h="44px"
                    px={4}
                    sx={{ ".chakra-button__icon": { display: "inline-flex", alignItems: "center" } }}
                  >
                    Moj profil
                  </Button>
                  {canAccessModeration(user) && (
                    <Button
                      as={RouterLink}
                      to="/moderacija"
                      onClick={onClose}
                      leftIcon={<Icon as={FiShield} boxSize={4} />}
                      iconSpacing={3}
                      variant="ghost"
                      color="white"
                      justifyContent="flex-start"
                      alignItems="center"
                      fontWeight="500"
                      _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
                      rounded="lg"
                      h="44px"
                      px={4}
                      sx={{ ".chakra-button__icon": { display: "inline-flex", alignItems: "center" } }}
                    >
                      Moderacija
                    </Button>
                  )}
                  <Button
                    as={RouterLink}
                    to="/nastavitve"
                    onClick={onClose}
                    leftIcon={<Icon as={FiSettings} boxSize={4} />}
                    iconSpacing={3}
                    variant="ghost"
                    color="white"
                    justifyContent="flex-start"
                    alignItems="center"
                    fontWeight="500"
                    _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
                    rounded="lg"
                    h="44px"
                    px={4}
                    sx={{ ".chakra-button__icon": { display: "inline-flex", alignItems: "center" } }}
                  >
                    Nastavitve
                  </Button>
                  <Button
                    as={RouterLink}
                    to="/"
                    onClick={onClose}
                    leftIcon={<Icon as={FiHome} boxSize={4} mt="-4px" />}
                    iconSpacing={3}
                    variant="ghost"
                    color="white"
                    justifyContent="flex-start"
                    alignItems="center"
                    fontWeight="500"
                    _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
                    rounded="lg"
                    h="44px"
                    px={4}
                    sx={{ ".chakra-button__icon": { display: "inline-flex", alignItems: "center" } }}
                  >
                    Kotiček
                  </Button>
                  <Button
                    as={RouterLink}
                    to="/marketplace"
                    onClick={onClose}
                    leftIcon={<Icon as={FiShoppingBag} boxSize={4} mt="-2px" />}
                    iconSpacing={3}
                    variant="ghost"
                    color="white"
                    justifyContent="flex-start"
                    alignItems="center"
                    fontWeight="500"
                    _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
                    rounded="lg"
                    h="44px"
                    px={4}
                    sx={{ ".chakra-button__icon": { display: "inline-flex", alignItems: "center" } }}
                  >
                    Marketplace
                  </Button>
                  <Button
                    as={RouterLink}
                    to="/za-mamo"
                    onClick={onClose}
                    leftIcon={<Icon as={FiHeart} boxSize={4} />}
                    iconSpacing={3}
                    variant="ghost"
                    color="white"
                    justifyContent="flex-start"
                    alignItems="center"
                    fontWeight="500"
                    _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
                    rounded="lg"
                    h="44px"
                    px={4}
                    sx={{ ".chakra-button__icon": { display: "inline-flex", alignItems: "center" } }}
                  >
                    Za mamo
                  </Button>
                  <Button
                    as={RouterLink}
                    to="/top-moms"
                    onClick={onClose}
                    leftIcon={<Icon as={FiStar} boxSize={4} />}
                    iconSpacing={3}
                    variant="ghost"
                    color="white"
                    justifyContent="flex-start"
                    alignItems="center"
                    fontWeight="500"
                    _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
                    rounded="lg"
                    h="44px"
                    px={4}
                    sx={{ ".chakra-button__icon": { display: "inline-flex", alignItems: "center" } }}
                  >
                    Top mame
                  </Button>
                  <Button
                    leftIcon={<Icon as={FiMessageCircle} boxSize={4} />}
                    iconSpacing={3}
                    variant="ghost"
                    color="white"
                    justifyContent="flex-start"
                    alignItems="center"
                    fontWeight="500"
                    _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
                    rounded="lg"
                    h="44px"
                    px={4}
                    onClick={() => {
                      onClose();
                      window.dispatchEvent(new CustomEvent("messenger-open"));
                    }}
                    sx={{ ".chakra-button__icon": { display: "inline-flex", alignItems: "center" } }}
                  >
                    Sporočila
                  </Button>
                  <Button
                    onClick={() => { handleLogout(); onClose(); }}
                    leftIcon={<Icon as={FiLogOut} boxSize={4} />}
                    iconSpacing={3}
                    variant="ghost"
                    justifyContent="flex-start"
                    alignItems="center"
                    color="white"
                    fontWeight="500"
                    _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
                    rounded="lg"
                    h="44px"
                    px={4}
                    sx={{ ".chakra-button__icon": { display: "inline-flex", alignItems: "center" } }}
                  >
                    Odjava
                  </Button>
                  <HamburgerDrawerFooter onClose={onClose} />
                </>
              ) : (
                <>
                  <Button
                    as={RouterLink}
                    to="/"
                    onClick={onClose}
                    leftIcon={<Icon as={FiHome} boxSize={4} mt="-1px" />}
                    iconSpacing={3}
                    variant="ghost"
                    color="white"
                    justifyContent="flex-start"
                    alignItems="center"
                    fontWeight="500"
                    _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
                    rounded="lg"
                    h="44px"
                    sx={{ ".chakra-button__icon": { display: "inline-flex", alignItems: "center" } }}
                  >
                    Kotiček
                  </Button>
                  <Button
                    as={RouterLink}
                    to="/marketplace"
                    onClick={onClose}
                    leftIcon={<Icon as={FiShoppingBag} boxSize={4} />}
                    iconSpacing={3}
                    variant="ghost"
                    color="white"
                    justifyContent="flex-start"
                    alignItems="center"
                    fontWeight="500"
                    _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
                    rounded="lg"
                    h="44px"
                    sx={{ ".chakra-button__icon": { display: "inline-flex", alignItems: "center" } }}
                  >
                    Marketplace
                  </Button>
                  <Button
                    as={RouterLink}
                    to="/za-mamo"
                    onClick={onClose}
                    leftIcon={<Icon as={FiHeart} boxSize={4} />}
                    iconSpacing={3}
                    variant="ghost"
                    color="white"
                    justifyContent="flex-start"
                    alignItems="center"
                    fontWeight="500"
                    _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
                    rounded="lg"
                    h="44px"
                    sx={{ ".chakra-button__icon": { display: "inline-flex", alignItems: "center" } }}
                  >
                    Za mamo
                  </Button>
                  <Button
                    as={RouterLink}
                    to="/top-moms"
                    onClick={onClose}
                    leftIcon={<Icon as={FiStar} boxSize={4} />}
                    iconSpacing={3}
                    variant="ghost"
                    color="white"
                    justifyContent="flex-start"
                    alignItems="center"
                    fontWeight="500"
                    _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
                    rounded="lg"
                    h="44px"
                    sx={{ ".chakra-button__icon": { display: "inline-flex", alignItems: "center" } }}
                  >
                    Top mame
                  </Button>
                  <Divider my={2} borderColor="rgba(255, 255, 255, 0.2)" />
                  {authButtonsUseModal ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        color="white"
                        justifyContent="flex-start"
                        alignItems="center"
                        leftIcon={<Icon as={FiUserPlus} boxSize={4} />}
                        iconSpacing={3}
                        fontWeight="500"
                        _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
                        rounded="lg"
                        h="44px"
                        px={4}
                        sx={{ ".chakra-button__icon": { display: "inline-flex", alignItems: "center" } }}
                        onClick={() => {
                          onClose();
                          requestAuth({ tab: "register" });
                        }}
                      >
                        Registracija
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        color="white"
                        justifyContent="flex-start"
                        alignItems="center"
                        leftIcon={<Icon as={FiUser} boxSize={4} />}
                        iconSpacing={3}
                        fontWeight="600"
                        bg="rgba(255,255,255,0.16)"
                        border="1px solid"
                        borderColor="rgba(255,255,255,0.22)"
                        _hover={{ bg: "rgba(255, 255, 255, 0.22)" }}
                        rounded="lg"
                        h="44px"
                        px={4}
                        sx={{ ".chakra-button__icon": { display: "inline-flex", alignItems: "center" } }}
                        onClick={() => {
                          onClose();
                          requestAuth({ tab: "login" });
                        }}
                      >
                        Prijava
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        as={RouterLink}
                        to="/registracija"
                        onClick={onClose}
                        variant="ghost"
                        color="white"
                        justifyContent="flex-start"
                        alignItems="center"
                        leftIcon={<Icon as={FiUserPlus} boxSize={4} />}
                        iconSpacing={3}
                        fontWeight="500"
                        _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
                        rounded="lg"
                        h="44px"
                        px={4}
                        sx={{ ".chakra-button__icon": { display: "inline-flex", alignItems: "center" } }}
                      >
                        Registracija
                      </Button>
                      <Button
                        as={RouterLink}
                        to="/prijava"
                        onClick={onClose}
                        variant="ghost"
                        color="white"
                        justifyContent="flex-start"
                        alignItems="center"
                        leftIcon={<Icon as={FiUser} boxSize={4} />}
                        iconSpacing={3}
                        fontWeight="600"
                        bg="rgba(255,255,255,0.16)"
                        border="1px solid"
                        borderColor="rgba(255,255,255,0.22)"
                        _hover={{ bg: "rgba(255, 255, 255, 0.22)" }}
                        rounded="lg"
                        h="44px"
                        px={4}
                        sx={{ ".chakra-button__icon": { display: "inline-flex", alignItems: "center" } }}
                      >
                        Prijava
                      </Button>
                    </>
                  )}
                  <HamburgerDrawerFooter onClose={onClose} />
                </>
              )}
            </Stack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default NavbarForum;
