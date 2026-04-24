import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, Container, Heading, VStack, HStack, Button, Input, Text, Divider, useToast, Avatar, IconButton, Skeleton, Grid, GridItem, SimpleGrid, Spinner, Flex, Tooltip, useDisclosure } from "@chakra-ui/react";
import { FiFileText, FiShoppingBag, FiCamera, FiExternalLink, FiSettings } from "react-icons/fi";
import { useNavigate, useSearchParams } from "react-router-dom";
import Footer from "../Footer/Footer";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { API_BASE } from "../../api/config";
import ExpandableText from "../common/ExpandableText";
import { MARKETPLACE_CHANGED_EVENT, OPEN_LISTING_DETAIL_MODAL } from "../Marketplace/marketplaceModalConstants";
import { mergeMeResponseIntoUser } from "../../utils/authz";
import { uploadPostImageToCloudinary, validatePostImageFile, getCloudinaryConfig, buildAvatarDisplayUrl } from "../../utils/cloudinaryUpload";
import PostDetailModal from "./PostDetailModal";
import CompactProfilePostCard from "./CompactProfilePostCard";
import ListingCard from "../Marketplace/ListingCard";
import ProfileFriendsModal from "./ProfileFriendsModal";
import { useInfiniteScroll } from "../../hooks/forum/useInfiniteScroll";
import { submitModerationAppeal } from "../../api/moderation";

const POST_PAGE_SIZE = 12;
const LISTINGS_PAGE_SIZE = 18;

const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "null"); }
  catch { return null; }
};

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

const Profile = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm: openConfirm, toast: openModal } = useAppToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notifBanner, setNotifBanner] = useState(null);
  const [appealBusy, setAppealBusy] = useState(false);

  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);
  const [postsHasMore, setPostsHasMore] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("posts");

  const [stats, setStats] = useState({
    totalPosts: 0,
    totalThumbUps: 0,
    totalSupportReactions: 0,
    totalComments: 0
  });


  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsLoadingMore, setListingsLoadingMore] = useState(false);
  const [listingsHasMore, setListingsHasMore] = useState(true);

  const [supportSummary, setSupportSummary] = useState(null);
  const [supportLoading, setSupportLoading] = useState(false);

  const [detailPostId, setDetailPostId] = useState(null);
  const [detailPostPreview, setDetailPostPreview] = useState(null);
  const closePostDetail = useCallback(() => {
    setDetailPostId(null);
    setDetailPostPreview(null);
  }, []);

  const { isOpen: friendsModalOpen, onOpen: onFriendsModalOpen, onClose: onFriendsModalClose } = useDisclosure();

  const [heroPublic, setHeroPublic] = useState(null);

  const listingCloudName = useMemo(() => {
    const cfg = getCloudinaryConfig();
    return cfg.ok ? cfg.cloudName : null;
  }, []);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      navigate("/prijava");
      return;
    }

    let abort = false;
    async function loadProfile() {
      try {
        setLoading(true);

        const res = await fetch(`${API_BASE}/api/users/me`, {
          credentials: 'include'
        });

        if (res.status === 401) {
          localStorage.removeItem("user");
          window.dispatchEvent(new Event("auth-changed"));
          navigate("/prijava");
          return;
        }

        if (!res.ok) throw new Error("Napaka pri branju profila");
        const data = await res.json();
        if (!abort) {
          setUser(data);
          const prev = getStoredUser();
          const merged = mergeMeResponseIntoUser(prev, data);
          if (merged) {
            localStorage.setItem("user", JSON.stringify(merged));
            window.dispatchEvent(new Event("auth-changed"));
          }
        }
      } catch (err) {
        console.error(err);
        if (!abort) {
          toast({
            status: "error",
            title: "Napaka pri nalaganju profila",
            description: err.message
          });
        }
      } finally {
        if (!abort) setLoading(false);
      }
    }
    loadProfile();
    return () => { abort = true; };
  }, [navigate, toast]);

  // One-time banner from notification click (profile suspended/unsuspended) + mark read.
  useEffect(() => {
    const notifId = searchParams.get("notif");
    const bannerKey = searchParams.get("banner");
    const hasBanner = Boolean(bannerKey && bannerKey.trim());
    const hasNotif = Boolean(notifId && notifId.trim());

    if (hasBanner) {
      const bk = String(bannerKey || "").trim();
      const title =
        bk === "suspended"
          ? "Vaš profil je začasno onemogočen"
          : bk === "appeal_upheld"
            ? "Vaš profil je začasno onemogočen"
          : bk === "unsuspended"
            ? "Vaš profil je ponovno aktiven"
            : "Moderacija";
      const desc =
        bk === "suspended"
          ? "Profil je onemogočen zaradi kršitve pravil skupnosti. Če menite, da gre za napako, lahko zahtevate pregled."
          : bk === "appeal_upheld"
            ? "Zahtevek za pregled je bil zavrnjen. Profil ostaja onemogočen zaradi kršitve pravil skupnosti. Lahko oddate nov zahtevek (če je dovoljen)."
          : bk === "unsuspended"
            ? "Profil je ponovno dostopen."
            : "";
      setNotifBanner({ key: bk, title, desc });
    }

    if (hasNotif) {
      const nid = String(notifId || "").trim();
      fetch(`${API_BASE}/api/notifications/${encodeURIComponent(nid)}/read`, { method: "PUT", credentials: "include" })
        .catch(() => {});
    }

    if (hasBanner || hasNotif) {
      const next = new URLSearchParams(searchParams);
      next.delete("notif");
      next.delete("banner");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleProfileAppeal = useCallback(async () => {
    if (!user?.id || !user?.isSuspended) return;
    if (appealBusy) return;
    setAppealBusy(true);
    try {
      await submitModerationAppeal({ targetType: "user_profile", targetId: Number(user.id) });
      openModal({ status: "success", title: "Zahtevek za pregled je oddan" });
    } catch (e) {
      openModal({
        status: "error",
        title: "Oddaja ni uspela",
        description: e?.message || "Poskusite znova.",
        duration: null,
      });
    } finally {
      setAppealBusy(false);
    }
  }, [appealBusy, openModal, user?.id, user?.isSuspended]);

  useEffect(() => {
    if (!user?.id) return;
    let abort = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/users/${user.id}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!abort) {
          setHeroPublic({
            stats: data.stats,
            createdAt: data.createdAt,
          });
        }
      } catch {
        /* javen profil ni kritičen za delovanje */
      }
    })();
    return () => {
      abort = true;
    };
  }, [user?.id]);

  const fetchPostStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users/me/post-stats`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setStats({
        totalPosts: data.totalPosts ?? 0,
        totalThumbUps: data.totalThumbUps ?? 0,
        totalSupportReactions: data.totalSupportReactions ?? 0,
        totalComments: data.totalComments ?? 0,
      });
    } catch (err) {
      console.error(err);
    }
  }, []);

  const listingsOffsetRef = useRef(0);
  const listingsHasMoreRef = useRef(true);
  const listingsLoadingRef = useRef(false);
  const listingsLoadingMoreRef = useRef(false);
  const listingsHasFetchedRef = useRef(false);

  useEffect(() => {
    listingsHasFetchedRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    listingsHasMoreRef.current = listingsHasMore;
  }, [listingsHasMore]);

  const fetchMyListings = useCallback(async (append = false) => {
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
        `${API_BASE}/api/users/me/listings?limit=${LISTINGS_PAGE_SIZE}&offset=${offset}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Napaka pri branju oglasov");
      const data = await res.json();
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
      if (!append) listingsHasFetchedRef.current = true;
    }
  }, [toast]);

  const fetchMySupportSummary = useCallback(async (period) => {
    try {
      setSupportLoading(true);
      const res = await fetch(`${API_BASE}/api/users/me/support-summary?period=${encodeURIComponent(period)}&recentLimit=0`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Napaka pri branju podpore");
      const data = await res.json();
      setSupportSummary(data);
    } catch (err) {
      console.error(err);
      toast({ status: "error", title: "Napaka pri nalaganju podpore", description: err.message });
    } finally {
      setSupportLoading(false);
    }
  }, [toast]);

  const postsOffsetRef = useRef(0);
  const postsHasMoreRef = useRef(true);
  const postsLoadingRef = useRef(false);
  const postsLoadingMoreRef = useRef(false);

  useEffect(() => {
    postsHasMoreRef.current = postsHasMore;
  }, [postsHasMore]);

  const fetchUserPosts = useCallback(
    async (append = false) => {
      try {
        if (append) {
          if (postsLoadingMoreRef.current || !postsHasMoreRef.current) return;
          postsLoadingMoreRef.current = true;
          setPostsLoadingMore(true);
        } else {
          if (postsLoadingRef.current) return;
          postsLoadingRef.current = true;
          setPostsLoading(true);
          setPosts([]);
          setPostsHasMore(true);
          postsHasMoreRef.current = true;
          postsOffsetRef.current = 0;
        }
        const offset = append ? postsOffsetRef.current : 0;
        const res = await fetch(
          `${API_BASE}/api/users/me/posts?limit=${POST_PAGE_SIZE}&offset=${offset}`,
          { credentials: "include" }
        );

        if (!res.ok) throw new Error("Napaka pri branju objav");
        const data = await res.json();
        const postsList = data.items || [];
        const total = data.pagination?.total ?? postsList.length;
        const hasMore = offset + postsList.length < total;
        postsHasMoreRef.current = hasMore;
        setPostsHasMore(hasMore);
        setPosts((prev) => {
          const next = append ? [...prev, ...postsList] : postsList;
          postsOffsetRef.current = next.length;
          return next;
        });
        await fetchPostStats();
      } catch (err) {
        console.error(err);
        toast({
          status: "error",
          title: "Napaka pri nalaganju objav",
          description: err.message,
        });
      } finally {
        postsLoadingRef.current = false;
        postsLoadingMoreRef.current = false;
        setPostsLoading(false);
        setPostsLoadingMore(false);
      }
    },
    [toast, fetchPostStats]
  );

  const loadMorePosts = useCallback(
    (append) => {
      if (!append) return;
      fetchUserPosts(true);
    },
    [fetchUserPosts]
  );

  const loadMoreListings = useCallback(
    (append) => {
      if (!append) return;
      fetchMyListings(true);
    },
    [fetchMyListings]
  );

  const profilePostsSentinelRef = useInfiniteScroll(
    loadMorePosts,
    postsHasMore,
    postsLoading,
    postsLoadingMore,
    activeTab !== "posts" ? "paused" : ""
  );
  const profileListingsSentinelRef = useInfiniteScroll(
    loadMoreListings,
    listingsHasMore,
    listingsLoading,
    listingsLoadingMore,
    activeTab !== "marketplace" ? "paused" : ""
  );

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) return;
    fetchPostStats();
    fetchUserPosts(false);
  }, [fetchPostStats, fetchUserPosts]);

  useEffect(() => {
    const onCreated = () => {
      fetchPostStats();
      fetchUserPosts(false);
    };
    window.addEventListener("forum-post-created", onCreated);
    return () => window.removeEventListener("forum-post-created", onCreated);
  }, [fetchUserPosts, fetchPostStats]);

  useEffect(() => {
    if (!user?.id) return;
    if (activeTab !== "marketplace") return;
    if (listingsHasFetchedRef.current) return;
    if (listingsLoadingRef.current) return;
    fetchMyListings(false);
  }, [activeTab, user?.id, fetchMyListings]);

  const handleProfileTabClick = useCallback(
    (tabId) => {
      if (tabId === "marketplace" && user?.id && !listingsHasFetchedRef.current) {
        setListingsLoading(true);
      }
      setActiveTab(tabId);
    },
    [user?.id]
  );

  useEffect(() => {
    if (!user) return;
    if (activeTab !== "support") return;
    if (!supportSummary && !supportLoading) {
      fetchMySupportSummary("month");
    }
  }, [activeTab, user, supportSummary, supportLoading, fetchMySupportSummary]);

  useEffect(() => {
    const onMarketplaceChanged = () => {
      if (!user?.id) return;
      listingsHasFetchedRef.current = false;
      if (activeTab !== "marketplace") return;
      fetchMyListings(false);
    };
    window.addEventListener(MARKETPLACE_CHANGED_EVENT, onMarketplaceChanged);
    return () => window.removeEventListener(MARKETPLACE_CHANGED_EVENT, onMarketplaceChanged);
  }, [user?.id, activeTab, fetchMyListings]);

  const applyUserResponseToState = useCallback((data) => {
    const storedUser = getStoredUser();
    if (storedUser) {
      localStorage.setItem("user", JSON.stringify({ ...storedUser, ...data }));
      window.dispatchEvent(new Event("auth-changed"));
    }
    setUser((prev) => (prev ? { ...prev, ...data } : prev));
  }, []);

  const persistAvatarUrl = useCallback(
    async (nextAvatarUrl) => {
      const res = await fetch(`${API_BASE}/api/users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ avatarUrl: nextAvatarUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || "Napaka pri shranjevanju avatarja");
      }
      applyUserResponseToState(data);
      toast({
        status: "success",
        title: nextAvatarUrl ? "Profilna slika posodobljena" : "Profilna slika odstranjena",
      });
    },
    [applyUserResponseToState, toast]
  );

  const handleAvatarFileChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0] || null;
      e.target.value = "";
      if (!file) return;
      const v = validatePostImageFile(file);
      if (!v.ok) {
        toast({ status: "error", title: v.error });
        return;
      }
      setAvatarUploading(true);
      try {
        const { secureUrl } = await uploadPostImageToCloudinary(file);
        await persistAvatarUrl(secureUrl);
      } catch (err) {
        console.error(err);
        toast({
          status: "error",
          title: err?.message || "Napaka pri nalaganju slike",
        });
      } finally {
        setAvatarUploading(false);
      }
    },
    [persistAvatarUrl, toast]
  );

  const handleRemoveAvatar = useCallback(async () => {
    if (!user?.avatarUrl) return;
    const ok = await openConfirm({
      title: "Odstranitev profilne slike",
      description: "Ali želite odstraniti profilno sliko?",
      confirmText: "Odstrani",
      cancelText: "Prekliči",
      destructive: true,
    });
    if (!ok) return;
    setAvatarUploading(true);
    try {
      await persistAvatarUrl(null);
    } catch (err) {
      console.error(err);
      toast({
        status: "error",
        title: err?.message || "Napaka pri odstranjevanju slike",
      });
    } finally {
      setAvatarUploading(false);
    }
  }, [user?.avatarUrl, persistAvatarUrl, toast, openConfirm]);

  const formatDate = (iso) =>
    new Date(iso).toLocaleString("sl-SI", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

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
    return null;
  }

  const tabDefs = [
    { id: "posts", label: "Objave" },
    { id: "marketplace", label: "Oglasi" },
    { id: "support", label: "Podpora drugim" },
  ];

  const hs = heroPublic?.stats;
  const displayTotalPosts = hs?.totalPosts ?? stats.totalPosts;
  const displaySupportScore =
    hs?.receivedSupportScore ?? hs?.totalSupportReactions ?? stats.totalSupportReactions;
  const displayFriendCount = hs?.friendCount ?? 0;

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
              status={notifBanner.key === "suspended" || notifBanner.key === "appeal_upheld" ? "warning" : "success"}
              rounded="xl"
              mb={6}
              borderWidth="1px"
              borderColor={notifBanner.key === "suspended" || notifBanner.key === "appeal_upheld" ? "orange.200" : "green.200"}
            >
              <AlertIcon />
              <VStack align="start" spacing={2} w="full">
                <AlertTitle fontWeight="800">{notifBanner.title}</AlertTitle>
                {notifBanner.desc ? <AlertDescription>{notifBanner.desc}</AlertDescription> : null}
                {notifBanner.key === "suspended" || notifBanner.key === "appeal_upheld" ? (
                  <Button
                    size="sm"
                    colorScheme="orange"
                    rounded="lg"
                    alignSelf="flex-start"
                    onClick={handleProfileAppeal}
                    isLoading={appealBusy}
                    isDisabled={!user?.isSuspended}
                  >
                    Zahtevaj pregled
                  </Button>
                ) : null}
              </VStack>
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
              <Box {...surface} overflow="hidden" position="relative">
                <Box h="72px" bgGradient="linear(to-r, brand.500, pink.400)" position="relative">
                  <Box
                    position="absolute"
                    inset={0}
                    bgGradient="linear(to-t, rgba(255,255,255,0.2), transparent)"
                    pointerEvents="none"
                  />
                </Box>
                <Box px={{ base: 5, md: 6 }} pb={5} pt={0} mt="-40px" position="relative">
                  <input
                    ref={avatarFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={handleAvatarFileChange}
                  />
                  <VStack spacing={4} align="center" w="full">
                    <Box position="relative" w="fit-content" mx="auto">
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
                      <IconButton
                        position="absolute"
                        bottom="-2px"
                        right="-2px"
                        size="sm"
                        rounded="full"
                        colorScheme="pink"
                        aria-label="Naloži profilno sliko"
                        icon={<FiCamera />}
                        isLoading={avatarUploading}
                        onClick={() => avatarFileInputRef.current?.click()}
                        boxShadow="md"
                      />
                    </Box>
                    <Button
                      size="xs"
                      variant="link"
                      colorScheme="gray"
                      fontWeight="600"
                      isDisabled={avatarUploading || !user.avatarUrl}
                      onClick={handleRemoveAvatar}
                    >
                      Odstrani sliko
                    </Button>
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
                      <Text fontSize="sm" color="gray.600" textAlign="center" lineHeight="1.5" px={1}>
                        {user.email}
                      </Text>
                      <HStack spacing={2} flexWrap="wrap" justify="center" w="full">
                        <Button
                          size="sm"
                          variant="outline"
                          colorScheme="pink"
                          rounded="full"
                          px={4}
                          leftIcon={<FiExternalLink />}
                          onClick={() => navigate(`/user/${user.id}`)}
                        >
                          Poglej javni profil
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          colorScheme="gray"
                          rounded="full"
                          px={4}
                          leftIcon={<FiSettings />}
                          onClick={() => navigate("/nastavitve")}
                        >
                          Nastavitve
                        </Button>
                      </HStack>
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
                        {displayTotalPosts}
                      </Text>
                      <Text fontSize="xs" color="gray.600" fontWeight="600" textAlign="center" lineHeight="1.25" px={0.5} noOfLines={2}>
                        Objave
                      </Text>
                    </VStack>
                    <VStack spacing={1} minW={0}>
                      <Tooltip
                        hasArrow
                        label="Support score prejet na tvoji vsebini: 💗 in 🤗 = 2 točki, 🌸 in 🥰 = 1. Vključuje objave in komentarje pod tvojimi objavami."
                        placement="top"
                      >
                        <Text fontSize="xl" fontWeight="800" color="pink.500" letterSpacing="-0.02em" cursor="help" lineHeight="1.1">
                          {displaySupportScore}
                        </Text>
                      </Tooltip>
                      <Text fontSize="xs" color="gray.600" fontWeight="600" textAlign="center" lineHeight="1.25" px={0.5} noOfLines={2}>
                        Prejeta podpora
                      </Text>
                    </VStack>
                    <VStack
                      spacing={1}
                      minW={0}
                      cursor="pointer"
                      role="button"
                      tabIndex={0}
                      aria-label="Odpri seznam prijateljev"
                      onClick={onFriendsModalOpen}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onFriendsModalOpen();
                        }
                      }}
                      _hover={{ opacity: 0.88 }}
                    >
                      <Text fontSize="xl" fontWeight="800" color="pink.500" letterSpacing="-0.02em" lineHeight="1.1">
                        {displayFriendCount}
                      </Text>
                      <Text fontSize="xs" color="gray.600" fontWeight="600" textAlign="center" lineHeight="1.25" px={0.5} noOfLines={2}>
                        Prijatelji
                      </Text>
                    </VStack>
                  </SimpleGrid>
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
                    aria-label="Moj profil"
                    flexWrap="wrap"
                    align="flex-end"
                    gap={0}
                    borderBottom="1px solid"
                    borderColor="gray.100"
                    px={{ base: 1, md: 2 }}
                    bg="white"
                  >
                    {tabDefs.map((t) => {
                      const isActive = activeTab === t.id;
                      return (
                        <Button
                          key={t.id}
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
                          onClick={() => handleProfileTabClick(t.id)}
                        >
                          {t.label}
                        </Button>
                      );
                    })}
                  </Flex>
                </Box>
                <Box
                  px={{ base: 0, md: 0 }}
                  pb={2}
                  flex="1"
                  sx={{ overflowAnchor: "none" }}
                >
                  <VStack spacing={6} align="stretch">
                    {activeTab === "posts" && (
                      <Box {...profileContentBackdrop} p={6}>
                        {postsLoading ? (
                          <VStack spacing={3}>
                            <Skeleton height="100px" />
                            <Skeleton height="100px" />
                            <Skeleton height="100px" />
                          </VStack>
                        ) : posts.length === 0 ? (
                          <Box {...innerSurface} p={10} textAlign="center">
                            <FiFileText size={40} color="#CBD5E0" style={{ margin: "0 auto 12px" }} />
                            <Text fontSize="sm" color="gray.600" fontWeight="600">
                              Nimate še nobenih objav
                            </Text>

                          </Box>
                        ) : (
                          <SimpleGrid
                            columns={{ base: 1, sm: 2, md: 2, lg: 2, xl: 3 }}
                            spacing={4}
                            w="full"
                            alignItems="stretch"
                            justifyItems="stretch"
                          >
                            {posts.map((post, idx) => (
                              <Box key={`my-post-${post?.id ?? "na"}-${idx}`} w="100%" h="100%" minW={0} display="flex" flexDirection="column">
                                <CompactProfilePostCard
                                  post={post}
                                  onOpen={(p) => {
                                    if (!p?.id) return;
                                    setDetailPostPreview(p);
                                    setDetailPostId(p.id);
                                  }}
                                  dateLabel={formatDate(post.createdAt)}
                                />
                              </Box>
                            ))}
                          </SimpleGrid>
                        )}
                        <Box ref={profilePostsSentinelRef} h="2px" w="full" aria-hidden />
                        {!postsLoading && posts.length > 0 && postsLoadingMore ? (
                          <HStack justify="center" py={6}>
                            <Spinner color="pink.400" />
                          </HStack>
                        ) : null}
                        {!postsLoading && !postsHasMore && posts.length > 0 ? (
                          <Text textAlign="center" fontSize="sm" color="gray.500" py={4}>
                            Ni več objav
                          </Text>
                        ) : null}
                      </Box>
                    )}

                    {activeTab === "marketplace" && (
                      <Box {...profileContentBackdrop} p={6}>
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
                                key={`my-listing-skel-${i}`}
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
                            <FiShoppingBag size={40} color="#CBD5E0" style={{ margin: "0 auto 12px" }} />
                            <Text fontSize="sm" color="gray.600" fontWeight="600">Nimaš še oglasov</Text>
                            <Text fontSize="sm" color="gray.500" mt={1}>Ustvari prvi oglas v marketplace.</Text>
                          </Box>
                        ) : (
                          <SimpleGrid
                            columns={{ base: 1, sm: 2, md: 2, lg: 2, xl: 3 }}
                            spacing={4}
                            w="full"
                            alignItems="stretch"
                            justifyItems="stretch"
                          >
                            {listings.map((l, idx) => (
                              <Box key={`my-listing-${l?.id ?? "na"}-${idx}`} w="100%" h="100%" minW={0} display="flex" flexDirection="column">
                                <ListingCard
                                  variant="profile"
                                  listing={l}
                                  cloudName={listingCloudName}
                                  onOpen={(listingId) =>
                                    window.dispatchEvent(
                                      new CustomEvent(OPEN_LISTING_DETAIL_MODAL, { detail: { listingId } })
                                    )
                                  }
                                />
                              </Box>
                            ))}
                          </SimpleGrid>
                        )}
                        <Box ref={profileListingsSentinelRef} h="2px" w="full" aria-hidden />
                        {!listingsLoading && listings.length > 0 && listingsLoadingMore ? (
                          <HStack justify="center" py={6}>
                            <Spinner color="pink.400" />
                          </HStack>
                        ) : null}
                        {!listingsLoading && !listingsHasMore && listings.length > 0 ? (
                          <Text textAlign="center" fontSize="sm" color="gray.500" py={4}>
                            Ni več oglasov
                          </Text>
                        ) : null}
                      </Box>
                    )}

                    {activeTab === "support" && (
                      <Box {...profileContentBackdrop} p={6}>
                        {supportLoading || !supportSummary ? (
                          <VStack spacing={4} align="stretch" aria-busy>
                            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                              {Array.from({ length: 4 }).map((_, i) => (
                                <Box key={`support-skel-${i}`} p={4} {...innerSurface}>
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
                      </Box>
                    )}
                  </VStack>
                </Box>
              </VStack>
            </GridItem>
          </Grid>
        </Container>

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
          isOpen={friendsModalOpen}
          onClose={onFriendsModalClose}
          profileUserId={user?.id}
          variant="friends"
        />
      </Box>
    </Box>
  );
};

export default Profile;

