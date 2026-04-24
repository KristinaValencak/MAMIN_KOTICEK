import { Box, HStack, Image, Text, VStack, Badge } from "@chakra-ui/react";
import { useMemo } from "react";
import { buildCloudinaryTransformedUrl, parseCloudinaryPublicIdFromUrl } from "../../utils/cloudinaryUpload";
import { PROFILE_COMPACT_CARD_BODY_MIN_H, PROFILE_COMPACT_CARD_BOX_SHADOW, PROFILE_COMPACT_CARD_IMAGE_H, PROFILE_COMPACT_CARD_MAX_W, PROFILE_COMPACT_CARD_NO_IMAGE_BG } from "../common/profileCompactCardLayout";

function formatPrice(price) {
  if (price === null || price === undefined || price === "") return null;
  const n = Number(price);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(n);
}

function formatListingDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("sl-SI", { day: "numeric", month: "short", year: "numeric" });
}

export default function ListingCard({ listing, cloudName, onOpen, variant = "default" }) {
  const isProfile = variant === "profile";
  const isMarketplaceCompact = variant === "marketplace";
  const isCompact = isProfile || isMarketplaceCompact;

  const imgSrc = useMemo(() => {
    if (!listing) return null;
    const profile = isCompact ? "listingThumb" : "listingCardWide";
    const pid =
      listing.imagePublicId || parseCloudinaryPublicIdFromUrl(listing.imageUrl || "") || null;
    if (cloudName && pid) {
      const u = buildCloudinaryTransformedUrl({ cloudName, publicId: pid, profile });
      if (u) return u;
    }
    return listing.imageUrl || null;
  }, [listing, cloudName, isCompact]);

  const priceLabel = formatPrice(listing?.price);
  const dateLabel = formatListingDate(listing?.createdAt);

  const compactImageH = isMarketplaceCompact ? "96px" : PROFILE_COMPACT_CARD_IMAGE_H;
  const compactMaxW = isMarketplaceCompact ? "340px" : PROFILE_COMPACT_CARD_MAX_W;
  const compactBodyMinH = isMarketplaceCompact ? "11.25rem" : PROFILE_COMPACT_CARD_BODY_MIN_H;

  const imageBlockH = isCompact ? compactImageH : { base: "150px", md: "170px" };
  const shell = isCompact
    ? {
        bg: "white",
        borderWidth: "1px",
        borderColor: "gray.100",
        rounded: "2xl",
        overflow: "hidden",
        boxShadow: PROFILE_COMPACT_CARD_BOX_SHADOW,
        w: "100%",
        maxW: compactMaxW,
        mx: "auto",
        h: "100%",
        minH: 0,
        display: "flex",
        flexDirection: "column",
      }
    : {
        bg: "white",
        borderWidth: "1px",
        borderColor: "gray.100",
        rounded: "2xl",
        overflow: "hidden",
        boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        w: "100%",
      };

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(listing?.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen?.(listing?.id);
      }}
      cursor="pointer"
      {...shell}
    >
      {imgSrc ? (
        <Image
          src={imgSrc}
          alt={listing?.title || "Oglas"}
          w="100%"
          h={imageBlockH}
          flexShrink={isCompact ? 0 : undefined}
          objectFit="cover"
          objectPosition="center"
          bg="gray.50"
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      ) : (
        <Box
          h={imageBlockH}
          flexShrink={isCompact ? 0 : undefined}
          bg={isCompact ? PROFILE_COMPACT_CARD_NO_IMAGE_BG : "gray.50"}
          borderBottomWidth={isCompact ? "1px" : undefined}
          borderBottomColor={isCompact ? "pink.100" : undefined}
          aria-hidden
        />
      )}

      {isCompact ? (
        <Box p={4} flex="1" display="flex" flexDirection="column" minH={compactBodyMinH}>
          <HStack justify="space-between" align="flex-start" mb={2} spacing={2} minH="32px">
            <Box flex="1" minW={0} />
            {dateLabel ? (
              <Text fontSize="10px" color="gray.500" flexShrink={0} whiteSpace="nowrap">
                {dateLabel}
              </Text>
            ) : null}
          </HStack>
          <Text
            fontWeight="800"
            color="gray.900"
            noOfLines={2}
            fontSize="md"
            letterSpacing="-0.02em"
            mb={1.5}
            lineHeight="short"
          >
            {listing?.title || "—"}
          </Text>
          {listing?.description ? (
            <Text
              fontSize="sm"
              color="gray.600"
              lineHeight="tall"
              noOfLines={2}
              mb={3}
              flex="1"
              minH={0}
            >
              {listing.description}
            </Text>
          ) : (
            <Box flex="1" minH={0} mb={3} />
          )}
          <HStack justify="space-between" align="center" spacing={2} flexWrap="wrap" mt="auto">
            {listing?.isGift ? (
              <Badge colorScheme="pink" variant="subtle">
                Podarim
              </Badge>
            ) : priceLabel ? (
              <Text fontWeight="700" color="brand.600">
                {priceLabel}
              </Text>
            ) : (
              <Badge colorScheme="gray" variant="subtle">
                Cena po dogovoru
              </Badge>
            )}
          </HStack>
        </Box>
      ) : (
        <VStack align="stretch" spacing={2} p={4}>
          <HStack justify="space-between" align="flex-start" spacing={2}>
            <Text fontWeight="800" color="gray.800" noOfLines={2} flex="1" minW={0}>
              {listing?.title || "—"}
            </Text>
            {dateLabel ? (
              <Text fontSize="10px" color="gray.500" flexShrink={0} whiteSpace="nowrap" pt={0.5}>
                {dateLabel}
              </Text>
            ) : null}
          </HStack>
          {listing?.description ? (
            <Text fontSize="sm" color="gray.600" lineHeight="1.6" noOfLines={3}>
              {listing.description}
            </Text>
          ) : null}
          <HStack justify="space-between" align="center">
            {listing?.isGift ? (
              <Badge colorScheme="pink" variant="subtle">
                Podarim
              </Badge>
            ) : priceLabel ? (
              <Text fontWeight="700" color="brand.600">
                {priceLabel}
              </Text>
            ) : (
              <Badge colorScheme="gray" variant="subtle">
                Cena po dogovoru
              </Badge>
            )}
          </HStack>
        </VStack>
      )}
    </Box>
  );
}
