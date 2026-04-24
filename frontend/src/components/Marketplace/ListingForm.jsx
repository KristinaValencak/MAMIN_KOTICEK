import { useEffect, useMemo, useRef, useState } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { Alert, AlertIcon, Box, Button, FormControl, FormLabel, HStack, Image, Input, Select, Radio, RadioGroup, Spinner, Text, Textarea, VStack } from "@chakra-ui/react";
import { useAuthGate } from "../../context/AuthGateContext";
import { API_BASE } from "../../api/config";
import { INPUT_LIMITS } from "../../constants/inputLimits";
import { uploadPostImageToCloudinary, buildCloudinaryTransformedUrl, getCloudinaryConfig } from "../../utils/cloudinaryUpload";
import { getStoredUser } from "../../utils/helpers";
import { MARKETPLACE_CHANGED_EVENT } from "./marketplaceModalConstants";
import { getApiErrorMessageFromBody } from "../../utils/parseApiError.js";
import { useCities } from "../../hooks/forum/useCities";
import { useMarketplaceCategories } from "../../hooks/marketplace/useMarketplaceCategories";

function detectWarnings(text) {
  const s = String(text || "");
  const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const phoneRe = /\b(\+?\d[\d\s().-]{6,}\d)\b/;
  const warnings = [];
  if (emailRe.test(s)) warnings.push("Zaznali smo email v besedilu. Zaradi varnosti ga raje odstrani.");
  if (phoneRe.test(s)) warnings.push("Zaznali smo telefonsko številko v besedilu. Zaradi varnosti jo raje odstrani.");
  return warnings;
}

/**
 * Obrazec za nov ali urejen oglas (modal).
 * @param {number | null} editId
 * @param {(payload: { id: number; isEdit: boolean }) => void} onSuccess
 * @param {() => void} onCancel
 */
export default function ListingForm({ editId = null, onSuccess, onCancel }) {
  const { requestAuth } = useAuthGate();
  const { toast } = useAppToast();
  const user = useMemo(() => getStoredUser(), []);
  const abortRef = useRef(null);
  const listingId = editId != null && Number.isFinite(Number(editId)) && Number(editId) > 0 ? Number(editId) : null;
  const isEdit = Boolean(listingId);

  const { cities } = useCities();
  const { categories } = useMarketplaceCategories();

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [sellType, setSellType] = useState("sell");
  const [city, setCity] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [imageUploaded, setImageUploaded] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverWarnings, setServerWarnings] = useState([]);

  const localWarnings = useMemo(() => {
    const w = [...detectWarnings(title), ...detectWarnings(description)];
    return Array.from(new Set(w));
  }, [title, description]);

  const cfg = getCloudinaryConfig();
  const cloudName = cfg.ok ? cfg.cloudName : null;
  const previewUrl = useMemo(() => {
    if (!imageUploaded?.publicId || !cloudName) return imageUploaded?.secureUrl || null;
    return buildCloudinaryTransformedUrl({ cloudName, publicId: imageUploaded.publicId, profile: "postDetail" });
  }, [imageUploaded, cloudName]);

  useEffect(() => {
    if (!isEdit) {
      setTitle("");
      setDescription("");
      setPrice("");
      setSellType("sell");
      setCity("");
      setCategoryId("");
      setImageUploaded(null);
      setLoadError("");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadError("");
        const res = await fetch(`${API_BASE}/api/marketplace/${listingId}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(getApiErrorMessageFromBody(data) || "Napaka pri branju oglasa");
        }
        if (cancelled) return;
        if (!user) {
          setLoadError("Za urejanje oglasa se prijavi.");
          return;
        }
        if (Number(user.id) !== Number(data?.userId)) {
          setLoadError("Nimaš pravic za urejanje tega oglasa.");
          return;
        }
        setTitle(data?.title || "");
        setDescription(data?.description || "");
        setSellType(data?.isGift ? "gift" : "sell");
        setPrice(data?.price !== null && data?.price !== undefined ? String(data.price) : "");
        setCity(data?.city || "");
        setCategoryId(data?.categoryId != null ? String(data.categoryId) : "");
        if (data?.imageUrl && data?.imagePublicId) {
          setImageUploaded({ secureUrl: data.imageUrl, publicId: data.imagePublicId });
        } else {
          setImageUploaded(null);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, listingId, user]);

  const handlePickImage = async (file) => {
    if (!file) return;
    try {
      setUploading(true);
      abortRef.current?.abort?.();
      abortRef.current = new AbortController();
      const result = await uploadPostImageToCloudinary(file, { signal: abortRef.current.signal });
      setImageUploaded(result);
    } catch (err) {
      toast({ status: "error", title: "Napaka pri nalaganju slike", description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const canSubmit = title.trim() && description.trim() && !submitting && !loading && !loadError;

  const handleSubmit = async () => {
    if (!getStoredUser()) {
      requestAuth({ tab: "login", reason: "Za oddajo oglasa na marketplace se morate prijaviti." });
      return;
    }
    if (!title.trim() || !description.trim()) return;
    if (isEdit && !listingId) return;

    setSubmitting(true);
    setServerWarnings([]);
    try {
      const body = {
        title: title.trim(),
        description: description.trim(),
        isGift: sellType === "gift",
        price: sellType === "gift" ? null : (price.trim() ? Number(price) : null),
        city: city || null,
        categoryId: categoryId ? Number(categoryId) : null,
        imageUrl: imageUploaded?.secureUrl || null,
        imagePublicId: imageUploaded?.publicId || null,
      };
      const res = await fetch(
        isEdit ? `${API_BASE}/api/marketplace/${listingId}` : `${API_BASE}/api/marketplace`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          getApiErrorMessageFromBody(data) ||
            (isEdit ? "Napaka pri shranjevanju oglasa" : "Napaka pri oddaji oglasa")
        );
      }

      if (Array.isArray(data?.warnings) && data.warnings.length > 0) {
        setServerWarnings(data.warnings);
        if (!isEdit) {
          toast({ status: "info", title: "Opozorilo", description: "Oglas je objavljen, ampak zaznali smo kontaktne podatke." });
        }
      } else {
        toast({ status: "success", title: isEdit ? "Oglas posodobljen" : "Oglas objavljen" });
      }

      window.dispatchEvent(new CustomEvent(MARKETPLACE_CHANGED_EVENT));
      const outId = isEdit ? listingId : Number(data?.id);
      onSuccess?.({ id: outId, isEdit });
    } catch (err) {
      toast({ status: "error", title: "Napaka", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <HStack justify="center" py={10}>
        <Spinner color="brand.500" />
      </HStack>
    );
  }

  if (loadError) {
    return (
      <VStack align="stretch" spacing={4}>
        <Text color="red.600" fontSize="sm">
          {loadError}
        </Text>
        <Button variant="outline" onClick={onCancel}>
          Zapri
        </Button>
      </VStack>
    );
  }

  return (
    <Box bg="white" border="1px solid" borderColor="gray.100" rounded="xl" p={{ base: 4, md: 5 }}>
      <VStack align="stretch" spacing={4}>
        {!isEdit ? (
          <Text color="gray.600" fontSize="sm">
            Dogovori potekajo na lastno odgovornost. Ne deli telefona ali emaila v opisu.
          </Text>
        ) : null}

        {(localWarnings.length > 0 || serverWarnings.length > 0) && (
          <Alert status="warning" rounded="xl">
            <AlertIcon />
            <VStack align="start" spacing={1}>
              <Text fontWeight="700">Varnostno opozorilo</Text>
              {[...localWarnings, ...serverWarnings].slice(0, 3).map((w, idx) => (
                <Text key={idx} fontSize="sm">
                  {w}
                </Text>
              ))}
            </VStack>
          </Alert>
        )}

        <FormControl isRequired>
          <FormLabel>Naslov</FormLabel>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={INPUT_LIMITS.LISTING_TITLE}
            placeholder={isEdit ? undefined : "Npr. Otroški voziček"}
            bg="white"
          />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Opis</FormLabel>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={INPUT_LIMITS.LISTING_DESCRIPTION}
            placeholder={isEdit ? undefined : "Opiši izdelek, stanje, prevzem… (brez telefona/emaila)"}
            rows={6}
            bg="white"
          />
        </FormControl>

        <FormControl>
          <FormLabel>Tip oglasa</FormLabel>
          <RadioGroup
            value={sellType}
            onChange={(v) => {
              setSellType(v);
              if (v === "gift") setPrice("");
            }}
          >
            <HStack spacing={6} flexWrap="wrap">
              <Radio value="sell" colorScheme="pink">
                Prodam
              </Radio>
              <Radio value="gift" colorScheme="pink">
                Podarim
              </Radio>
            </HStack>
          </RadioGroup>
        </FormControl>

        {sellType === "sell" ? (
          <FormControl>
            <FormLabel>Cena (neobvezno)</FormLabel>
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              maxLength={INPUT_LIMITS.PRICE_INPUT}
              placeholder="Npr. 25"
              inputMode="decimal"
              bg="white"
            />
          </FormControl>
        ) : null}

        <FormControl>
          <FormLabel>Lokacija</FormLabel>
          <Select value={city} onChange={(e) => setCity(e.target.value)} bg="white">
            <option value="">Brez lokacije</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel>Kategorija</FormLabel>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} bg="white">
            <option value="">Brez kategorije</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel>Slika (neobvezno)</FormLabel>
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => handlePickImage(e.target.files?.[0] || null)}
            p={1}
            bg="white"
          />
          {previewUrl ? (
            <Box mt={3} rounded="xl" overflow="hidden" borderWidth="1px" borderColor="gray.100">
              <Image src={previewUrl} alt="Predogled" w="100%" maxH="240px" objectFit="cover" />
            </Box>
          ) : null}
        </FormControl>

        <HStack pt={2} justify="space-between" flexWrap="wrap">
          <Button variant="ghost" onClick={onCancel}>
            Prekliči
          </Button>
          <Button colorScheme="pink" onClick={handleSubmit} isLoading={submitting || uploading} isDisabled={!canSubmit}>
            {isEdit ? "Shrani" : "Objavi oglas"}
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
}
