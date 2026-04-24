import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, Container, Heading, VStack, HStack, Button, Text, Avatar, Skeleton, SimpleGrid, Spinner, Divider, Flex, IconButton, Menu, MenuButton, MenuList, MenuItem, Grid, GridItem, Tooltip, useDisclosure, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, Link } from "@chakra-ui/react";
import { BsThreeDots } from "react-icons/bs";
import Footer from "../Footer/Footer";
import { API_BASE } from "../../api/config";
import { getStoredUser, coerceIsProfilePrivate, apiViewerHasFullProfileAccess } from "../../utils/helpers";
import PostDetailModal from "../Forum/PostDetailModal";
import CompactProfilePostCard from "../Forum/CompactProfilePostCard";
import FriendButton from "../Forum/FriendButton";
import { FiFlag, FiMessageCircle, FiSlash, FiUserCheck, FiUserX } from "react-icons/fi";
import ReportProfileModal from "./ReportProfileModal";
import ListingCard from "../Marketplace/ListingCard";
import { MARKETPLACE_CHANGED_EVENT, OPEN_LISTING_DETAIL_MODAL } from "../Marketplace/marketplaceModalConstants";
import { getCloudinaryConfig, buildAvatarDisplayUrl } from "../../utils/cloudinaryUpload";
import ProfileFriendsModal from "../Forum/ProfileFriendsModal";
import { useInfiniteScroll } from "../../hooks/forum/useInfiniteScroll";
import ExpandableText from "../common/ExpandableText";
import { submitModerationAppeal, suspendUser, unsuspendUser } from "../../api/moderation";

const PUBLIC_POST_PAGE = 12;
const PUBLIC_LISTINGS_PAGE = 12;

const surface = {
    bg: "white",
    border: "1px solid",
    borderColor: "gray.100",
    rounded: "2xl",
    boxShadow: "0 4px 24px rgba(15, 23, 42, 0.06)",
};

const innerSurface = {
    bg: "white",
    borderRadius: "xl",
    border: "1px solid",
    borderColor: "gray.100",
    boxShadow: "sm",
};

const profileContentBackdrop = {
    bg: "transparent",
    borderWidth: "0",
    rounded: "0",
    boxShadow: "none",
};

const PublicProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { toast } = useAppToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const [notifBanner, setNotifBanner] = useState(null);
    const { isOpen: isReportOpen, onOpen: onReportOpen, onClose: onReportClose } = useDisclosure();
    const { isOpen: isFriendsModalOpen, onOpen: onFriendsModalOpen, onClose: onFriendsModalClose } = useDisclosure();
    const [suspendedDialogOpen, setSuspendedDialogOpen] = useState(false);
    const suspendedCancelRef = useRef();
    const [friendsModalVariant, setFriendsModalVariant] = useState("friends");
    const [mutualPreview, setMutualPreview] = useState({ loading: false, items: [], total: 0 });

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isBlocking, setIsBlocking] = useState(false);
    const [friendRel, setFriendRel] = useState(null);
    const [activePublicTab, setActivePublicTab] = useState("posts");

    const [listings, setListings] = useState([]);
    const [listingsLoading, setListingsLoading] = useState(false);
    const [listingsLoadingMore, setListingsLoadingMore] = useState(false);
    const [listingsHasMore, setListingsHasMore] = useState(true);

    const [publicPosts, setPublicPosts] = useState([]);
    const [publicPostsLoading, setPublicPostsLoading] = useState(false);
    const [publicPostsLoadingMore, setPublicPostsLoadingMore] = useState(false);
    const [publicPostsHasMore, setPublicPostsHasMore] = useState(true);

    const [supportSummary, setSupportSummary] = useState(null);
    const [supportLoading, setSupportLoading] = useState(false);
    const [appealBusy, setAppealBusy] = useState(false);

    const currentUser = useMemo(() => getStoredUser(), []);
    const isOwnProfile =
        Boolean(currentUser?.id) && Number(currentUser.id) === Number(id);
    const isAdminViewer = Boolean(currentUser?.isAdmin);

    useEffect(() => {
        // Avoid showing stale suspended modal when navigating between profiles.
        setSuspendedDialogOpen(false);
    }, [id]);

    useEffect(() => {
        const notifId = searchParams.get("notif");
        const bannerKey = searchParams.get("banner");
        const hasBanner = Boolean(bannerKey && bannerKey.trim());
        const hasNotif = Boolean(notifId && notifId.trim());

        if (hasBanner) {
            const bk = String(bannerKey || "").trim();
            // Only show suspension modal for non-owners. Owner should land on /profile and request review there.
            if (bk === "suspended" && !isOwnProfile) setSuspendedDialogOpen(true);
            const title =
                bk === "suspended"
                    ? "Vaš profil je začasno onemogočen"
                    : bk === "unsuspended"
                        ? "Vaš profil je ponovno aktiven"
                        : bk === "unhidden"
                            ? "Vašo vsebino smo pregledali"
                            : "Moderacija";
            const desc =
                bk === "suspended"
                    ? "Če menite, da gre za napako, lahko zahtevate pregled."
                    : bk === "unsuspended"
                        ? "Profil je ponovno dostopen."
                        : bk === "unhidden"
                            ? "Vsebina je ponovno vidna skupnosti."
                            : "";
            setNotifBanner({ key: bk, title, desc });
        }

        if (hasNotif) {
            const nid = String(notifId || "").trim();
            fetch(`${API_BASE}/api/notifications/${encodeURIComponent(nid)}/read`, {
                method: "PUT",
                credentials: "include",
            }).catch(() => {});
        }

        if (hasBanner || hasNotif) {
            const next = new URLSearchParams(searchParams);
            next.delete("notif");
            next.delete("banner");
            setSearchParams(next, { replace: true });
        }
    }, [searchParams, setSearchParams, isOwnProfile]);

    const [detailPostId, setDetailPostId] = useState(null);
    const [detailPostPreview, setDetailPostPreview] = useState(null);
    const closePostDetail = useCallback(() => {
        setDetailPostId(null);
        setDetailPostPreview(null);
    }, []);

    const listingCloudName = useMemo(() => {
        const cfg = getCloudinaryConfig();
        return cfg.ok ? cfg.cloudName : null;
    }, []);

    const handleProfileAppeal = useCallback(async () => {
        if (!isOwnProfile || !user?.isSuspended) return;
        if (appealBusy) return;
        setAppealBusy(true);
        try {
            await submitModerationAppeal({ targetType: "user_profile", targetId: Number(user.id) });
            toast({ status: "success", title: "Zahtevek za pregled je oddan", isClosable: true });
        } catch (e) {
            toast({
                status: "error",
                title: "Oddaja ni uspela",
                description: e?.message || "Poskusite znova.",
                isClosable: true,
            });
        } finally {
            setAppealBusy(false);
        }
    }, [appealBusy, isOwnProfile, toast, user?.id, user?.isSuspended]);

    const onFriendRelationshipChange = useCallback((next) => {
        setFriendRel(next);
        if (next?.status === "friends" && id) {
            fetch(`${API_BASE}/api/users/${id}`, { credentials: "include" })
                .then((r) => (r.ok ? r.json() : null))
                .then((data) => {
                    if (data) setUser(data);
                })
                .catch(() => {});
        }
    }, [id]);

    const showStandaloneBlock =
        Boolean(currentUser?.id) &&
        friendRel?.status !== "friends" &&
        friendRel?.status !== "blocked" &&
        friendRel?.status !== "unauthorized";

    const showProfileOverflowMenu =
        Boolean(currentUser?.id) &&
        !isOwnProfile &&
        friendRel?.status !== "blocked" &&
        friendRel?.status !== "unauthorized" &&
        friendRel?.status !== "friends";
    const showAdminProfileMenu =
        Boolean(currentUser?.id) &&
        isAdminViewer &&
        !isOwnProfile;

    useEffect(() => {
        setActivePublicTab("posts");
    }, [id]);

    useEffect(() => {
        setPublicPosts([]);
        setListings([]);
        setPublicPostsHasMore(true);
        setListingsHasMore(true);
    }, [id]);

    useEffect(() => {
        if (
            !id ||
            !currentUser?.id ||
            isOwnProfile ||
            friendRel?.status === "blocked" ||
            (coerceIsProfilePrivate(user?.isProfilePrivate) &&
                !apiViewerHasFullProfileAccess(user) &&
                !isOwnProfile)
        ) {
            setMutualPreview({ loading: false, items: [], total: 0 });
            return;
        }
        let abort = false;
        (async () => {
            setMutualPreview((p) => ({ ...p, loading: true }));
            try {
                const res = await fetch(`${API_BASE}/api/users/${id}/friends/mutual`, {
                    credentials: "include",
                });
                const data = await res.json().catch(() => ({}));
                if (abort) return;
                if (!res.ok) {
                    setMutualPreview({ loading: false, items: [], total: 0 });
                    return;
                }
                const items = Array.isArray(data.items) ? data.items : [];
                const total = typeof data.total === "number" ? data.total : items.length;
                setMutualPreview({ loading: false, items, total });
            } catch {
                if (!abort) setMutualPreview({ loading: false, items: [], total: 0 });
            }
        })();
        return () => {
            abort = true;
        };
    }, [id, currentUser?.id, isOwnProfile, friendRel?.status, user?.isProfilePrivate, user?.viewerHasFullAccess, user?.id]);

    useEffect(() => {
        if (!id) return;

        const ac = new AbortController();
        let cancelled = false;

        async function loadProfile() {
            try {
                setLoading(true);
                setUser(null);

                const res = await fetch(`${API_BASE}/api/users/${id}`, {
                    credentials: "include",
                    signal: ac.signal,
                });

                if (!res.ok) {
                    if (res.status === 404) {
                        toast({ status: "error", title: "Profil ne obstaja", duration: null });
                        setSuspendedDialogOpen(false);
                        return;
                    }
                    if (res.status === 403) {
                        const errBody = await res.json().catch(() => ({}));
                        const errCode = errBody?.error?.code;
                        if (errCode === "USER_SUSPENDED") {
                            setSuspendedDialogOpen(true);
                            return;
                        }
                        const blocked = errCode === "PROFILE_BLOCKED";
                        toast({
                            status: "info",
                            title: blocked ? "Profil ni na voljo" : "Dostop zavrnjen",
                            description: blocked
                                ? "Med vama je aktivna blokada ali profil ni javen."
                                : errBody?.error?.message || undefined,
                        });
                        navigate(-1);
                        return;
                    }

                    throw new Error("Napaka pri branju profila");
                }

                const data = await res.json();
                if (cancelled || Number(data?.id) !== Number(id)) return;
                setUser(data);
            } catch (err) {
                if (err?.name === "AbortError") return;
                console.error(err);
                if (!cancelled) {
                    toast({
                        status: "error",
                        title: "Napaka pri nalaganju profila",
                    });
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadProfile();
        return () => {
            cancelled = true;
            ac.abort();
        };
    }, [id, navigate, toast]);

    const formatDateTime = (iso) =>
        new Date(iso).toLocaleString("sl-SI", {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });

    const handlePostClick = (p) => {
        const id = p && typeof p === "object" && p.id != null ? p.id : p;
        if (id == null) return;
        if (p && typeof p === "object" && p.id != null) setDetailPostPreview(p);
        else setDetailPostPreview(null);
        setDetailPostId(id);
    };

    const publicPostsOffsetRef = useRef(0);
    const publicPostsHasMoreRef = useRef(true);
    const publicPostsLoadingRef = useRef(false);
    const publicPostsLoadingMoreRef = useRef(false);

    useEffect(() => {
        publicPostsHasMoreRef.current = publicPostsHasMore;
    }, [publicPostsHasMore]);

    const loadPublicPosts = useCallback(
        async (append = false) => {
            if (!id) return;
            try {
                if (append) {
                    if (publicPostsLoadingMoreRef.current || !publicPostsHasMoreRef.current) return;
                    publicPostsLoadingMoreRef.current = true;
                    setPublicPostsLoadingMore(true);
                } else {
                    if (publicPostsLoadingRef.current) return;
                    publicPostsLoadingRef.current = true;
                    setPublicPostsLoading(true);
                    setPublicPosts([]);
                    setPublicPostsHasMore(true);
                    publicPostsHasMoreRef.current = true;
                    publicPostsOffsetRef.current = 0;
                }
                const offset = append ? publicPostsOffsetRef.current : 0;
                const res = await fetch(
                    `${API_BASE}/api/users/${id}/posts?limit=${PUBLIC_POST_PAGE}&offset=${offset}`,
                    { credentials: "include" }
                );
                const data = await res.json().catch(() => ({}));
                if (res.status === 403 && data?.code === "PROFILE_BLOCKED") {
                    setPublicPosts([]);
                    setPublicPostsHasMore(false);
                    publicPostsHasMoreRef.current = false;
                    return;
                }
                if (res.status === 403 && data?.error?.code === "USER_SUSPENDED") {
                    setPublicPosts([]);
                    setPublicPostsHasMore(false);
                    publicPostsHasMoreRef.current = false;
                    return;
                }
                if (!res.ok) throw new Error(data?.error || "Napaka pri branju objav");
                const batch = data.items || [];
                const total = data.pagination?.total ?? batch.length;
                const hasMore = offset + batch.length < total;
                publicPostsHasMoreRef.current = hasMore;
                setPublicPostsHasMore(hasMore);
                setPublicPosts((prev) => {
                    const next = append ? [...prev, ...batch] : batch;
                    publicPostsOffsetRef.current = next.length;
                    return next;
                });
            } catch (err) {
                console.error(err);
                toast({ status: "error", title: "Napaka pri nalaganju objav", description: err.message });
            } finally {
                publicPostsLoadingRef.current = false;
                publicPostsLoadingMoreRef.current = false;
                setPublicPostsLoading(false);
                setPublicPostsLoadingMore(false);
            }
        },
        [id, toast]
    );

    const loadMorePublicPosts = useCallback(
        (append) => {
            if (!append) return;
            loadPublicPosts(true);
        },
        [loadPublicPosts]
    );

    const listingsOffsetRef = useRef(0);
    const listingsHasMoreRef = useRef(true);
    const listingsLoadingRef = useRef(false);
    const listingsLoadingMoreRef = useRef(false);

    useEffect(() => {
        listingsHasMoreRef.current = listingsHasMore;
    }, [listingsHasMore]);

    const loadListings = useCallback(
        async (append = false) => {
            if (!id) return;
            try {
                if (append) {
                    if (listingsLoadingMoreRef.current || !listingsHasMoreRef.current) return;
                    listingsLoadingMoreRef.current = true;
                    setListingsLoadingMore(true);
                } else {
                    if (listingsLoadingRef.current) return;
                    listingsLoadingRef.current = true;
                    setListingsLoading(true);
                    setListings([]);
                    setListingsHasMore(true);
                    listingsHasMoreRef.current = true;
                    listingsOffsetRef.current = 0;
                }
                const offset = append ? listingsOffsetRef.current : 0;
                const res = await fetch(
                    `${API_BASE}/api/users/${id}/listings?limit=${PUBLIC_LISTINGS_PAGE}&offset=${offset}`,
                    { credentials: "include" }
                );
                const data = await res.json().catch(() => ({}));
                if (res.status === 403 && data?.code === "PROFILE_BLOCKED") {
                    setListings([]);
                    setListingsHasMore(false);
                    listingsHasMoreRef.current = false;
                    return;
                }
                if (res.status === 403 && data?.error?.code === "USER_SUSPENDED") {
                    setListings([]);
                    setListingsHasMore(false);
                    listingsHasMoreRef.current = false;
                    return;
                }
                if (!res.ok) throw new Error(data?.error || "Napaka pri branju oglasov");
                const batch = data.items || [];
                const total = data.pagination?.total ?? batch.length;
                const hasMore = offset + batch.length < total;
                listingsHasMoreRef.current = hasMore;
                setListingsHasMore(hasMore);
                setListings((prev) => {
                    const next = append ? [...prev, ...batch] : batch;
                    listingsOffsetRef.current = next.length;
                    return next;
                });
            } catch (err) {
                console.error(err);
                toast({ status: "error", title: "Napaka pri nalaganju oglasov", description: err.message });
            } finally {
                listingsLoadingRef.current = false;
                listingsLoadingMoreRef.current = false;
                setListingsLoading(false);
                setListingsLoadingMore(false);
            }
        },
        [id, toast]
    );

    const loadMorePublicListings = useCallback(
        (append) => {
            if (!append) return;
            loadListings(true);
        },
        [loadListings]
    );

    const publicPostsSentinelRef = useInfiniteScroll(
        loadMorePublicPosts,
        publicPostsHasMore,
        publicPostsLoading,
        publicPostsLoadingMore,
        activePublicTab !== "posts" ? "paused" : ""
    );
    const publicListingsSentinelRef = useInfiniteScroll(
        loadMorePublicListings,
        listingsHasMore,
        listingsLoading,
        listingsLoadingMore,
        activePublicTab !== "listings" ? "paused" : ""
    );

    useEffect(() => {
        if (!id) return;
        if (!user || Number(user.id) !== Number(id)) return;
        const canSeeContent =
            apiViewerHasFullProfileAccess(user) || isOwnProfile;
        const lockedOut = coerceIsProfilePrivate(user.isProfilePrivate) && !canSeeContent;
        if (lockedOut) {
            setPublicPosts([]);
            setPublicPostsHasMore(false);
            publicPostsHasMoreRef.current = false;
            return;
        }
        loadPublicPosts(false);
    }, [id, user, loadPublicPosts, isOwnProfile]);

    const loadSupport = async (period) => {
        if (!id) return;
        try {
            setSupportLoading(true);
            const res = await fetch(
                `${API_BASE}/api/users/${id}/support-summary?period=${encodeURIComponent(period)}&recentLimit=0`,
                { credentials: "include" }
            );
            const data = await res.json();
            if (res.status === 403 && data?.code === "PROFILE_BLOCKED") {
                setSupportSummary(null);
                return;
            }
            if (!res.ok) throw new Error(data?.error || "Napaka pri branju podpore");
            setSupportSummary(data);
        } catch (err) {
            console.error(err);
            toast({ status: "error", title: "Napaka pri nalaganju podpore", description: err.message });
        } finally {
            setSupportLoading(false);
        }
    };

    const handleBlock = async () => {
        try {
            setIsBlocking(true);

            const res = await fetch(`${API_BASE}/api/friends/block`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ blockedId: Number(id) })
            });

            const data = await res.json();

            if (!res.ok)
                throw new Error(
                    data.error || data.message || "Napaka pri blokiranju uporabnika"
                );

            toast({
                status: "success",
                title: "Uporabnik blokiran"
            });
            setFriendRel({ status: "blocked", blockedByMe: true });
            navigate(-1);
        } catch (err) {
            toast({
                status: "error",
                title: "Napaka",
                description: err.message
            });
        } finally {
            setIsBlocking(false);
        }
    };

    const handleToggleSuspend = async () => {
        if (!isAdminViewer) return;
        if (!user?.id) return;
        try {
            const currentlySuspended = Boolean(user?.isSuspended);
            if (currentlySuspended) {
                await unsuspendUser(Number(user.id));
                toast({ status: "success", title: "Suspenz odstranjen" });
                setUser((p) => (p ? { ...p, isSuspended: false } : p));
            } else {
                await suspendUser(Number(user.id), null);
                toast({ status: "success", title: "Uporabnik suspendiran" });
                setUser((p) => (p ? { ...p, isSuspended: true } : p));
            }
        } catch (err) {
            toast({ status: "error", title: "Napaka", description: err?.message || "Dejanje ni uspelo." });
        }
    };

    const selectPublicTab = async (key) => {
        setActivePublicTab(key);
        if (key === "listings" && listings.length === 0 && !listingsLoading) await loadListings(false);
        if (key === "posts" && publicPosts.length === 0 && !publicPostsLoading) await loadPublicPosts(false);
        if (key === "support" && !supportSummary && !supportLoading) await loadSupport("month");
    };

    useEffect(() => {
        const onMarketplaceChanged = () => {
            if (activePublicTab === "listings" && id) loadListings(false);
        };
        window.addEventListener(MARKETPLACE_CHANGED_EVENT, onMarketplaceChanged);
        return () => window.removeEventListener(MARKETPLACE_CHANGED_EVENT, onMarketplaceChanged);
    }, [activePublicTab, id, loadListings]);

    const tabDefs = useMemo(() => {
        if (!user) return [];
        const v = user.visibility ?? {};
        const canOpenLists = apiViewerHasFullProfileAccess(user) || isOwnProfile;
        if (coerceIsProfilePrivate(user.isProfilePrivate) && !canOpenLists) return [];
        const showPosts = v.showPostsOnProfile !== false;
        const showListingsTab = v.showListingsOnProfile !== false;
        const showSupportTab = v.showSupportOnProfile !== false;
        return [
            { key: "posts", label: "Objave", show: showPosts },
            { key: "listings", label: "Oglasi", show: showListingsTab },
            { key: "support", label: "Podpora drugim", show: showSupportTab },
        ].filter((t) => t.show);
    }, [user, isOwnProfile]);

    useEffect(() => {
        if (!user) return;
        const keys = tabDefs.map((t) => t.key);
        setActivePublicTab((prev) => (keys.includes(prev) ? prev : keys[0] || "posts"));
    }, [user, tabDefs]);

    /** Brez zavihkov: počisti zastarelo vsebino (npr. oglasi ostanejo iz prejšnjega ogleda). */
    useEffect(() => {
        if (!user || tabDefs.length > 0) return;
        setListings([]);
        setListingsHasMore(false);
        listingsHasMoreRef.current = false;
        setPublicPosts([]);
        setPublicPostsHasMore(false);
        publicPostsHasMoreRef.current = false;
        setSupportSummary(null);
    }, [user?.id, tabDefs.length]);

    if (loading) {
        return (
            <Box
                flex="1"
                display="flex"
                flexDirection="column"
                minH={0}
                w="100%"
                maxW="100%"
                alignSelf="stretch"
                bg="gray.50"
            >
                <Box flex="1" display="flex" flexDirection="column" minH={0} w="100%" maxW="100%">
                    <Container
                        maxW="8xl"
                        mx="auto"
                        w="100%"
                        pt={{ base: 10, md: 14 }}
                        pb={{ base: 6, md: 8 }}
                        px={{ base: 4, md: 8 }}
                        flex="1"
                        display="flex"
                        flexDirection="column"
                    >
                        <Grid
                            flex="1"
                            w="100%"
                            maxW="100%"
                            minW={0}
                            templateColumns={{
                                base: "minmax(0, 1fr)",
                                lg: "minmax(200px, min(280px, 26vw)) minmax(0, 1fr)",
                                xl: "minmax(260px, 300px) minmax(0, 1fr)",
                            }}
                            gap={{ base: 6, md: 8 }}
                            alignItems="stretch"
                        >
                            <GridItem alignSelf="start">
                                <Skeleton height="420px" borderRadius="2xl" />
                            </GridItem>
                            <GridItem>
                                <VStack spacing={4} align="stretch" h="full" minH="200px">
                                    <Skeleton height="280px" borderRadius="2xl" />
                                    <Skeleton height="200px" borderRadius="2xl" />
                                </VStack>
                            </GridItem>
                        </Grid>
                    </Container>
                </Box>
            </Box>
        );
    }

    if (!user) {
        // When profile doesn't exist (404), we show a toast and keep the page blank.
        // Only show the blocking dialog when the backend indicates a suspended profile (403 USER_SUSPENDED)
        // or when we were deep-linked with banner=suspended.
        return (
            <Box flex="1" minH={0} w="100%" maxW="100%" alignSelf="stretch" bg="gray.50">
                {suspendedDialogOpen ? (
                    <AlertDialog
                        isOpen={true}
                        leastDestructiveRef={suspendedCancelRef}
                        onClose={() => {
                            setSuspendedDialogOpen(false);
                            navigate("/");
                        }}
                        isCentered
                    >
                        <AlertDialogOverlay />
                        <AlertDialogContent borderRadius="2xl" mx={{ base: 3, md: "auto" }}>
                            <AlertDialogHeader fontSize="lg" fontWeight="800">
                                Profil ni na voljo
                            </AlertDialogHeader>
                            <AlertDialogBody>
                                Ta uporabniški profil je bil odstranjen zaradi kršitve pravil skupnosti.
                            </AlertDialogBody>
                            <AlertDialogFooter>
                                <Button
                                    as={Link}
                                    href="/pogoji-uporabe"
                                    variant="ghost"
                                    colorScheme="pink"
                                    rounded="xl"
                                    w={{ base: "full", sm: "auto" }}
                                    onMouseUp={(e) => e.currentTarget.blur()}
                                >
                                    Pogoji uporabe
                                </Button>
                                <Button
                                    ref={suspendedCancelRef}
                                    onClick={() => {
                                        setSuspendedDialogOpen(false);
                                        navigate("/");
                                    }}
                                    rounded="xl"
                                    w={{ base: "full", sm: "auto" }}
                                >
                                    Zapri
                                </Button>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                ) : null}
            </Box>
        );
    }

    const visibility = user.visibility || {};
    const showListings = visibility.showListingsOnProfile !== false;
    const showSupport = visibility.showSupportOnProfile !== false;
    /** Seznami prijateljev / skupnih prijateljev; bio in številke na levi so vedno javne. */
    const canOpenFriendsLists = apiViewerHasFullProfileAccess(user) || isOwnProfile;
    const profileIsPrivate = coerceIsProfilePrivate(user.isProfilePrivate);
    const privateContentWall = profileIsPrivate && !canOpenFriendsLists;
    const friendsListHint =
        !currentUser?.id ? "login" : privateContentWall ? "private" : null;

    const renderTabBody = () => {
        if (privateContentWall) {
            return (
                <Box {...innerSurface} p={10} textAlign="center">
                    <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                        Ta račun je zaseben. Vsebina profila je vidna le prijateljicam.
                    </Text>
                </Box>
            );
        }
        if (tabDefs.length === 0) {
            return (
                <Box {...innerSurface} p={10} textAlign="center">
                    <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                        {isOwnProfile
                            ? "Tako vidijo ostale tvoj javni profil na tem mestu: brez zavihkov z objavami, oglasi ali podporo drugim."
                            : "Ta javni profil ne prikazuje zavihkov z vsebino."}
                    </Text>
                </Box>
            );
        }
        if (activePublicTab === "posts") {
            return (
                <>
                    {publicPostsLoading && publicPosts.length === 0 ? (
                        <HStack py={12} justify="center"><Spinner color="pink.400" /></HStack>
                    ) : publicPosts.length > 0 ? (
                        <>
                            <SimpleGrid
                                columns={{ base: 1, sm: 2, md: 2, lg: 2, xl: 3 }}
                                spacing={4}
                                w="full"
                                alignItems="stretch"
                                justifyItems="stretch"
                            >
                                {publicPosts.map((post, idx) => (
                                    <Box key={`public-post-${post?.id ?? "na"}-${idx}`} w="100%" h="100%" minW={0} display="flex" flexDirection="column">
                                        <CompactProfilePostCard
                                            post={post}
                                            onOpen={handlePostClick}
                                            dateLabel={formatDateTime(post.createdAt)}
                                        />
                                    </Box>
                                ))}
                            </SimpleGrid>
                            <Box ref={publicPostsSentinelRef} h="2px" w="full" aria-hidden />
                            {publicPostsLoadingMore ? (
                                <HStack justify="center" py={6}>
                                    <Spinner color="pink.400" />
                                </HStack>
                            ) : null}
                            {!publicPostsHasMore && publicPosts.length > 0 ? (
                                <Text textAlign="center" fontSize="sm" color="gray.500" py={3}>
                                    Ni več objav
                                </Text>
                            ) : null}
                        </>
                    ) : (
                        <Box {...innerSurface} p={10} textAlign="center">
                            <Text fontSize="sm" color="gray.500">Še ni javnih objav.</Text>
                        </Box>
                    )}
                </>
            );
        }
        if (activePublicTab === "listings" && showListings) {
            return (
                <>
                    {listingsLoading && listings.length === 0 ? (
                        <SimpleGrid
                            columns={{ base: 1, sm: 2, md: 2, lg: 2, xl: 3 }}
                            spacing={4}
                            w="full"
                            alignItems="stretch"
                            justifyItems="stretch"
                            aria-busy
                        >
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Box
                                    key={`public-listing-skel-${i}`}
                                    w="100%"
                                    h="100%"
                                    minW={0}
                                    bg="white"
                                    borderWidth="1px"
                                    borderColor="gray.100"
                                    rounded="2xl"
                                    overflow="hidden"
                                    boxShadow="sm"
                                    display="flex"
                                    flexDirection="column"
                                >
                                    <Skeleton h="140px" w="100%" />
                                    <Box p={4} flex="1" display="flex" flexDirection="column" minH="11.25rem">
                                        <HStack justify="space-between" align="flex-start" mb={2} spacing={2} minH="32px">
                                            <Box flex="1" minW={0} />
                                            <Skeleton h="10px" w="64px" />
                                        </HStack>
                                        <Skeleton h="14px" w="85%" mb={2} />
                                        <Skeleton h="12px" w="70%" mb={3} />
                                        <HStack justify="space-between" align="center" mt="auto">
                                            <Skeleton h="16px" w="92px" />
                                        </HStack>
                                    </Box>
                                </Box>
                            ))}
                        </SimpleGrid>
                    ) : listings.length === 0 ? (
                        <Box {...innerSurface} p={10} textAlign="center">
                            <Text fontSize="sm" color="gray.500">Ni aktivnih oglasov.</Text>
                        </Box>
                    ) : (
                        <>
                            <SimpleGrid
                                columns={{ base: 1, sm: 2, md: 2, lg: 2, xl: 3 }}
                                spacing={4}
                                w="full"
                                alignItems="stretch"
                                justifyItems="stretch"
                            >
                                {listings.map((l, idx) => (
                                    <Box key={`public-listing-${l?.id ?? "na"}-${idx}`} w="100%" h="100%" minW={0} display="flex" flexDirection="column">
                                        <ListingCard
                                            variant="profile"
                                            listing={l}
                                            cloudName={listingCloudName}
                                            onOpen={(listingId) =>
                                                window.dispatchEvent(
                                                    new CustomEvent(OPEN_LISTING_DETAIL_MODAL, {
                                                        detail: { listingId },
                                                    })
                                                )
                                            }
                                        />
                                    </Box>
                                ))}
                            </SimpleGrid>
                            <Box ref={publicListingsSentinelRef} h="2px" w="full" aria-hidden />
                            {listingsLoadingMore ? (
                                <HStack justify="center" py={6}>
                                    <Spinner color="pink.400" />
                                </HStack>
                            ) : null}
                            {!listingsHasMore && listings.length > 0 ? (
                                <Text textAlign="center" fontSize="sm" color="gray.500" py={3}>
                                    Ni več oglasov
                                </Text>
                            ) : null}
                        </>
                    )}
                </>
            );
        }
        if (activePublicTab === "support" && showSupport) {
            return (
                <>
                    {supportLoading || !supportSummary ? (
                        <VStack spacing={4} align="stretch" aria-busy>
                            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <Box key={`public-support-skel-${i}`} p={4} {...innerSurface}>
                                        <Skeleton h="10px" w="90px" mb={3} />
                                        <Skeleton h="22px" w="60px" />
                                    </Box>
                                ))}
                            </SimpleGrid>
                            <Box p={5} {...innerSurface}>
                                <Skeleton h="10px" w="100px" mb={3} />
                                <Skeleton h="22px" w="80px" />
                            </Box>
                        </VStack>
                    ) : (
                        <VStack spacing={4} align="stretch">
                            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                                <Box p={4} {...innerSurface}>
                                    <Text fontSize="xs" color="gray.500">💗 Podpora</Text>
                                    <Text fontSize="2xl" fontWeight="800">{supportSummary.countsByType.support}</Text>
                                </Box>
                                <Box p={4} {...innerSurface}>
                                    <Text fontSize="xs" color="gray.500">🤗 Objem</Text>
                                    <Text fontSize="2xl" fontWeight="800">{supportSummary.countsByType.hug}</Text>
                                </Box>
                                <Box p={4} {...innerSurface}>
                                    <Text fontSize="xs" color="gray.500">🌸 Razumem</Text>
                                    <Text fontSize="2xl" fontWeight="800">{supportSummary.countsByType.understand}</Text>
                                </Box>
                                <Box p={4} {...innerSurface}>
                                    <Text fontSize="xs" color="gray.500">🥰 Nisi sama</Text>
                                    <Text fontSize="2xl" fontWeight="800">{supportSummary.countsByType.together}</Text>
                                </Box>
                            </SimpleGrid>
                            <Box p={5} {...innerSurface}>
                                <Text fontSize="xs" color="gray.500">Support score</Text>
                                <Text fontSize="2xl" fontWeight="800">{supportSummary.supportScore}</Text>
                            </Box>
                        </VStack>
                    )}
                </>
            );
        }
        return null;
    };

    return (
        <Box
            flex="1"
            display="flex"
            flexDirection="column"
            minH={0}
            w="100%"
            maxW="100%"
            alignSelf="stretch"
            bg="gray.50"
            sx={{ overflowAnchor: "none" }}
        >
            <Box flex="1" display="flex" flexDirection="column" minH={0} w="100%" maxW="100%">
                <Container
                    maxW="8xl"
                    mx="auto"
                    w="100%"
                    pt={{ base: 10, md: 14 }}
                    pb={{ base: 6, md: 8 }}
                    px={{ base: 4, md: 8 }}
                    flex="1"
                    display="flex"
                    flexDirection="column"
                >
                    {notifBanner ? (
                        <Alert
                            status={notifBanner.key === "suspended" ? "warning" : "success"}
                            rounded="xl"
                            mb={6}
                            borderWidth="1px"
                            borderColor={notifBanner.key === "suspended" ? "orange.200" : "green.200"}
                        >
                            <AlertIcon />
                            <Box>
                                <AlertTitle fontWeight="800">{notifBanner.title}</AlertTitle>
                                {notifBanner.desc ? <AlertDescription>{notifBanner.desc}</AlertDescription> : null}
                            </Box>
                        </Alert>
                    ) : null}
                    {isOwnProfile && user?.isSuspended ? (
                        <Alert status="warning" rounded="xl" mb={6} variant="subtle">
                            <AlertIcon />
                            <Box>
                                <AlertTitle fontWeight="800">Vaš profil je začasno onemogočen</AlertTitle>
                                <AlertDescription>
                                    Če menite, da gre za napako, lahko zahtevate pregled.
                                </AlertDescription>
                                <Button
                                    mt={3}
                                    size="sm"
                                    colorScheme="orange"
                                    rounded="lg"
                                    onClick={handleProfileAppeal}
                                    isLoading={appealBusy}
                                >
                                    Zahtevaj pregled
                                </Button>
                            </Box>
                        </Alert>
                    ) : null}
                    <Grid
                        flex={{ base: "unset", lg: "1" }}
                        w="100%"
                        maxW="100%"
                        minW={0}
                        templateColumns={{
                            base: "minmax(0, 1fr)",
                            lg: "minmax(200px, min(280px, 26vw)) minmax(0, 1fr)",
                            xl: "minmax(260px, 300px) minmax(0, 1fr)",
                        }}
                        gap={{ base: 6, md: 8 }}
                        alignItems="stretch"
                        alignContent="start"
                    >
                        <GridItem alignSelf="start">
                            <Box
                                {...surface}
                                overflow="hidden"
                                position="relative"
                            >
                                <Box h="72px" bgGradient="linear(to-r, brand.500, pink.400)" position="relative">
                                    <Box
                                        position="absolute"
                                        inset={0}
                                        bgGradient="linear(to-t, rgba(255,255,255,0.2), transparent)"
                                        pointerEvents="none"
                                    />
                                    {!isOwnProfile && currentUser?.id && (showProfileOverflowMenu || showAdminProfileMenu) ? (
                                        <Box position="absolute" top={2} right={2} zIndex={2}>
                                            <Menu placement="bottom-end">
                                                <MenuButton
                                                    as={IconButton}
                                                    icon={<BsThreeDots />}
                                                    variant="solid"
                                                    size="sm"
                                                    borderRadius="full"
                                                    aria-label="Več možnosti"
                                                    bg="whiteAlpha.900"
                                                    color="gray.700"
                                                    boxShadow="sm"
                                                    _hover={{ bg: "white", color: "pink.600" }}
                                                />
                                                <MenuList zIndex={1600} borderRadius="xl" py={2} fontSize="sm" boxShadow="lg">
                                                    {showProfileOverflowMenu ? (
                                                        <MenuItem icon={<FiFlag />} onClick={onReportOpen}>
                                                            Prijavi neprimeren profil
                                                        </MenuItem>
                                                    ) : null}
                                                    {showStandaloneBlock ? (
                                                        <MenuItem
                                                            color="red.600"
                                                            icon={<FiSlash />}
                                                            onClick={handleBlock}
                                                            isDisabled={isBlocking}
                                                        >
                                                            Blokiraj uporabnika
                                                        </MenuItem>
                                                    ) : null}
                                                    {showAdminProfileMenu ? (
                                                        <MenuItem
                                                            color={user?.isSuspended ? "green.700" : "red.600"}
                                                            icon={user?.isSuspended ? <FiUserCheck /> : <FiUserX />}
                                                            onClick={handleToggleSuspend}
                                                        >
                                                            {user?.isSuspended ? "Odstrani suspenz (Admin)" : "Suspendiraj profil (Admin)"}
                                                        </MenuItem>
                                                    ) : null}
                                                </MenuList>
                                            </Menu>
                                        </Box>
                                    ) : null}
                                </Box>
                                <Box px={{ base: 5, md: 6 }} pb={5} pt={0} mt="-40px" position="relative">
                                    <VStack spacing={4} align="center" w="full">
                                        <Avatar
                                            src={buildAvatarDisplayUrl(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME, user.avatarUrl)}
                                            name={user.username}
                                            size="xl"
                                            bg="pink.50"
                                            color="brand.600"
                                            border="4px solid"
                                            borderColor="white"
                                            boxShadow="0 10px 28px rgba(15, 23, 42, 0.12)"
                                        />
                                        <VStack spacing={3} align="center" w="full" maxW="100%">
                                            <Heading
                                                size="md"
                                                bgGradient="linear(135deg, #D94B8C 0%, #EC5F8C 50%, #F48FB1 100%)"
                                                bgClip="text"
                                                fontWeight="800"
                                                letterSpacing="-0.02em"
                                                textAlign="center"
                                                noOfLines={2}
                                                w="full"
                                                px={1}
                                            >
                                                {user.username}
                                            </Heading>
                                            {!isOwnProfile && currentUser?.id ? (
                                                <Flex
                                                    justify="center"
                                                    align="center"
                                                    flexWrap="wrap"
                                                    gap={2}
                                                    w="full"
                                                >
                                                    <FriendButton
                                                        userId={Number(id)}
                                                        publicProfile
                                                        onRelationshipChange={onFriendRelationshipChange}
                                                        onOpenReportProfile={
                                                            friendRel?.status === "friends" ? onReportOpen : undefined
                                                        }
                                                    />
                                                    <Button
                                                        size="sm"
                                                        bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
                                                        color="white"
                                                        leftIcon={<FiMessageCircle />}
                                                        rounded="full"
                                                        fontWeight="700"
                                                        px={5}
                                                        _hover={{
                                                            bgGradient: "linear(135deg, #D94B8C 0%, #EC5F8C 100%)",
                                                            boxShadow: "0 8px 24px rgba(236, 95, 140, 0.35)",
                                                        }}
                                                        onClick={() => {
                                                            window.dispatchEvent(
                                                                new CustomEvent("messenger-open", { detail: { userId: Number(id) } })
                                                            );
                                                        }}
                                                    >
                                                        Sporočilo
                                                    </Button>
                                                </Flex>
                                            ) : null}
                                        </VStack>
                                    </VStack>
                                </Box>

                                {user.bio?.trim() ? (
                                    <>
                                        <Divider borderColor="gray.100" />
                                        <Box px={{ base: 5, md: 6 }} py={5}>
                                            <Text fontSize="10px" fontWeight="800" color="gray.500" textTransform="uppercase" letterSpacing="0.08em" mb={2}>
                                                O meni
                                            </Text>
                                            <ExpandableText
                                                text={user.bio.trim()}
                                                maxLines={5}
                                                fontSize="sm"
                                                lineHeight="1.75"
                                                color="gray.700"
                                            />
                                        </Box>
                                    </>
                                ) : null}

                                <Divider borderColor="gray.100" />

                                <Box px={5} py={4}>
                                    <SimpleGrid columns={3} spacing={3} w="full">
                                        <VStack spacing={1} minW={0}>
                                            <Text fontSize="xl" fontWeight="800" color="pink.500" letterSpacing="-0.02em" lineHeight="1.1">
                                                {user.stats?.totalPosts ?? "—"}
                                            </Text>
                                            <Text fontSize="xs" color="gray.600" fontWeight="600" textAlign="center" lineHeight="1.25" px={0.5} noOfLines={2}>
                                                Objave
                                            </Text>
                                        </VStack>
                                        <VStack spacing={1} minW={0}>
                                            <Tooltip
                                                hasArrow
                                                label="Support score prejet na njeni vsebini: 💗 in 🤗 = 2 točki, 🌸 in 🥰 = 1. Vključuje objave in komentarje pod njenimi objavami."
                                                placement="top"
                                            >
                                                <Text fontSize="xl" fontWeight="800" color="pink.500" letterSpacing="-0.02em" cursor="help" lineHeight="1.1">
                                                    {user.stats?.receivedSupportScore ??
                                                        user.stats?.totalSupportReactions ??
                                                        0}
                                                </Text>
                                            </Tooltip>
                                            <Text fontSize="xs" color="gray.600" fontWeight="600" textAlign="center" lineHeight="1.25" px={0.5} noOfLines={2}>
                                                Prejeta podpora
                                            </Text>
                                        </VStack>
                                        <VStack
                                            spacing={1}
                                            minW={0}
                                            cursor={canOpenFriendsLists ? "pointer" : "default"}
                                            role={canOpenFriendsLists ? "button" : undefined}
                                            tabIndex={canOpenFriendsLists ? 0 : undefined}
                                            aria-label={canOpenFriendsLists ? "Odpri seznam prijateljev" : undefined}
                                            onClick={
                                                canOpenFriendsLists
                                                    ? () => {
                                                        setFriendsModalVariant("friends");
                                                        onFriendsModalOpen();
                                                    }
                                                    : undefined
                                            }
                                            onKeyDown={
                                                canOpenFriendsLists
                                                    ? (e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault();
                                                            setFriendsModalVariant("friends");
                                                            onFriendsModalOpen();
                                                        }
                                                    }
                                                    : undefined
                                            }
                                            _hover={canOpenFriendsLists ? { opacity: 0.88 } : undefined}
                                        >
                                            <Text fontSize="xl" fontWeight="800" color="pink.500" letterSpacing="-0.02em" lineHeight="1.1">
                                                {user.stats?.friendCount ?? "—"}
                                            </Text>
                                            <Text fontSize="xs" color="gray.600" fontWeight="600" textAlign="center" lineHeight="1.25" px={0.5} noOfLines={2}>
                                                Prijatelji
                                            </Text>
                                        </VStack>
                                    </SimpleGrid>
                                    {!isOwnProfile &&
                                    currentUser?.id &&
                                    canOpenFriendsLists &&
                                    mutualPreview.total > 0 ? (
                                                <HStack
                                                    justify="center"
                                                    spacing={2.5}
                                                    mt={4}
                                                    pt={3}
                                                    borderTopWidth="1px"
                                                    borderTopColor="gray.100"
                                                    flexWrap="wrap"
                                                    cursor="pointer"
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-label="Odpri skupne prijatelje"
                                                    onClick={() => {
                                                        setFriendsModalVariant("mutual");
                                                        onFriendsModalOpen();
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault();
                                                            setFriendsModalVariant("mutual");
                                                            onFriendsModalOpen();
                                                        }
                                                    }}
                                                    _hover={{ opacity: 0.88 }}
                                                >
                                                    <Text fontSize="sm" fontWeight="600" color="gray.700">
                                                        Skupni prijatelji
                                                    </Text>
                                                    <HStack spacing={1.5} minW={0}>
                                                        <Avatar
                                                            size="xs"
                                                            src={buildAvatarDisplayUrl(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME, mutualPreview.items[0]?.avatarUrl)}
                                                            name={mutualPreview.items[0]?.username || "?"}
                                                        />
                                                        <Text fontSize="sm" fontWeight="700" color="gray.700" noOfLines={1} maxW="140px">
                                                            {mutualPreview.items[0]?.username || "Neznano"}
                                                        </Text>
                                                    </HStack>
                                                    {mutualPreview.total > 1 ? (
                                                        <Text fontSize="sm" fontWeight="700" color="pink.500">
                                                            +{mutualPreview.total - 1}
                                                        </Text>
                                                    ) : null}
                                                </HStack>
                                            ) : null}
                                </Box>
                            </Box>
                        </GridItem>

                        <GridItem display="flex" flexDirection="column">
                            <VStack align="stretch" spacing={{ base: 4, md: 5 }} flex="1">
                                <Box
                                    {...profileContentBackdrop}
                                    scrollMarginTop={{ base: "calc(68px + env(safe-area-inset-top, 0px))", md: "80px" }}
                                    position={{ base: "sticky", md: "static" }}
                                    top={{ base: "calc(68px + env(safe-area-inset-top, 0px))", md: "auto" }}
                                    zIndex={{ base: 20, md: "auto" }}
                                    bg="gray.50"
                                >
                                    <Flex
                                        as="nav"
                                        role="tablist"
                                        aria-label="Vsebina profila"
                                        flexWrap="wrap"
                                        align="flex-end"
                                        gap={0}
                                        borderBottom="1px solid"
                                        borderColor="gray.100"
                                        px={{ base: 1, md: 2 }}
                                        bg="white"
                                    >
                                        {tabDefs.map((t) => {
                                            const isActive = activePublicTab === t.key;
                                            return (
                                                <Button
                                                    key={t.key}
                                                    role="tab"
                                                    aria-selected={isActive}
                                                    variant="unstyled"
                                                    display="flex"
                                                    alignItems="center"
                                                    justifyContent="center"
                                                    px={{ base: 3, md: 4 }}
                                                    py={3}
                                                    minH="44px"
                                                    borderRadius="none"
                                                    borderBottom="2px solid"
                                                    borderColor={isActive ? "pink.500" : "transparent"}
                                                    color={isActive ? "gray.900" : "gray.500"}
                                                    fontWeight={isActive ? "700" : "500"}
                                                    fontSize="sm"
                                                    mb="-1px"
                                                    transition="color 0.15s, border-color 0.15s"
                                                    _hover={{
                                                        color: "gray.800",
                                                        bg: "pink.50",
                                                    }}
                                                    _focusVisible={{
                                                        boxShadow: "outline",
                                                        zIndex: 1,
                                                    }}
                                                    onClick={() => selectPublicTab(t.key)}
                                                >
                                                    {t.label}
                                                </Button>
                                            );
                                        })}
                                    </Flex>
                                </Box>
                                <Box p={6} pb={2} flex="1" sx={{ overflowAnchor: "none" }}>
                                    {renderTabBody()}
                                </Box>
                            </VStack>
                        </GridItem>
                    </Grid>
                </Container>

                <ReportProfileModal
                    isOpen={isReportOpen}
                    onClose={onReportClose}
                    profileUserId={Number(id)}
                    profileUsername={user.username}
                />
                <AlertDialog
                    isOpen={suspendedDialogOpen}
                    leastDestructiveRef={suspendedCancelRef}
                    onClose={() => {
                        setSuspendedDialogOpen(false);
                        navigate("/");
                    }}
                    isCentered
                >
                    <AlertDialogOverlay />
                    <AlertDialogContent borderRadius="2xl" mx={{ base: 3, md: "auto" }}>
                        <AlertDialogHeader fontSize="lg" fontWeight="800">
                            Profil ni na voljo
                        </AlertDialogHeader>
                        <AlertDialogBody>
                            Ta uporabniški profil je bil odstranjen zaradi kršitve pravil skupnosti.
                        </AlertDialogBody>
                        <AlertDialogFooter>
                            <Button
                                ref={suspendedCancelRef}
                                onClick={() => {
                                    setSuspendedDialogOpen(false);
                                    navigate("/");
                                }}
                                rounded="xl"
                                w={{ base: "full", sm: "auto" }}
                            >
                                Zapri
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <PostDetailModal
                    postId={detailPostId}
                    isOpen={detailPostId != null}
                    onClose={closePostDetail}
                    previewFromFeed={
                        detailPostPreview && detailPostId != null && String(detailPostPreview.id) === String(detailPostId)
                            ? detailPostPreview
                            : null
                    }
                />
                <ProfileFriendsModal
                    isOpen={isFriendsModalOpen}
                    onClose={onFriendsModalClose}
                    profileUserId={id != null ? Number(id) : null}
                    variant={friendsModalVariant}
                    listAccessHint={friendsListHint}
                />
            </Box>
        </Box>
    );
};

export default PublicProfile;
