import { useState, useEffect, useCallback, useRef } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { useNavigate } from "react-router-dom";
import { Box, Container, Heading, Text, Tabs, TabList, TabPanels, Tab, TabPanel, Table, Thead, Tbody, Tr, Th, Td, Badge, Button, Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerBody, DrawerCloseButton, HStack, VStack, Stack, SimpleGrid, AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogOverlay, FormControl, FormLabel, Input, Select, Icon, Spinner, useBreakpointValue } from "@chakra-ui/react";
import { FiShield } from "react-icons/fi";
import { getStoredUser } from "../../utils/helpers";
import { INPUT_LIMITS } from "../../constants/inputLimits";
import { canAccessModeration, hasPermission } from "../../utils/authz";
import {
  fetchModerationReportsFiltered,
  reviewModerationReport,
  ignoreModerationReport,
  hideModerationContent,
  hideModerationReport,
  unhideModerationContent,
  deleteModerationContent,
  fetchPendingAppeals,
  resolveModerationAppeal,
  fetchAdminDeletedContent,
  purgeDeletedTarget,
  fetchHiddenPosts,
  fetchSuspendedUsers,
  unsuspendUser,
} from "../../api/moderation";
import ModerationRolesPanel from "./ModerationRolesPanel";

const STATUSES = ["pending", "reviewed", "resolved"];

function targetTypeLabel(t) {
  const m = {
    post: "Objava",
    comment: "Komentar",
    marketplace_listing: "Oglas",
    user_profile: "Profil",
  };
  return m[t] || t;
}

function statusBadgeColor(s) {
  if (s === "pending") return "orange";
  if (s === "reviewed") return "blue";
  if (s === "resolved") return "green";
  return "gray";
}

function TargetVisibilityBadge({ targetType, targetIsHidden }) {
  const supportsHidden = targetType === "post" || targetType === "comment" || targetType === "marketplace_listing";
  if (!supportsHidden) {
    return (
      <Text as="span" fontSize="xs" color="gray.400">
        —
      </Text>
    );
  }
  if (targetIsHidden === null || targetIsHidden === undefined) {
    return (
      <Badge colorScheme="gray" fontSize="0.65rem">
        Ni v bazi
      </Badge>
    );
  }
  if (targetIsHidden) {
    return (
      <Badge colorScheme="red" fontSize="0.65rem">
        Zakrita
      </Badge>
    );
  }
  return (
    <Badge colorScheme="green" fontSize="0.65rem">
      Odkrita
    </Badge>
  );
}

function formatDt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("sl-SI", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function ModerationPage() {
  const navigate = useNavigate();
  const { toast } = useAppToast();
  const cancelRef = useRef();

  const [user, setUser] = useState(() => getStoredUser());
  const [tabIndex, setTabIndex] = useState(0);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 15;
  const [filterTargetType, setFilterTargetType] = useState("");

  const [drawerReport, setDrawerReport] = useState(null);
  const [acting, setActing] = useState(false);

  const [hideAlertOpen, setHideAlertOpen] = useState(false);
  const [reportPendingHide, setReportPendingHide] = useState(null);

  const [unhideType, setUnhideType] = useState("post");
  const [unhideId, setUnhideId] = useState("");
  const [unhideBusy, setUnhideBusy] = useState(false);

  const [appealItems, setAppealItems] = useState([]);
  const [appealLoading, setAppealLoading] = useState(false);
  const [appealActingId, setAppealActingId] = useState(null);

  const [deletedItems, setDeletedItems] = useState([]);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [deletedCursor, setDeletedCursor] = useState(null);
  const [deletedHasMore, setDeletedHasMore] = useState(false);
  const [deletedType, setDeletedType] = useState("");
  const [deletedSource, setDeletedSource] = useState("");
  const [deletedQ, setDeletedQ] = useState("");
  const deletedLimit = 30;

  const [hiddenPostsItems, setHiddenPostsItems] = useState([]);
  const [hiddenPostsLoading, setHiddenPostsLoading] = useState(false);
  const [hiddenPostsCursor, setHiddenPostsCursor] = useState(null);
  const [hiddenPostsHasMore, setHiddenPostsHasMore] = useState(false);
  const hiddenPostsLimit = 30;

  const [suspendedUsersItems, setSuspendedUsersItems] = useState([]);
  const [suspendedUsersLoading, setSuspendedUsersLoading] = useState(false);
  const [suspendedUsersCursor, setSuspendedUsersCursor] = useState(null);
  const [suspendedUsersHasMore, setSuspendedUsersHasMore] = useState(false);
  const suspendedUsersLimit = 30;

  useEffect(() => {
    const sync = () => setUser(getStoredUser());
    window.addEventListener("auth-changed", sync);
    return () => window.removeEventListener("auth-changed", sync);
  }, []);

  useEffect(() => {
    if (!user) {
      navigate("/prijava");
    }
  }, [user, navigate]);

  const isAdmin = Boolean(user?.isAdmin);
  const maxTabIndex = isAdmin ? 7 : 5;
  const isAppealsTab = tabIndex === 3;
  const isHiddenTab = tabIndex === 4;
  const isSuspendedTab = tabIndex === 5;
  const isRolesTab = isAdmin && tabIndex === 6;
  const isDeletedTab = isAdmin && tabIndex === 7;
  const reportStatus = STATUSES[Math.min(tabIndex, 2)];

  useEffect(() => {
    if (tabIndex > maxTabIndex) setTabIndex(0);
  }, [maxTabIndex, tabIndex]);

  const loadAppeals = useCallback(async () => {
    setAppealLoading(true);
    try {
      const data = await fetchPendingAppeals();
      setAppealItems(data.items || []);
    } catch (e) {
      console.error(e);
      if (e?.status === 401) {
        setAppealItems([]);
        return;
      }
      toast({ status: "error", title: "Napaka", description: e.message || "Nalaganje zahtev ni uspelo." });
      setAppealItems([]);
    } finally {
      setAppealLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isAppealsTab) {
      loadAppeals();
    }
  }, [isAppealsTab, loadAppeals]);

  const loadDeleted = useCallback(
    async ({ reset } = {}) => {
      if (!isDeletedTab) return;
      setDeletedLoading(true);
      try {
        const data = await fetchAdminDeletedContent({
          limit: deletedLimit,
          cursor: reset ? null : deletedCursor,
          type: deletedType,
          source: deletedSource,
          q: deletedQ,
          eventType: "deleted",
        });
        const items = data.items || [];
        const next = data.pageInfo?.nextCursor ?? null;
        const hasMore = Boolean(data.pageInfo?.hasMore);
        setDeletedCursor(next);
        setDeletedHasMore(hasMore);
        setDeletedItems((prev) => (reset ? items : [...prev, ...items]));
      } catch (e) {
        console.error(e);
        toast({ status: "error", title: "Napaka", description: e.message || "Nalaganje izbrisanih vsebin ni uspelo." });
        if (reset) {
          setDeletedItems([]);
          setDeletedCursor(null);
          setDeletedHasMore(false);
        }
      } finally {
        setDeletedLoading(false);
      }
    },
    [isDeletedTab, toast, deletedCursor, deletedType, deletedSource, deletedQ]
  );

  const loadHiddenPosts = useCallback(
    async ({ reset } = {}) => {
      if (!isHiddenTab) return;
      setHiddenPostsLoading(true);
      try {
        const cursor = reset ? null : hiddenPostsCursor;
        const data = await fetchHiddenPosts({ limit: hiddenPostsLimit, cursor });
        const items = data.items || [];
        setHiddenPostsItems((prev) => (reset ? items : [...prev, ...items]));
        setHiddenPostsCursor(data.pageInfo?.nextCursor ?? null);
        setHiddenPostsHasMore(Boolean(data.pageInfo?.hasMore));
      } catch (e) {
        console.error(e);
        toast({ status: "error", title: "Napaka", description: e.message || "Nalaganje skritih objav ni uspelo." });
        if (reset) {
          setHiddenPostsItems([]);
          setHiddenPostsCursor(null);
          setHiddenPostsHasMore(false);
        }
      } finally {
        setHiddenPostsLoading(false);
      }
    },
    [isHiddenTab, toast, hiddenPostsCursor]
  );

  const loadSuspendedUsers = useCallback(
    async ({ reset } = {}) => {
      if (!isSuspendedTab) return;
      setSuspendedUsersLoading(true);
      try {
        const cursor = reset ? null : suspendedUsersCursor;
        const data = await fetchSuspendedUsers({ limit: suspendedUsersLimit, cursor });
        const items = data.items || [];
        setSuspendedUsersItems((prev) => (reset ? items : [...prev, ...items]));
        setSuspendedUsersCursor(data.pageInfo?.nextCursor ?? null);
        setSuspendedUsersHasMore(Boolean(data.pageInfo?.hasMore));
      } catch (e) {
        console.error(e);
        toast({ status: "error", title: "Napaka", description: e.message || "Nalaganje suspendiranih profilov ni uspelo." });
        if (reset) {
          setSuspendedUsersItems([]);
          setSuspendedUsersCursor(null);
          setSuspendedUsersHasMore(false);
        }
      } finally {
        setSuspendedUsersLoading(false);
      }
    },
    [isSuspendedTab, toast, suspendedUsersCursor]
  );

  useEffect(() => {
    if (isDeletedTab) {
      setDeletedItems([]);
      setDeletedCursor(null);
      setDeletedHasMore(false);
      void loadDeleted({ reset: true });
    }
  }, [isDeletedTab, deletedType, deletedSource]);

  useEffect(() => {
    if (isHiddenTab) {
      setHiddenPostsItems([]);
      setHiddenPostsCursor(null);
      setHiddenPostsHasMore(false);
      void loadHiddenPosts({ reset: true });
    }
  }, [isHiddenTab]);

  useEffect(() => {
    if (isSuspendedTab) {
      setSuspendedUsersItems([]);
      setSuspendedUsersCursor(null);
      setSuspendedUsersHasMore(false);
      void loadSuspendedUsers({ reset: true });
    }
  }, [isSuspendedTab]);

  const onSearchDeleted = async () => {
    setDeletedItems([]);
    setDeletedCursor(null);
    setDeletedHasMore(false);
    await loadDeleted({ reset: true });
  };

  const doPurge = async (targetType, targetId) => {
    const ok = await confirm({
      title: "Trajno izbrišem iz baze?",
      description:
        "To je nepovratno. Vsebina bo fizično izbrisana iz baze, v auditu pa bo ostal zapis.\n\nSpodaj vnesite natančno besedo PURGE za potrditev.",
      destructive: true,
      confirmText: "Da, trajno izbriši",
      cancelText: "Prekliči",
      requireExactText: "PURGE",
      inputPlaceholder: 'Vnesite \"PURGE\"',
    });
    if (!ok) return;
    try {
      await purgeDeletedTarget(targetType, targetId);
      toast({ status: "success", title: "Trajno izbrisano" });
      setDeletedItems((prev) => prev.filter((x) => !(x.targetType === targetType && Number(x.targetId) === Number(targetId))));
    } catch (e) {
      toast({ status: "error", title: "Napaka", description: e.message || "Trajni izbris ni uspel." });
    }
  };

  const loadReports = useCallback(async () => {
    if (isRolesTab || isAppealsTab || isDeletedTab || isHiddenTab || isSuspendedTab) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchModerationReportsFiltered({
        status: reportStatus,
        targetType: filterTargetType,
        limit,
        offset,
      });
      setItems(data.items || []);
      setTotal(data.pagination?.total ?? (data.items || []).length);
    } catch (e) {
      console.error(e);
      if (e?.status === 401) {
        // Session expired / logged out: don't show an error modal here.
        setItems([]);
        setTotal(0);
        return;
      }
      if (e.status === 403) {
        toast({ status: "error", title: "Dostop zavrnjen", description: "Nimate pravice za branje prijav." });
      } else {
        toast({ status: "error", title: "Napaka", description: e.message || "Nalaganje ni uspelo." });
      }
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [reportStatus, offset, isRolesTab, isAppealsTab, isDeletedTab, isHiddenTab, isSuspendedTab, toast, filterTargetType]);

  useEffect(() => {
    setOffset(0);
  }, [reportStatus]);
  useEffect(() => {
    setOffset(0);
  }, [filterTargetType]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const canReview = hasPermission(user, "moderation.reports.review");
  const canHide = hasPermission(user, "moderation.content.hide");
  const canUnhide = hasPermission(user, "moderation.content.unhide");
  const canDelete = Boolean(isAdmin);
  // Backend enforces admin-only for (un)suspend; keep UI consistent.
  const canUnsuspend = Boolean(isAdmin);

  const doUnhidePost = async (postId) => {
    if (!canUnhide) return;
    try {
      await unhideModerationContent("post", postId);
      toast({ status: "success", title: "Objava odkrita" });
      setHiddenPostsItems((prev) => prev.filter((x) => Number(x.id) !== Number(postId)));
      // Cursor pagination: count is not tracked here.
    } catch (e) {
      toast({ status: "error", title: "Napaka", description: e.message || "Odkritje ni uspelo." });
    }
  };

  const doUnsuspendUser = async (userId) => {
    if (!canUnsuspend) return;
    try {
      await unsuspendUser(userId);
      toast({ status: "success", title: "Suspenz odstranjen" });
      setSuspendedUsersItems((prev) => prev.filter((x) => Number(x.id) !== Number(userId)));
      // Cursor pagination: count is not tracked here.
    } catch (e) {
      toast({ status: "error", title: "Napaka", description: e.message || "Odstranitev suspenza ni uspela." });
    }
  };

  const handleAppealResolve = async (appealId, decision) => {
    if (!canReview) return;
    setAppealActingId(appealId);
    try {
      await resolveModerationAppeal(appealId, decision);
      toast({
        status: "success",
        title: decision === "reversed" ? "Vsebina je spet javna" : "Skrito ostane",
        description:
          decision === "reversed"
            ? "Odločitev je zabeležena; avtor bo videl objavo med drugimi."
            : "Pritožba je zaključena; vsebina ostane skrita.",
      });
      await loadAppeals();
      window.dispatchEvent(new Event("moderation-queue-changed"));
    } catch (e) {
      toast({ status: "error", title: "Napaka", description: e.message });
    } finally {
      setAppealActingId(null);
    }
  };

  const openDrawer = (row) => setDrawerReport(row);
  const closeDrawer = () => setDrawerReport(null);

  const afterAction = async () => {
    closeDrawer();
    setHideAlertOpen(false);
    setReportPendingHide(null);
    await loadReports();
  };

  const handleReview = async () => {
    if (!drawerReport?.id) return;
    setActing(true);
    try {
      await reviewModerationReport(drawerReport.id);
      toast({ status: "success", title: "Označeno kot pregledano" });
      await afterAction();
    } catch (e) {
      toast({ status: "error", title: "Napaka", description: e.message });
    } finally {
      setActing(false);
    }
  };

  const handleIgnore = async () => {
    if (!drawerReport?.id) return;
    setActing(true);
    try {
      await ignoreModerationReport(drawerReport.id);
      toast({ status: "success", title: "Prijava zaključena", description: "Označena kot prezrta." });
      await afterAction();
    } catch (e) {
      toast({ status: "error", title: "Napaka", description: e.message });
    } finally {
      setActing(false);
    }
  };

  const handleAdminDelete = async () => {
    if (!canDelete) return;
    if (!drawerReport?.targetType || !drawerReport?.targetId) return;
    const isSupported =
      drawerReport.targetType === "post" ||
      drawerReport.targetType === "comment" ||
      drawerReport.targetType === "marketplace_listing";
    if (!isSupported) return;
    const ok = await confirm({
      title: "Izbriši vsebino?",
      description: "Brisanje je trajno. Povezane prijave bodo zaključene kot \"content_deleted\".",
      confirmText: "Izbriši",
      cancelText: "Prekliči",
      destructive: true,
    });
    if (!ok) return;
    setActing(true);
    try {
      await deleteModerationContent(drawerReport.targetType, drawerReport.targetId);
      toast({ status: "success", title: "Vsebina izbrisana" });
      await afterAction();
    } catch (e) {
      toast({ status: "error", title: "Napaka", description: e.message });
    } finally {
      setActing(false);
    }
  };

  const confirmHide = () => {
    const rep = reportPendingHide;
    if (!rep?.id) return;
    setHideAlertOpen(false);
    setReportPendingHide(null);
    (async () => {
      setActing(true);
      try {
        const data =
          rep.targetType === "marketplace_listing"
            ? await hideModerationContent("marketplace_listing", rep.targetId)
            : await hideModerationReport(rep.id);
        toast({
          status: "success",
          title: data?.alreadyHidden ? "Vsebina je bila že skrita" : "Vsebina skrita",
          description: "Povezane prijave so zaključene.",
        });
        await afterAction();
      } catch (e) {
        toast({ status: "error", title: "Napaka", description: e.message });
      } finally {
        setActing(false);
      }
    })();
  };

  const requestHide = () => {
    if (!drawerReport) return;
    setReportPendingHide(drawerReport);
    setHideAlertOpen(true);
  };

  const handleUnhide = async () => {
    const tid = parseInt(String(unhideId).trim(), 10);
    if (!Number.isFinite(tid) || tid < 1) {
      toast({ status: "warning", title: "Vnesi veljaven ID" });
      return;
    }
    setUnhideBusy(true);
    try {
      await unhideModerationContent(unhideType, tid);
      toast({ status: "success", title: "Vsebina odkrita" });
      setUnhideId("");
    } catch (e) {
      toast({ status: "error", title: "Napaka", description: e.message });
    } finally {
      setUnhideBusy(false);
    }
  };

  const openForumPost = (postId) => {
    navigate(`/?post=${postId}`);
  };

  const drawerSize = useBreakpointValue({ base: "full", md: "md" }) ?? "md";

  if (!user) {
    return null;
  }

  if (!canAccessModeration(user)) {
    return (
      <Box minH="70vh" display="flex" flexDirection="column">
        <Container maxW="lg" py={20} flex="1">
          <VStack spacing={4} textAlign="center">
            <Icon as={FiShield} boxSize={12} color="gray.400" />
            <Heading size="md">Dostop zavrnjen</Heading>
            <Text color="gray.600">Nimate pravic za moderacijsko nadzorno ploščo.</Text>
            <Button as="button" colorScheme="pink" onClick={() => navigate("/")} rounded="xl">
              Na forum
            </Button>
          </VStack>
        </Container>
      </Box>
    );
  }

  return (
    <Box minH="100vh" display="flex" flexDirection="column" bg="gray.50">
      <Container maxW="6xl" py={{ base: 5, md: 10 }} px={{ base: 3, sm: 4, md: 6 }} flex="1">
        <HStack spacing={3} mb={2} align="flex-start">
          <Icon as={FiShield} color="pink.500" boxSize={{ base: 7, md: 8 }} flexShrink={0} mt={0.5} />
          <Heading size={{ base: "md", md: "lg" }} fontWeight="800" letterSpacing="-0.02em" color="gray.800" lineHeight="short">
            Moderacija
          </Heading>
        </HStack>
        <Text color="gray.600" fontSize="sm" mb={{ base: 5, md: 8 }} noOfLines={{ base: 4, md: "none" }}>
          Pregled prijav in ukrepi po pravicah. Zavihek „Zahteve za pregled“: avtorji skrite vsebine lahko zaprosijo za ponoven pregled; vi odločite, ali ostane skrito ali se spet prikaže javnosti. Obvestila avtorjem so brez imen moderatorjev.
        </Text>

        <Tabs
          isLazy
          index={tabIndex}
          onChange={setTabIndex}
          colorScheme="pink"
          variant="enclosed"
          rounded="xl"
        >
          <FormControl display={{ base: "block", md: "none" }} mb={4}>
            <FormLabel fontSize="xs" fontWeight="800" color="gray.600" textTransform="uppercase" letterSpacing="0.06em" mb={1.5}>
              Zavihek
            </FormLabel>
            <Select
              value={tabIndex}
              onChange={(e) => setTabIndex(Number(e.target.value, 10))}
              rounded="xl"
              bg="white"
              borderColor="gray.200"
              size="md"
              fontWeight="600"
            >
              <option value={0}>V čakanju</option>
              <option value={1}>Pregledane</option>
              <option value={2}>Zaključene</option>
              <option value={3}>Zahteve za pregled</option>
              <option value={4}>Skrite objave</option>
              <option value={5}>Suspendirani profili</option>
              {isAdmin ? <option value={6}>Vloge uporabnikov</option> : null}
              {isAdmin ? <option value={7}>Izbrisane vsebine</option> : null}
            </Select>
          </FormControl>

          <TabList display={{ base: "none", md: "flex" }} flexWrap="wrap" borderColor="gray.200" bg="white" rounded="xl" p={1} gap={1}>
            <Tab rounded="lg" fontWeight="700">
              V čakanju
            </Tab>
            <Tab rounded="lg" fontWeight="700">
              Pregledane
            </Tab>
            <Tab rounded="lg" fontWeight="700">
              Zaključene
            </Tab>
            <Tab rounded="lg" fontWeight="700">
              Zahteve za pregled
            </Tab>
            <Tab rounded="lg" fontWeight="700">
              Skrite objave
            </Tab>
            <Tab rounded="lg" fontWeight="700">
              Suspendirani profili
            </Tab>
            {isAdmin && (
              <Tab rounded="lg" fontWeight="700">
                Vloge uporabnikov
              </Tab>
            )}
            {isAdmin && (
              <Tab rounded="lg" fontWeight="700">
                Izbrisane vsebine
              </Tab>
            )}
          </TabList>

          <TabPanels>
            <TabPanel px={0}>
              <Box mb={4} display="flex" justifyContent="flex-end">
                <FormControl maxW={{ base: "full", md: "260px" }}>
                  <FormLabel fontSize="xs" fontWeight="800" color="gray.600" textTransform="uppercase" letterSpacing="0.06em" mb={1.5}>
                    Tip tarče
                  </FormLabel>
                  <Select
                    value={filterTargetType}
                    onChange={(e) => setFilterTargetType(e.target.value)}
                    rounded="xl"
                    bg="white"
                    borderColor="gray.200"
                    size="md"
                    fontWeight="600"
                  >
                    <option value="">Vse</option>
                    <option value="post">Objave</option>
                    <option value="comment">Komentarji</option>
                    <option value="marketplace_listing">Oglasi</option>
                    <option value="user_profile">Profili</option>
                  </Select>
                </FormControl>
              </Box>
              {renderReportsTable()}
            </TabPanel>
            <TabPanel px={0}>
              <Box mb={4} display="flex" justifyContent="flex-end">
                <FormControl maxW={{ base: "full", md: "260px" }}>
                  <FormLabel fontSize="xs" fontWeight="800" color="gray.600" textTransform="uppercase" letterSpacing="0.06em" mb={1.5}>
                    Tip tarče
                  </FormLabel>
                  <Select
                    value={filterTargetType}
                    onChange={(e) => setFilterTargetType(e.target.value)}
                    rounded="xl"
                    bg="white"
                    borderColor="gray.200"
                    size="md"
                    fontWeight="600"
                  >
                    <option value="">Vse</option>
                    <option value="post">Objave</option>
                    <option value="comment">Komentarji</option>
                    <option value="marketplace_listing">Oglasi</option>
                    <option value="user_profile">Profili</option>
                  </Select>
                </FormControl>
              </Box>
              {renderReportsTable()}
            </TabPanel>
            <TabPanel px={0}>
              <Box mb={4} display="flex" justifyContent="flex-end">
                <FormControl maxW={{ base: "full", md: "260px" }}>
                  <FormLabel fontSize="xs" fontWeight="800" color="gray.600" textTransform="uppercase" letterSpacing="0.06em" mb={1.5}>
                    Tip tarče
                  </FormLabel>
                  <Select
                    value={filterTargetType}
                    onChange={(e) => setFilterTargetType(e.target.value)}
                    rounded="xl"
                    bg="white"
                    borderColor="gray.200"
                    size="md"
                    fontWeight="600"
                  >
                    <option value="">Vse</option>
                    <option value="post">Objave</option>
                    <option value="comment">Komentarji</option>
                    <option value="marketplace_listing">Oglasi</option>
                    <option value="user_profile">Profili</option>
                  </Select>
                </FormControl>
              </Box>
              {renderReportsTable()}
            </TabPanel>
            <TabPanel px={0}>
              {renderAppealsTable()}
            </TabPanel>
            <TabPanel px={0} pt={6}>
              <Box bg="white" borderRadius="2xl" borderWidth="1px" borderColor="gray.100" p={{ base: 4, md: 6 }} boxShadow="sm">
                <HStack justify="space-between" mb={3} flexWrap="wrap">
                  <Box>
                    <Heading size="sm" fontWeight="800" color="gray.800">
                      Skrite objave
                    </Heading>
                    <Text fontSize="sm" color="gray.600">
                      Prikazanih: {hiddenPostsItems.length}
                    </Text>
                  </Box>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setHiddenPostsItems([]);
                      setHiddenPostsOffset(0);
                      setHiddenPostsTotal(0);
                      void loadHiddenPosts({ reset: true });
                    }}
                    isDisabled={hiddenPostsLoading}
                  >
                    Osveži
                  </Button>
                </HStack>

                <Box overflowX="auto" borderWidth="1px" borderColor="gray.100" rounded="xl">
                  <Table size="sm">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th>ID</Th>
                        <Th>Naslov</Th>
                        <Th>Avtor</Th>
                        <Th>Skrita</Th>
                        <Th textAlign="right">Akcije</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {hiddenPostsLoading && hiddenPostsItems.length === 0 ? (
                        <Tr>
                          <Td colSpan={5}>
                            <HStack py={6} justify="center">
                              <Spinner size="sm" />
                              <Text fontSize="sm" color="gray.600">
                                Nalagam…
                              </Text>
                            </HStack>
                          </Td>
                        </Tr>
                      ) : hiddenPostsItems.length === 0 ? (
                        <Tr>
                          <Td colSpan={5}>
                            <Text py={6} textAlign="center" fontSize="sm" color="gray.600">
                              Trenutno ni skritih objav.
                            </Text>
                          </Td>
                        </Tr>
                      ) : (
                        hiddenPostsItems.map((it) => (
                          <Tr key={String(it.id)}>
                            <Td>{it.id}</Td>
                            <Td maxW="420px">
                              <Text noOfLines={2} fontWeight="600" color="gray.800">
                                {it.title || "—"}
                              </Text>
                            </Td>
                            <Td>
                              <Text fontSize="sm" color="gray.700">
                                {it.authorUsername || "—"}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                {it.authorEmail || ""}
                              </Text>
                            </Td>
                            <Td>
                              <Text fontSize="sm" color="gray.700">
                                {formatDt(it.hiddenAt || it.createdAt)}
                              </Text>
                            </Td>
                            <Td textAlign="right">
                              <Button size="xs" rounded="lg" onClick={() => doUnhidePost(it.id)} isDisabled={!canUnhide}>
                                Odkrij
                              </Button>
                            </Td>
                          </Tr>
                        ))
                      )}
                    </Tbody>
                  </Table>
                </Box>

                <HStack justify="flex-end" mt={3}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => loadHiddenPosts({ reset: false })}
                    isDisabled={hiddenPostsLoading || !hiddenPostsHasMore}
                  >
                    Naloži več
                  </Button>
                </HStack>
              </Box>
            </TabPanel>
            <TabPanel px={0} pt={6}>
              <Box bg="white" borderRadius="2xl" borderWidth="1px" borderColor="gray.100" p={{ base: 4, md: 6 }} boxShadow="sm">
                <HStack justify="space-between" mb={3} flexWrap="wrap">
                  <Box>
                    <Heading size="sm" fontWeight="800" color="gray.800">
                      Suspendirani profili
                    </Heading>
                    <Text fontSize="sm" color="gray.600">
                      Prikazanih: {suspendedUsersItems.length}
                    </Text>
                  </Box>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSuspendedUsersItems([]);
                      setSuspendedUsersOffset(0);
                      setSuspendedUsersTotal(0);
                      void loadSuspendedUsers({ reset: true });
                    }}
                    isDisabled={suspendedUsersLoading}
                  >
                    Osveži
                  </Button>
                </HStack>

                <Box overflowX="auto" borderWidth="1px" borderColor="gray.100" rounded="xl">
                  <Table size="sm">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th>ID</Th>
                        <Th>Uporabnik</Th>
                        <Th>Email</Th>
                        <Th>Suspendiran</Th>
                        <Th>Razlog</Th>
                        <Th textAlign="right">Akcije</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {suspendedUsersLoading && suspendedUsersItems.length === 0 ? (
                        <Tr>
                          <Td colSpan={6}>
                            <HStack py={6} justify="center">
                              <Spinner size="sm" />
                              <Text fontSize="sm" color="gray.600">
                                Nalagam…
                              </Text>
                            </HStack>
                          </Td>
                        </Tr>
                      ) : suspendedUsersItems.length === 0 ? (
                        <Tr>
                          <Td colSpan={6}>
                            <Text py={6} textAlign="center" fontSize="sm" color="gray.600">
                              Trenutno ni suspendiranih profilov.
                            </Text>
                          </Td>
                        </Tr>
                      ) : (
                        suspendedUsersItems.map((it) => (
                          <Tr key={String(it.id)}>
                            <Td>{it.id}</Td>
                            <Td>
                              <Text fontWeight="600" color="gray.800">
                                {it.username || "—"}
                              </Text>
                            </Td>
                            <Td>
                              <Text fontSize="sm" color="gray.700">
                                {it.email || "—"}
                              </Text>
                            </Td>
                            <Td>
                              <Text fontSize="sm" color="gray.700">
                                {formatDt(it.suspendedAt)}
                              </Text>
                            </Td>
                            <Td maxW="420px">
                              <Text fontSize="sm" color="gray.700" noOfLines={2}>
                                {it.suspensionReason || "—"}
                              </Text>
                            </Td>
                            <Td textAlign="right">
                              <Button size="xs" rounded="lg" onClick={() => doUnsuspendUser(it.id)} isDisabled={!canUnsuspend}>
                                Odstrani suspenz
                              </Button>
                            </Td>
                          </Tr>
                        ))
                      )}
                    </Tbody>
                  </Table>
                </Box>

                <HStack justify="flex-end" mt={3}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => loadSuspendedUsers({ reset: false })}
                    isDisabled={suspendedUsersLoading || !suspendedUsersHasMore}
                  >
                    Naloži več
                  </Button>
                </HStack>
              </Box>
            </TabPanel>
            {isAdmin && (
              <TabPanel px={0} pt={6}>
                <Box bg="white" borderRadius="2xl" borderWidth="1px" borderColor="gray.100" p={{ base: 4, md: 6 }} boxShadow="sm">
                  <ModerationRolesPanel />
                </Box>
              </TabPanel>
            )}
            {isAdmin && (
              <TabPanel px={0} pt={6}>
                <Box bg="white" borderRadius="2xl" borderWidth="1px" borderColor="gray.100" p={{ base: 4, md: 6 }} boxShadow="sm">
                  <SimpleGrid columns={{ base: 1, md: 4 }} spacing={3} mb={4}>
                    <FormControl>
                      <FormLabel fontSize="xs" fontWeight="800" color="gray.600" textTransform="uppercase" letterSpacing="0.06em" mb={1.5}>
                        Tip
                      </FormLabel>
                      <Select value={deletedType} onChange={(e) => setDeletedType(e.target.value)} rounded="xl" bg="white" borderColor="gray.200" fontWeight="600">
                        <option value="">Vse</option>
                        <option value="user">Profil</option>
                        <option value="post">Objava</option>
                        <option value="comment">Komentar</option>
                        <option value="marketplace_listing">Oglas</option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="xs" fontWeight="800" color="gray.600" textTransform="uppercase" letterSpacing="0.06em" mb={1.5}>
                        Vir
                      </FormLabel>
                      <Select value={deletedSource} onChange={(e) => setDeletedSource(e.target.value)} rounded="xl" bg="white" borderColor="gray.200" fontWeight="600">
                        <option value="">Vse</option>
                        <option value="user">Uporabnik</option>
                        <option value="admin">Admin</option>
                        <option value="system">Sistem</option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="xs" fontWeight="800" color="gray.600" textTransform="uppercase" letterSpacing="0.06em" mb={1.5}>
                        Iskanje
                      </FormLabel>
                      <Input value={deletedQ} onChange={(e) => setDeletedQ(e.target.value)} rounded="xl" bg="white" borderColor="gray.200" placeholder="ID, naslov, uporabnik…" />
                    </FormControl>
                    <FormControl display="flex" alignItems="flex-end">
                      <Button onClick={onSearchDeleted} colorScheme="pink" rounded="xl" w="full" isLoading={deletedLoading}>
                        Išči
                      </Button>
                    </FormControl>
                  </SimpleGrid>

                  <Table size="sm" variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Tip</Th>
                        <Th>ID</Th>
                        <Th>DeletedAt</Th>
                        <Th>DeletedBy</Th>
                        <Th>Vir</Th>
                        <Th>Opis</Th>
                        <Th textAlign="right">Akcije</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {deletedItems.map((it) => {
                        const label =
                          it.targetType === "user"
                            ? "Profil"
                            : it.targetType === "post"
                              ? "Objava"
                              : it.targetType === "comment"
                                ? "Komentar"
                                : it.targetType === "marketplace_listing"
                                  ? "Oglas"
                                  : it.targetType;
                        const desc =
                          it.summary?.postTitle ||
                          it.summary?.listingTitle ||
                          it.summary?.targetUsername ||
                          (it.summary?.commentContent ? String(it.summary.commentContent).slice(0, 40) : "") ||
                          it.metadata?.postTitle ||
                          it.metadata?.listingTitle ||
                          it.metadata?.username ||
                          "—";
                        return (
                          <Tr key={`${it.id}`}>
                            <Td fontWeight="700">{label}</Td>
                            <Td>{it.targetId}</Td>
                            <Td>{formatDt(it.createdAt)}</Td>
                            <Td>{it.actor?.username || "—"}</Td>
                            <Td>
                              <Badge colorScheme={it.source === "admin" ? "purple" : it.source === "system" ? "gray" : "blue"} fontSize="0.65rem">
                                {it.source}
                              </Badge>
                            </Td>
                            <Td maxW="320px">
                              <Text noOfLines={1}>{desc}</Text>
                            </Td>
                            <Td textAlign="right">
                              <HStack justify="flex-end">
                                <Button size="xs" rounded="lg" colorScheme="red" variant="outline" onClick={() => doPurge(it.targetType, it.targetId)}>
                                  Trajno izbriši
                                </Button>
                              </HStack>
                            </Td>
                          </Tr>
                        );
                      })}
                      {deletedItems.length === 0 && !deletedLoading ? (
                        <Tr>
                          <Td colSpan={7}>
                            <Text color="gray.500">Ni izbrisanih vsebin za izbrane filtre.</Text>
                          </Td>
                        </Tr>
                      ) : null}
                    </Tbody>
                  </Table>

                  <Box mt={4} display="flex" justifyContent="center">
                    <Button
                      onClick={() => loadDeleted({ reset: false })}
                      isLoading={deletedLoading}
                      isDisabled={!deletedHasMore}
                      rounded="xl"
                      variant="outline"
                    >
                      Naloži več
                    </Button>
                  </Box>
                </Box>
              </TabPanel>
            )}
          </TabPanels>
        </Tabs>
      </Container>

      <Drawer isOpen={Boolean(drawerReport)} placement="right" size={drawerSize} onClose={closeDrawer}>
        <DrawerOverlay />
        <DrawerContent borderLeftRadius={{ base: "none", md: "2xl" }}>
          <DrawerCloseButton onMouseUp={(e) => e.currentTarget.blur()} />
          <DrawerHeader borderBottomWidth="1px">Podrobnosti prijave</DrawerHeader>
          <DrawerBody pb={{ base: "calc(8px + env(safe-area-inset-bottom, 0px))", md: 6 }}>
            {drawerReport && (
              <VStack align="stretch" spacing={4} pt={2}>
                <Box>
                  <Text fontSize="xs" color="gray.500" fontWeight="700" textTransform="uppercase">
                    Status
                  </Text>
                  <Badge colorScheme={statusBadgeColor(drawerReport.status)} mt={1}>
                    {drawerReport.status}
                  </Badge>
                </Box>
                <Box>
                  <Text fontSize="xs" color="gray.500" fontWeight="700" textTransform="uppercase">
                    Tip
                  </Text>
                  <Text fontWeight="600">{targetTypeLabel(drawerReport.targetType)}</Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="gray.500" fontWeight="700" textTransform="uppercase">
                    ID tarče
                  </Text>
                  <Text fontWeight="600">{drawerReport.targetId}</Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="gray.500" fontWeight="700" textTransform="uppercase">
                    Vidnost za javnost
                  </Text>
                  <Box mt={1}>
                    <TargetVisibilityBadge
                      targetType={drawerReport.targetType}
                      targetIsHidden={drawerReport.targetIsHidden}
                    />
                  </Box>
                </Box>
                <Box>
                  <Text fontSize="xs" color="gray.500" fontWeight="700" textTransform="uppercase">
                    Avtor vsebine
                  </Text>
                  <Text fontWeight="600">{drawerReport.targetAuthorUsername || "—"}</Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="gray.500" fontWeight="700" textTransform="uppercase">
                    E-pošta avtorja
                  </Text>
                  <Text fontWeight="500" fontSize="sm" wordBreak="break-all">
                    {drawerReport.targetAuthorEmail || "—"}
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="gray.500" fontWeight="700" textTransform="uppercase">
                    Prijavitelj
                  </Text>
                  <Text fontWeight="600">{drawerReport.reporterUsername || "—"}</Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="gray.500" fontWeight="700" textTransform="uppercase">
                    Razlog
                  </Text>
                  <Text whiteSpace="pre-wrap">{drawerReport.reason}</Text>
                </Box>

                {drawerReport.targetType === "post" && (
                  <Button
                    variant="outline"
                    colorScheme="pink"
                    onClick={() => openForumPost(drawerReport.targetId)}
                    rounded="xl"
                    w={{ base: "full", md: "auto" }}
                  >
                    Odpri objavo na forumu
                  </Button>
                )}

                <VStack align="stretch" spacing={2} pt={2}>
                  {canReview && drawerReport.status === "pending" && (
                    <Button colorScheme="pink" onClick={handleReview} isLoading={acting} rounded="xl" w={{ base: "full", md: "auto" }}>
                      Označi kot pregledano
                    </Button>
                  )}
                  {canReview && drawerReport.status !== "resolved" && (
                    <Button variant="outline" onClick={handleIgnore} isLoading={acting} rounded="xl" w={{ base: "full", md: "auto" }}>
                      Prezri prijavo
                    </Button>
                  )}
                  {canHide &&
                    (drawerReport.targetType === "post" || drawerReport.targetType === "comment" || drawerReport.targetType === "marketplace_listing") &&
                    drawerReport.status !== "resolved" && (
                      <Button colorScheme="red" variant="outline" onClick={requestHide} isLoading={acting} rounded="xl" w={{ base: "full", md: "auto" }}>
                        Skrij vsebino
                      </Button>
                    )}
                  {canDelete && (drawerReport.targetType === "post" || drawerReport.targetType === "comment" || drawerReport.targetType === "marketplace_listing") && (
                    <Button colorScheme="red" onClick={handleAdminDelete} isLoading={acting} rounded="xl" w={{ base: "full", md: "auto" }}>
                      Izbriši vsebino (Admin)
                    </Button>
                  )}
                </VStack>

                {canUnhide && (
                  <Box borderTopWidth="1px" pt={4} mt={2}>
                    <Text fontWeight="800" mb={3} fontSize="sm">
                      Odkrij vsebino
                    </Text>
                    <FormControl mb={3}>
                      <FormLabel fontSize="sm">Tip</FormLabel>
                      <Select value={unhideType} onChange={(e) => setUnhideType(e.target.value)} rounded="lg">
                        <option value="post">Objava</option>
                        <option value="comment">Komentar</option>
                        <option value="marketplace_listing">Oglas</option>
                      </Select>
                    </FormControl>
                    <FormControl mb={3}>
                      <FormLabel fontSize="sm">ID</FormLabel>
                      <Input
                        value={unhideId}
                        onChange={(e) => setUnhideId(e.target.value)}
                        maxLength={INPUT_LIMITS.NUMERIC_ID_INPUT}
                        rounded="lg"
                        placeholder="npr. 42"
                      />
                    </FormControl>
                    <Button size="sm" colorScheme="pink" onClick={handleUnhide} isLoading={unhideBusy} rounded="lg" w={{ base: "full", md: "auto" }}>
                      Odkrij
                    </Button>
                  </Box>
                )}
              </VStack>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <AlertDialog isOpen={hideAlertOpen} leastDestructiveRef={cancelRef} onClose={() => setHideAlertOpen(false)}>
        <AlertDialogOverlay />
        <AlertDialogContent borderRadius="2xl" mx={{ base: 3, md: "auto" }}>
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            Skrij vsebino?
          </AlertDialogHeader>
          <AlertDialogBody>
            Tarča bo označena kot skrita in javno ne bo več vidna. Povezane odprte prijave bodo zaključene. Ali ste prepričani?
          </AlertDialogBody>
          <AlertDialogFooter flexDirection={{ base: "column-reverse", sm: "row" }} gap={3}>
            <Button ref={cancelRef} onClick={() => setHideAlertOpen(false)} rounded="xl" w={{ base: "full", sm: "auto" }}>
              Prekliči
            </Button>
            <Button colorScheme="red" onClick={confirmHide} rounded="xl" w={{ base: "full", sm: "auto" }}>
              Skrij
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );

  function renderAppealsTable() {
    const mobileEmpty = (
      <Box py={14} textAlign="center" color="gray.500" fontSize="sm" bg="white" rounded="2xl" borderWidth="1px" borderColor="gray.100" boxShadow="sm">
        {appealLoading ? "Nalaganje …" : "Ni odprtih zahtev za pregled."}
      </Box>
    );

    const mobileCards = (
      <VStack spacing={3} align="stretch" display={{ base: "flex", md: "none" }}>
        {appealLoading || appealItems.length === 0 ? (
          mobileEmpty
        ) : (
          appealItems.map((row) => (
            <Box
              key={row.id}
              bg="white"
              borderRadius="2xl"
              borderWidth="1px"
              borderColor="gray.100"
              boxShadow="sm"
              p={4}
            >
              <Text fontSize="xs" color="gray.500" mb={3}>
                {formatDt(row.createdAt)}
              </Text>
              <SimpleGrid columns={2} spacingX={3} spacingY={2} fontSize="sm" mb={3}>
                <Text color="gray.500" fontSize="xs" fontWeight="700">
                  Tip
                </Text>
                <Text fontWeight="600">{targetTypeLabel(row.targetType)}</Text>
                <Text color="gray.500" fontSize="xs" fontWeight="700">
                  ID tarče
                </Text>
                <Text fontWeight="700">{row.targetId}</Text>
                <Text color="gray.500" fontSize="xs" fontWeight="700">
                  Avtor zahteve
                </Text>
                <Text fontWeight="600" noOfLines={2} minW={0}>
                  {row.appellantUsername || "—"}
                </Text>
              </SimpleGrid>
              <Box mb={4}>
                <Text fontSize="xs" fontWeight="700" color="gray.500" textTransform="uppercase" mb={1}>
                  Vsebina (izsek)
                </Text>
                <Text fontSize="sm" color="gray.700" noOfLines={5}>
                  {row.snippet || "—"}
                </Text>
              </Box>
              {canReview ? (
                <Stack spacing={2}>
                  <Button
                    colorScheme="pink"
                    variant="solid"
                    rounded="xl"
                    w="full"
                    isLoading={appealActingId === row.id}
                    onClick={() => handleAppealResolve(row.id, "reversed")}
                  >
                    Odkrij vsebino
                  </Button>
                  <Button
                    colorScheme="gray"
                    rounded="xl"
                    w="full"
                    isLoading={appealActingId === row.id}
                    onClick={() => handleAppealResolve(row.id, "upheld")}
                  >
                    Skrito ostane
                  </Button>
                </Stack>
              ) : (
                <Text fontSize="xs" color="gray.500">
                  Ni pravice za odločitev
                </Text>
              )}
            </Box>
          ))
        )}
      </VStack>
    );

    return (
      <Box>
        {mobileCards}
        <Box
          display={{ base: "none", md: "block" }}
          bg="white"
          borderRadius="2xl"
          borderWidth="1px"
          borderColor="gray.100"
          overflow="hidden"
          boxShadow="sm"
        >
          <Table size="sm">
            <Thead bg="gray.50">
              <Tr>
                <Th>Oddano</Th>
                <Th>Tip</Th>
                <Th>ID</Th>
                <Th display={{ base: "none", md: "table-cell" }}>Avtor zahteve</Th>
                <Th display={{ base: "none", lg: "table-cell" }}>Vsebina</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {appealLoading ? (
                <Tr>
                  <Td colSpan={6} py={10} textAlign="center" color="gray.500">
                    Nalaganje …
                  </Td>
                </Tr>
              ) : appealItems.length === 0 ? (
                <Tr>
                  <Td colSpan={6} py={10} textAlign="center" color="gray.500">
                    Ni odprtih zahtev za pregled.
                  </Td>
                </Tr>
              ) : (
                appealItems.map((row) => (
                  <Tr key={row.id}>
                    <Td whiteSpace="nowrap">{formatDt(row.createdAt)}</Td>
                    <Td>{targetTypeLabel(row.targetType)}</Td>
                    <Td fontWeight="600">{row.targetId}</Td>
                    <Td display={{ base: "none", md: "table-cell" }}>{row.appellantUsername || "—"}</Td>
                    <Td display={{ base: "none", lg: "table-cell" }} maxW="280px" noOfLines={2} fontSize="xs">
                      {row.snippet || "—"}
                    </Td>
                    <Td textAlign="right">
                      {canReview ? (
                        <HStack spacing={2} justify="flex-end" flexWrap="wrap">
                          <Button
                            size="sm"
                            colorScheme="pink"
                            variant="outline"
                            rounded="lg"
                            isLoading={appealActingId === row.id}
                            onClick={() => handleAppealResolve(row.id, "reversed")}
                          >
                            Odkrij vsebino
                          </Button>
                          <Button
                            size="sm"
                            colorScheme="gray"
                            rounded="lg"
                            isLoading={appealActingId === row.id}
                            onClick={() => handleAppealResolve(row.id, "upheld")}
                          >
                            Skrito ostane
                          </Button>
                        </HStack>
                      ) : (
                        <Text fontSize="xs" color="gray.500">
                          Ni pravice za odločitev
                        </Text>
                      )}
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </Box>
      </Box>
    );
  }

  function renderReportsPagination() {
    if (total <= limit) return null;
    return (
      <Stack
        direction={{ base: "column", sm: "row" }}
        justify="center"
        align="stretch"
        py={4}
        px={{ base: 1, md: 0 }}
        spacing={3}
      >
        <Button
          size="sm"
          isDisabled={offset <= 0 || loading}
          onClick={() => setOffset((o) => Math.max(0, o - limit))}
          rounded="xl"
          w={{ base: "full", sm: "auto" }}
          alignSelf={{ sm: "center" }}
        >
          Nazaj
        </Button>
        <Text fontSize="sm" color="gray.600" textAlign="center" alignSelf="center" px={2}>
          {offset + 1}–{Math.min(offset + items.length, total)} / {total}
        </Text>
        <Button
          size="sm"
          isDisabled={offset + items.length >= total || loading}
          onClick={() => setOffset((o) => o + limit)}
          rounded="xl"
          w={{ base: "full", sm: "auto" }}
          alignSelf={{ sm: "center" }}
        >
          Naprej
        </Button>
      </Stack>
    );
  }

  function renderReportsTable() {
    if (isRolesTab || isAppealsTab) return null;

    const mobileEmpty = (
      <Box py={14} textAlign="center" color="gray.500" fontSize="sm" bg="white" rounded="2xl" borderWidth="1px" borderColor="gray.100" boxShadow="sm">
        {loading ? "Nalaganje …" : "Ni prijav."}
      </Box>
    );

    const mobileCards = (
      <VStack spacing={3} align="stretch" display={{ base: "flex", md: "none" }}>
        {loading || items.length === 0 ? (
          mobileEmpty
        ) : (
          items.map((row) => (
            <Box
              key={row.id}
              bg="white"
              borderRadius="2xl"
              borderWidth="1px"
              borderColor="gray.100"
              boxShadow="sm"
              p={4}
            >
              <HStack justify="space-between" align="flex-start" spacing={3} mb={3}>
                <Badge colorScheme={statusBadgeColor(row.status)} fontSize="0.7rem">
                  {row.status}
                </Badge>
                <Text fontSize="xs" color="gray.500" textAlign="right" lineHeight="short">
                  {formatDt(row.createdAt)}
                </Text>
              </HStack>
              <SimpleGrid columns={2} spacingX={3} spacingY={2} fontSize="sm">
                <Text color="gray.500" fontSize="xs" fontWeight="700">
                  Tip
                </Text>
                <Text fontWeight="600">{targetTypeLabel(row.targetType)}</Text>
                <Text color="gray.500" fontSize="xs" fontWeight="700">
                  ID
                </Text>
                <Text fontWeight="700">{row.targetId}</Text>
                <Text color="gray.500" fontSize="xs" fontWeight="700">
                  Vidnost
                </Text>
                <Box minW={0}>
                  <TargetVisibilityBadge targetType={row.targetType} targetIsHidden={row.targetIsHidden} />
                </Box>
                <Text color="gray.500" fontSize="xs" fontWeight="700">
                  Avtor
                </Text>
                <Text fontWeight="600" noOfLines={2} minW={0}>
                  {row.targetAuthorUsername || "—"}
                </Text>
              </SimpleGrid>
              {row.targetAuthorEmail ? (
                <Box mt={2}>
                  <Text fontSize="xs" fontWeight="700" color="gray.500" textTransform="uppercase" mb={0.5}>
                    E-pošta avtorja
                  </Text>
                  <Text fontSize="xs" color="gray.700" wordBreak="break-all">
                    {row.targetAuthorEmail}
                  </Text>
                </Box>
              ) : null}
              <Box mt={3} pt={3} borderTopWidth="1px" borderColor="gray.100">
                <Text fontSize="xs" fontWeight="700" color="gray.500" textTransform="uppercase" mb={1}>
                  Razlog
                </Text>
                <Text fontSize="sm" color="gray.700" noOfLines={5} whiteSpace="pre-wrap">
                  {row.reason}
                </Text>
              </Box>
              <Button mt={4} w="full" size="md" colorScheme="pink" onClick={() => openDrawer(row)} rounded="xl">
                Odpri podrobnosti
              </Button>
            </Box>
          ))
        )}
        {renderReportsPagination()}
      </VStack>
    );

    return (
      <Box>
        {mobileCards}
        <Box
          display={{ base: "none", md: "block" }}
          bg="white"
          borderRadius="2xl"
          borderWidth="1px"
          borderColor="gray.100"
          overflow="hidden"
          boxShadow="sm"
        >
          <Table size="sm">
            <Thead bg="gray.50">
              <Tr>
                <Th>Datum</Th>
                <Th>Tip</Th>
                <Th>ID</Th>
                <Th>Vidnost</Th>
                <Th display={{ base: "none", lg: "table-cell" }}>Avtor</Th>
                <Th display={{ base: "none", xl: "table-cell" }}>E-pošta</Th>
                <Th display={{ base: "none", md: "table-cell" }}>Razlog</Th>
                <Th>Status</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {loading ? (
                <Tr>
                  <Td colSpan={9} py={10} textAlign="center" color="gray.500">
                    Nalaganje …
                  </Td>
                </Tr>
              ) : items.length === 0 ? (
                <Tr>
                  <Td colSpan={9} py={10} textAlign="center" color="gray.500">
                    Ni prijav.
                  </Td>
                </Tr>
              ) : (
                items.map((row) => (
                  <Tr key={row.id}>
                    <Td whiteSpace="nowrap">{formatDt(row.createdAt)}</Td>
                    <Td>{targetTypeLabel(row.targetType)}</Td>
                    <Td fontWeight="600">{row.targetId}</Td>
                    <Td>
                      <TargetVisibilityBadge targetType={row.targetType} targetIsHidden={row.targetIsHidden} />
                    </Td>
                    <Td display={{ base: "none", lg: "table-cell" }} maxW="140px" noOfLines={2} fontWeight="600">
                      {row.targetAuthorUsername || "—"}
                    </Td>
                    <Td display={{ base: "none", xl: "table-cell" }} maxW="200px" fontSize="xs" wordBreak="break-all">
                      {row.targetAuthorEmail || "—"}
                    </Td>
                    <Td display={{ base: "none", md: "table-cell" }} maxW="220px" noOfLines={2}>
                      {row.reason}
                    </Td>
                    <Td>
                      <Badge colorScheme={statusBadgeColor(row.status)}>{row.status}</Badge>
                    </Td>
                    <Td textAlign="right">
                      <Button size="sm" variant="outline" colorScheme="pink" onClick={() => openDrawer(row)} rounded="lg">
                        Odpri
                      </Button>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
          {renderReportsPagination()}
        </Box>
      </Box>
    );
  }
}
