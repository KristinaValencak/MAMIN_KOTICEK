import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { Alert, AlertDescription, AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay, AlertIcon, AlertTitle, Avatar, Badge, Box, Button, Divider, Flex, Heading, HStack, IconButton, Image, Menu, MenuButton, MenuItem, MenuList, SimpleGrid, Spinner, Stack, Text, VStack, useDisclosure } from "@chakra-ui/react";
import { useAuthGate } from "../../context/AuthGateContext";
import { API_BASE } from "../../api/config";
import { buildListingHeroImageProps, buildAvatarDisplayUrl, getCloudinaryConfig } from "../../utils/cloudinaryUpload";
import ReportListingModal from "./ReportListingModal";
import { formatDate, getStoredUser } from "../../utils/helpers";
import ExpandableText from "../common/ExpandableText";
import { FiEdit2, FiEyeOff, FiFlag, FiMoreVertical, FiSend, FiTrash2 } from "react-icons/fi";
import { OPEN_LISTING_FORM_MODAL, MARKETPLACE_CHANGED_EVENT } from "./marketplaceModalConstants";
import { getApiErrorMessageFromBody } from "../../utils/parseApiError.js";
import { hasPermission } from "../../utils/authz";
import { deleteModerationContent, hideModerationContent, submitModerationAppeal } from "../../api/moderation";

function formatPrice(price) {
  if (price == null) return null;
  const n = Number(price);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function ListingDetailView({ listingId, onClose, notifId = null, bannerKey = null }) {
  const { requestAuth } = useAuthGate();
  const { toast } = useAppToast();
  const { isOpen: isReportOpen, onOpen: onReportOpen, onClose: onReportClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelDeleteRef = useRef();

  const [viewer, setViewer] = useState(() => getStoredUser());
  useEffect(() => {
    const sync = () => setViewer(getStoredUser());
    const onStorage = (e) => {
      if (e.key === "user") sync();
    };
    window.addEventListener("auth-changed", sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("auth-changed", sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [notifBanner, setNotifBanner] = useState(null);
  const [appealBusy, setAppealBusy] = useState(false);

  const markNotifReadBestEffort = useCallback(async (id) => {
    const s = String(id || "").trim();
    if (!s) return;
    try {
      await fetch(`${API_BASE}/api/notifications/${encodeURIComponent(s)}/read`, {
        method: "PUT",
        credentials: "include",
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const bk = bannerKey != null ? String(bannerKey).trim() : "";
    if (!bk) {
      setNotifBanner(null);
      return;
    }
    const title =
      bk === "unhidden"
        ? "Vaš oglas je ponovno viden"
        : bk === "hidden"
          ? "Vaš oglas je začasno skrit"
          : bk === "appeal_upheld"
            ? "Zahtevek za pregled je bil zavrnjen"
          : "Moderacija";
    const desc =
      bk === "unhidden"
        ? "Vsebino smo pregledali in je ponovno vidna skupnosti."
        : bk === "hidden"
          ? "Če menite, da gre za napako, lahko zahtevate pregled."
          : bk === "appeal_upheld"
            ? "Vsebina ostaja skrita. Če menite, da gre za napako, lahko znova zahtevate pregled, ko bo to dovoljeno."
          : "";
    setNotifBanner({ key: bk, title, desc });
    if (notifId) markNotifReadBestEffort(notifId);
  }, [bannerKey, notifId, markNotifReadBestEffort]);

  const cfg = getCloudinaryConfig();
  const cloudName = cfg.ok ? cfg.cloudName : null;

  const heroImage = useMemo(() => {
    if (!listing) return { src: null, srcSet: undefined, sizes: undefined };
    return buildListingHeroImageProps(cloudName, listing.imagePublicId, listing.imageUrl);
  }, [listing, cloudName]);

  const sellerAvatarSrc = useMemo(() => {
    if (!listing) return undefined;
    return buildAvatarDisplayUrl(
      cloudName,
      listing.sellerAvatarUrl ?? listing.sellerAvatarURL ?? listing.sellerAvatar ?? listing.avatarUrl ?? null
    );
  }, [cloudName, listing]);

  const priceLabel = formatPrice(listing?.price);

  useEffect(() => {
    if (listingId == null || !Number.isFinite(Number(listingId)) || Number(listingId) <= 0) {
      setLoading(false);
      setError("Neveljaven oglas");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${API_BASE}/api/marketplace/${listingId}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 404) throw new Error("Oglas ne obstaja ali ni več na voljo.");
          throw new Error(getApiErrorMessageFromBody(data) || "Napaka");
        }
        if (!cancelled) setListing(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  const handleContact = () => {
    if (!listing?.userId) return;
    const me = getStoredUser();
    if (!me) {
      requestAuth({ tab: "login", reason: "Za kontakt s prodajalko prek sporočil se morate prijaviti." });
      return;
    }
    if (Number(me.id) === Number(listing.userId)) {
      return;
    }
    const draft = `Živjo 😊 zanima me oglas: ${listing.title}`;
    // Close the marketplace detail (often rendered inside a focus-trapping modal)
    // before opening messenger, otherwise the modal can steal focus on mobile.
    onClose?.();
    window.dispatchEvent(
      new CustomEvent("messenger-open", {
        detail: { userId: listing.userId, draft },
      })
    );
  };

  const openEdit = () => {
    if (!listing?.id) return;
    window.dispatchEvent(
      new CustomEvent(OPEN_LISTING_FORM_MODAL, {
        detail: { editId: listing.id, fromDetailListingId: listing.id },
      })
    );
  };

  async function handleDeleteListing() {
    if (!listing?.id) return;
    const owner =
      viewer?.id != null &&
      listing.userId != null &&
      Number(viewer.id) === Number(listing.userId);
    if (!owner) return;
    try {
      setDeleting(true);
      const res = await fetch(`${API_BASE}/api/marketplace/${listing.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiErrorMessageFromBody(data) || "Brisanje ni uspelo");
      toast({ status: "success", title: "Oglas je odstranjen", isClosable: true });
      window.dispatchEvent(new CustomEvent(MARKETPLACE_CHANGED_EVENT));
      onDeleteClose();
      onClose?.();
    } catch (e) {
      toast({
        status: "error",
        title: "Odstranitev ni uspela",
        description: e.message || "Poskusite znova.",
        isClosable: true,
      });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <Stack spacing={{ base: 4, md: 5 }}>
        <Box
          bg="white"
          borderWidth="1px"
          borderColor="gray.100"
          borderRadius="2xl"
          overflow="hidden"
        >
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={0}>
            <Box
              maxH={{ base: "260px", md: "520px" }}
              minH={{ base: "200px", md: "320px" }}
              bg="gray.100"
              display="flex"
              alignItems="center"
              justifyContent="center"
              aria-busy
            >
              <Spinner color="brand.500" size="lg" />
            </Box>
            <VStack align="stretch" spacing={4} p={{ base: 4, md: 6 }}>
              <HStack spacing={3}>
                <Box w="40px" h="40px" borderRadius="full" bg="gray.200" flexShrink={0} />
                <VStack align="start" spacing={2} flex="1">
                  <Box h="14px" w="40%" borderRadius="md" bg="gray.200" />
                  <Box h="10px" w="28%" borderRadius="md" bg="gray.100" />
                </VStack>
              </HStack>
              <Box h="22px" w="70%" borderRadius="md" bg="gray.200" />
              <Box h="12px" w="100%" borderRadius="md" bg="gray.100" />
              <Box h="12px" w="95%" borderRadius="md" bg="gray.100" />
              <Box h="12px" w="80%" borderRadius="md" bg="gray.100" />
            </VStack>
          </SimpleGrid>
        </Box>
      </Stack>
    );
  }

  if (error || !listing) {
    return (
      <Stack spacing={4}>
        <HStack>
          <AlertIcon color="red.500" />
          <Text color="red.600">{error || "Oglas ni na voljo."}</Text>
        </HStack>
        {onClose ? (
          <Button variant="outline" rounded="xl" onClick={onClose}>
            Zapri
          </Button>
        ) : null}
      </Stack>
    );
  }

  const isOwner =
    viewer?.id != null &&
    listing.userId != null &&
    Number(viewer.id) === Number(listing.userId);
  const isAdmin = viewer?.isAdmin === true;
  const canHide = hasPermission(viewer, "moderation.content.hide");

  const handleHideListing = async () => {
    if (!listing?.id) return;
    try {
      await hideModerationContent("marketplace_listing", listing.id);
      toast({ status: "success", title: "Oglas skrit", isClosable: true });
      window.dispatchEvent(new CustomEvent(MARKETPLACE_CHANGED_EVENT));
      setListing((p) => (p ? { ...p, isHidden: true } : p));
      onClose?.();
    } catch (e) {
      toast({
        status: "error",
        title: "Skrivanje ni uspelo",
        description: e?.message || "Poskusite znova.",
        isClosable: true,
      });
    }
  };

  const handleAdminRemove = async () => {
    if (!listing?.id || !isAdmin) return;
    try {
      await deleteModerationContent("marketplace_listing", listing.id);
      toast({ status: "success", title: "Oglas odstranjen (Admin)", isClosable: true });
      window.dispatchEvent(new CustomEvent(MARKETPLACE_CHANGED_EVENT));
      onClose?.();
    } catch (e) {
      toast({
        status: "error",
        title: "Odstranitev ni uspela",
        description: e?.message || "Poskusite znova.",
        isClosable: true,
      });
    }
  };

  const handleAppeal = async () => {
    if (!listing?.id) return;
    if (appealBusy) return;
    setAppealBusy(true);
    try {
      await submitModerationAppeal({ targetType: "marketplace_listing", targetId: Number(listing.id) });
      toast({ status: "success", title: "Zahtevek za pregled je oddan", isClosable: true });
      setListing((p) => (p ? { ...p, appealPending: true } : p));
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
  };

  return (
    <>
      <Stack spacing={{ base: 4, md: 5 }}>
        {(() => {
          const showOwnerHidden = Boolean(listing?.isHidden && isOwner);
          const showNotif = Boolean(notifBanner);
          if (!showOwnerHidden && !showNotif) return null;

          const key = showNotif ? notifBanner.key : "hidden";
          const title =
            showNotif
              ? notifBanner.title
              : "Vaš oglas je začasno skrit";
          const desc =
            showNotif
              ? notifBanner.desc
              : "Če menite, da gre za napako, lahko zahtevate pregled.";

          const isWarning = key === "hidden" || key === "appeal_upheld";
          return (
            <Alert
              status={isWarning ? "warning" : "success"}
              rounded="xl"
              borderWidth="1px"
              borderColor={isWarning ? "orange.200" : "green.200"}
            >
              <AlertIcon />
              <VStack align="start" spacing={2} w="full">
                <AlertTitle fontWeight="800">{title}</AlertTitle>
                {desc ? <AlertDescription>{desc}</AlertDescription> : null}
                {showOwnerHidden ? (
                  <Button
                    size="sm"
                    colorScheme="orange"
                    rounded="lg"
                    alignSelf="flex-start"
                    onClick={handleAppeal}
                    isLoading={appealBusy}
                    isDisabled={Boolean(listing?.appealPending)}
                  >
                    Zahtevaj pregled
                  </Button>
                ) : null}
              </VStack>
            </Alert>
          );
        })()}
        <Box
          bg="white"
          borderWidth="1px"
          borderColor="gray.100"
          borderRadius="2xl"
          boxShadow="0 12px 34px rgba(0,0,0,0.08)"
          overflow="hidden"
        >
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={0}>
            <Box maxH={{ base: "260px", md: "520px" }} minH={{ base: "200px", md: "320px" }} bg="gray.50">
              {heroImage.src ? (
                <Image
                  src={heroImage.src}
                  srcSet={heroImage.srcSet}
                  sizes={heroImage.sizes}
                  alt={listing.title}
                  w="100%"
                  h="100%"
                  minH={{ base: "200px", md: "320px" }}
                  maxH={{ base: "260px", md: "520px" }}
                  objectFit="cover"
                  objectPosition="center"
                  loading="eager"
                  fetchpriority="high"
                  decoding="async"
                  draggable={false}
                />
              ) : null}
            </Box>

            <VStack align="stretch" spacing={4} p={{ base: 4, md: 6 }}>
              <Flex align="center" justify="space-between" gap={3}>
                <HStack spacing={3} minW={0}>
                  <Avatar
                    size="sm"
                    name={listing.sellerUsername}
                    src={sellerAvatarSrc}
                    bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
                    color="white"
                  />
                  <VStack align="start" spacing={0} minW={0}>
                    <Text fontSize="sm" color="gray.800" fontWeight="700" noOfLines={1}>
                      {listing.sellerUsername}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      Objavljeno {formatDate(listing.createdAt)}
                    </Text>
                  </VStack>
                </HStack>

                {viewer?.id ? (
                  <Menu>
                    <MenuButton
                      as={IconButton}
                      aria-label="Možnosti"
                      icon={<FiMoreVertical />}
                      variant="ghost"
                      size="sm"
                      borderRadius="lg"
                    />
                    <MenuList borderRadius="xl">
                      {!isOwner ? (
                        <MenuItem icon={<FiFlag />} borderRadius="lg" onClick={onReportOpen}>
                          Prijavi neprimeren oglas
                        </MenuItem>
                      ) : null}
                      {canHide && !listing.isHidden ? (
                        <MenuItem icon={<FiEyeOff />} borderRadius="lg" color="orange.700" onClick={handleHideListing}>
                          Skrij oglas
                        </MenuItem>
                      ) : null}
                      {isAdmin ? (
                        <MenuItem icon={<FiTrash2 />} borderRadius="lg" color="red.600" onClick={handleAdminRemove}>
                          Odstrani oglas (Admin)
                        </MenuItem>
                      ) : null}
                      {isOwner ? (
                        <MenuItem icon={<FiEdit2 />} borderRadius="lg" onClick={openEdit}>
                          Uredi
                        </MenuItem>
                      ) : null}
                      {isOwner ? (
                        <MenuItem icon={<FiTrash2 />} borderRadius="lg" color="red.600" onClick={onDeleteOpen}>
                          Odstrani oglas
                        </MenuItem>
                      ) : null}
                    </MenuList>
                  </Menu>
                ) : null}
              </Flex>

              <VStack align="stretch" spacing={2}>
                {listing.isGift ? (
                  <Badge
                    alignSelf="flex-start"
                    colorScheme="pink"
                    variant="subtle"
                    borderRadius="full"
                    px={2.5}
                    py={0.5}
                    fontSize="xs"
                  >
                    Podarim
                  </Badge>
                ) : priceLabel ? (
                  <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="800" letterSpacing="-0.02em" color="gray.900">
                    {priceLabel}
                  </Text>
                ) : (
                  <Badge
                    alignSelf="flex-start"
                    colorScheme="gray"
                    variant="subtle"
                    borderRadius="full"
                    px={2.5}
                    py={0.5}
                    fontSize="xs"
                  >
                    Cena po dogovoru
                  </Badge>
                )}
                <Heading fontSize={{ base: "lg", md: "xl" }} fontWeight="700" lineHeight="1.25" color="gray.900">
                  {listing.title}
                </Heading>
                {(listing?.categoryName || listing?.city) ? (
                  <HStack spacing={2} flexWrap="wrap">
                    {listing?.categoryName ? (
                      <Badge colorScheme="purple" variant="subtle" borderRadius="full" px={2.5} py={0.5} fontSize="xs">
                        {listing.categoryName}
                      </Badge>
                    ) : null}
                    {listing?.city ? (
                      <Badge colorScheme="blue" variant="subtle" borderRadius="full" px={2.5} py={0.5} fontSize="xs">
                        {listing.city}
                      </Badge>
                    ) : null}
                  </HStack>
                ) : null}
              </VStack>

              <ExpandableText
                text={listing.description}
                maxLines={8}
                fontSize="sm"
                lineHeight="1.8"
                color="gray.700"
              />

              <Divider />

              {!isOwner ? (
                <Button
                  size="md"
                  colorScheme="pink"
                  leftIcon={<FiSend />}
                  onClick={handleContact}
                  borderRadius="xl"
                  w={{ base: "100%", md: "fit-content" }}
                  alignSelf={{ base: "stretch", md: "flex-start" }}
                >
                  Kontaktiraj
                </Button>
              ) : null}
            </VStack>
          </SimpleGrid>
        </Box>
      </Stack>

      <ReportListingModal isOpen={isReportOpen} onClose={onReportClose} listingId={listing.id} listingTitle={listing.title} />

      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelDeleteRef} onClose={onDeleteClose} isCentered>
        <AlertDialogOverlay />
        <AlertDialogContent borderRadius="xl">
          <AlertDialogHeader fontSize="lg" fontWeight="600">
            Odstranim oglas?
          </AlertDialogHeader>
          <AlertDialogBody>Oglas bo odstranjen s seznama.</AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelDeleteRef} onClick={onDeleteClose} variant="ghost" borderRadius="md">
              Prekliči
            </Button>
            <Button colorScheme="red" onClick={handleDeleteListing} ml={3} borderRadius="md" isLoading={deleting}>
              Odstrani
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
