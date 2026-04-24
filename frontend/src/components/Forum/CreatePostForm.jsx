import { useState, useCallback, useEffect } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { Box, Button, Checkbox, FormControl, FormHelperText, FormLabel, HStack, Image, Input, Select, Spinner, Text, Textarea, VStack, Wrap, WrapItem } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../api/config";
import { uploadPostImageToCloudinary, validatePostImageFile } from "../../utils/cloudinaryUpload";
import { INPUT_LIMITS } from "../../constants/inputLimits";
import { useAuthGate } from "../../context/AuthGateContext";
import { parseApiErrorResponse } from "../../utils/parseApiError.js";
import { useCities } from "../../hooks/forum/useCities";
import { useGroups } from "../../hooks/forum/useGroups";
import { useCategoryTags } from "../../hooks/forum/useCategoryTags";

const TAGS_MAX = 15;
const TAG_MAX_LEN = 40;

function normalizeCityInput(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (s.toLowerCase() === "brez lokacije") return null;
  return s;
}

const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "null"); }
  catch { return null; }
};

const CreatePostForm = ({
  apiBase = API_BASE,
  onSuccess,
  onCancel = () => { },
}) => {
  const navigate = useNavigate();
  const { toast } = useAppToast();
  const { requestAuth } = useAuthGate();
  const user = getStoredUser();
  const { cities } = useCities();
  const { groups } = useGroups();

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [groupKeyInput, setGroupKeyInput] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState("");
  const [imageUploaded, setImageUploaded] = useState(null); // { secureUrl, publicId }

  const [categories, setCategories] = useState([]);
  const selectedCategory = categories.find((c) => String(c.id) === String(categoryId)) || null;
  const { tags: allowedTags } = useCategoryTags(selectedCategory?.slug);

  useEffect(() => {
    // If category changes, clear selected tags (since allowed set changes).
    setSelectedTags([]);
  }, [selectedCategory?.slug]);

  const toggleTag = useCallback((t) => {
    const tag = String(t || "").trim();
    if (!tag) return;
    setSelectedTags((prev) => {
      const has = prev.includes(tag);
      if (has) return prev.filter((x) => x !== tag);
      if (prev.length >= TAGS_MAX) return prev;
      return [...prev, tag];
    });
  }, []);

  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState("");

  useEffect(() => {
    if (!imageFile) {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl("");
      return;
    }
    const u = URL.createObjectURL(imageFile);
    setImagePreviewUrl(u);
    return () => URL.revokeObjectURL(u);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFile]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setCatLoading(true);
        const res = await fetch(`${apiBase}/api/categories`);
        if (!res.ok) throw new Error("Napaka pri branju kategorij");
        const data = await res.json();
        if (alive) {
          setCategories(Array.isArray(data) ? data : []);
          setCatLoading(false);
        }
      } catch (e) {
        if (alive) {
          setCatError(e.message || "Napaka pri branju kategorij");
          setCatLoading(false);
        }
      }
    })();
    return () => { alive = false; };
  }, [apiBase]);

  const removeImage = useCallback(() => {
    setImageFile(null);
    setImageUploadError("");
    setImageUploading(false);
    setImageUploaded(null);
  }, []);

  const startUpload = useCallback(async (file) => {
    setImageUploadError("");
    setImageUploaded(null);
    setImageUploading(true);
    try {
      const uploaded = await uploadPostImageToCloudinary(file);
      setImageUploaded(uploaded);
    } catch (err) {
      setImageUploadError(err?.message || "Napaka pri nalaganju slike.");
      setImageFile(null);
    } finally {
      setImageUploading(false);
    }
  }, []);

  const onPickImage = useCallback(async (e) => {
    const file = e.target.files?.[0] || null;
    e.target.value = "";
    if (!file) return;

    const v = validatePostImageFile(file);
    if (!v.ok) {
      toast({ status: "error", title: v.error });
      return;
    }

    setImageFile(file);
    startUpload(file);
  }, [startUpload, toast]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!user?.id) {
      requestAuth({ tab: "login", reason: "Za objavo nove teme se morate prijaviti." });
      return;
    }
    if (!title.trim() || !content.trim()) {
      toast({ status: "error", title: "Naslov in vsebina sta obvezna." });
      return;
    }
    if (!categoryId) {
      toast({ status: "error", title: "Izberi kategorijo." });
      return;
    }
    if (imageUploading) {
      toast({ status: "info", title: "Slika se še nalaga… počakaj trenutek." });
      return;
    }
    if (imageUploadError) {
      toast({ status: "error", title: imageUploadError });
      return;
    }

    try {
      const tags = Array.isArray(selectedTags) ? selectedTags : [];
      if (tags.length > TAGS_MAX) {
        toast({ status: "error", title: `Preveč tagov (max ${TAGS_MAX}).` });
        return;
      }
      if (tags.some((t) => t.length > TAG_MAX_LEN)) {
        toast({ status: "error", title: `Tag je predolg (max ${TAG_MAX_LEN} znakov).` });
        return;
      }
      const city = normalizeCityInput(cityInput);
      const groupKey = String(groupKeyInput || "").trim().toLowerCase() || null;

      const res = await fetch(`${apiBase}/api/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          categoryId,
          isAnonymous: isAnonymous,
          imageUrl: imageUploaded?.secureUrl || null,
          imagePublicId: imageUploaded?.publicId || null,
          city,
          tags,
          groupKey,
        }),
      });

      if (!res.ok) {
        const pe = await parseApiErrorResponse(res);
        throw new Error(pe.message || "Napaka pri shranjevanju.");
      }

      toast({ status: "success", title: "Objava uspešno ustvarjena!" });
      window.dispatchEvent(new Event("forum-post-created"));
      removeImage();
      if (onSuccess) {
        onSuccess();
      } else {
        navigate("/");
      }
    } catch (err) {
      toast({ status: "error", title: err.message || "Napaka pri shranjevanju." });
    }
  }, [user, title, content, categoryId, cityInput, groupKeyInput, selectedTags, toast, navigate, requestAuth, apiBase, onSuccess, imageUploading, imageUploadError, imageUploaded, removeImage]);

  const formContent = (
    <Box as="form" onSubmit={handleSubmit}>
      <VStack spacing={4} align="stretch">
        <FormControl isRequired>
          <FormLabel
            fontSize="sm"
            fontWeight="700"
            color="gray.700"
            textTransform="uppercase"
            letterSpacing="0.05em"
            mb={2}
            sx={{
              background: "linear-gradient(90deg, #EC5F8C 0%, #F48FB1 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent"
            }}
          >
            Naslov
          </FormLabel>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={INPUT_LIMITS.POST_TITLE}
            placeholder="Kratek naslov tvoje objave"
            size="md"
            borderRadius="md"
            borderColor="gray.200"
            bg="white"
            transition="all 0.2s ease"
            _hover={{
              borderColor: "brand.200",
              boxShadow: "sm",
            }}
            _focus={{
              borderColor: "brand.400",
              boxShadow: "0 0 0 1px rgba(236,95,140,0.6)",
              bg: "white"
            }}
          />
        </FormControl>

        <FormControl>
          <FormLabel
            fontSize="sm"
            fontWeight="600"
            color="gray.700"
            textTransform="uppercase"
            letterSpacing="0.02em"
            mb={3}
          >
            Mesto (neobvezno)
          </FormLabel>
          <Select
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            size="md"
            borderRadius="md"
            borderColor="gray.200"
            bg="white"
          >
            <option value="">Brez lokacije</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel
            fontSize="sm"
            fontWeight="600"
            color="gray.700"
            textTransform="uppercase"
            letterSpacing="0.02em"
            mb={3}
          >
            Skupina (neobvezno)
          </FormLabel>
          <Select
            value={groupKeyInput}
            onChange={(e) => setGroupKeyInput(e.target.value)}
            size="md"
            borderRadius="md"
            borderColor="gray.200"
            bg="white"
          >
            <option value="">Brez skupine</option>
            {groups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel
            fontSize="sm"
            fontWeight="600"
            color="gray.700"
            textTransform="uppercase"
            letterSpacing="0.02em"
            mb={3}
          >
            Tagi (neobvezno)
          </FormLabel>
          {!selectedCategory?.slug ? (
            <FormHelperText fontSize="xs" color="gray.500">
              Najprej izberi kategorijo, nato lahko izbereš tage.
            </FormHelperText>
          ) : (
            <>
              <FormHelperText fontSize="xs" color="gray.500" mb={2}>
                Izberi iz seznama. Max {TAGS_MAX} tagov. ({selectedTags.length}/{TAGS_MAX})
              </FormHelperText>
              <Wrap spacing={2}>
                {allowedTags.map((t) => {
                  const active = selectedTags.includes(t);
                  const disableAdd = !active && selectedTags.length >= TAGS_MAX;
                  return (
                    <WrapItem key={t}>
                      <Button
                        size="sm"
                        borderRadius="999px"
                        variant={active ? "solid" : "outline"}
                        colorScheme={active ? "pink" : "gray"}
                        borderColor="gray.200"
                        onClick={() => toggleTag(t)}
                        isDisabled={disableAdd}
                        _hover={active ? { filter: "brightness(0.98)" } : { borderColor: "pink.300", color: "pink.600" }}
                      >
                        {t}
                      </Button>
                    </WrapItem>
                  );
                })}
              </Wrap>
            </>
          )}
        </FormControl>

        <FormControl isRequired>
          <FormLabel
            fontSize="sm"
            fontWeight="600"
            color="gray.700"
            textTransform="uppercase"
            letterSpacing="0.02em"
            mb={3}
          >
            Kategorija
          </FormLabel>
          {catLoading ? (
            <HStack p={4} border="1px solid" borderColor="gray.200" borderRadius="2px">
              <Spinner size="sm" color="brand.500" />
              <Text fontSize="sm" color="gray.600">Nalaganje kategorij…</Text>
            </HStack>
          ) : catError ? (
            <Text fontSize="sm" color="red.500" p={4} border="1px solid" borderColor="red.200" borderRadius="2px" bg="red.50">
              {catError}
            </Text>
          ) : (
            <Select
              placeholder="Izberi kategorijo"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              size="md"
              borderRadius="md"
              borderColor="gray.200"
              bg="white"
              transition="all 0.2s ease"
              _hover={{
                borderColor: "brand.200",
              }}
              _focus={{
                borderColor: "brand.400",
                boxShadow: "0 0 0 1px rgba(236,95,140,0.6)",
                bg: "white"
              }}
              isDisabled={catLoading || !!catError || categories.length === 0}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </FormControl>

        <FormControl isRequired>
          <FormLabel
            fontSize="sm"
            fontWeight="600"
            color="gray.700"
            textTransform="uppercase"
            letterSpacing="0.02em"
            mb={3}
          >
            Vsebina
          </FormLabel>
          <Textarea
            minH="180px"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={INPUT_LIMITS.POST_BODY}
            placeholder="Zapiši vsebino svoje objave..."
            borderRadius="md"
            borderColor="gray.200"
            bg="white"
            transition="all 0.2s ease"
            _hover={{
              borderColor: "brand.200",
            }}
            _focus={{
              borderColor: "brand.400",
              boxShadow: "0 0 0 1px rgba(236,95,140,0.6)",
              bg: "white"
            }}
            resize="vertical"
          />
        </FormControl>

        <FormControl>
          <FormLabel
            fontSize="sm"
            fontWeight="600"
            color="gray.700"
            textTransform="uppercase"
            letterSpacing="0.02em"
            mb={3}
          >
            Slika (neobvezno)
          </FormLabel>

          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPickImage}
            paddingTop={1}
            borderColor="gray.200"
            bg="white"
          />

          {imageUploading && (
            <HStack mt={2} spacing={2}>
              <Spinner size="sm" />
              <Text fontSize="sm" color="gray.600">Nalaganje slike…</Text>
            </HStack>
          )}

          {imagePreviewUrl && (
            <Box mt={3}>
              <Image
                src={imagePreviewUrl}
                alt="Predogled slike"
                borderRadius="12px"
                width="100%"
                maxH="360px"
                objectFit="contain"
                bg="gray.50"
              />
              <Button
                mt={2}
                size="sm"
                variant="ghost"
                onClick={removeImage}
                color="gray.600"
                _hover={{ color: "#EC5F8C", bg: "rgba(236, 95, 140, 0.05)" }}
              >
                Odstrani sliko
              </Button>
            </Box>
          )}

          {imageUploadError && (
            <Text mt={2} fontSize="sm" color="red.500">
              {imageUploadError}
            </Text>
          )}
        </FormControl>
        <FormControl>
          <Checkbox
            isChecked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            colorScheme="brand"
            fontSize="xs"
          >
            Objavi kot anonimen član
          </Checkbox>
        </FormControl>

        <HStack justify="flex-end" spacing={3} pt={4} borderTop="1px solid" borderColor="gray.100">
          <Button
            variant="ghost"
            onClick={onCancel}
            borderRadius="12px"
            color="gray.600"
            transition="all 0.2s"
            _hover={{ color: "#EC5F8C", bg: "rgba(236, 95, 140, 0.05)" }}
          >
            Prekliči
          </Button>
          <Button
            type="submit"
            bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
            color="white"
            borderRadius="12px"
            fontWeight="600"
            px={6}
            boxShadow="0 4px 12px rgba(236, 95, 140, 0.3)"
            transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
            _hover={{
              bgGradient: "linear(135deg, #D94B8C 0%, #EC5F8C 100%)",
              transform: "translateY(-2px)",
              boxShadow: "0 6px 16px rgba(236, 95, 140, 0.4)"
            }}
            _active={{
              transform: "translateY(0)",
              boxShadow: "0 2px 8px rgba(236, 95, 140, 0.3)"
            }}
            isDisabled={catLoading || !!catError || imageUploading}
          >
            Objavi
          </Button>
        </HStack>
      </VStack>
    </Box>
  );

  return formContent;
};

export default CreatePostForm;
