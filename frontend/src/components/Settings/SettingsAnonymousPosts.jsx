import { useCallback, useEffect, useState } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { Box, Heading, Text, VStack, HStack, Button, Spinner, Divider } from "@chakra-ui/react";
import { API_BASE } from "../../api/config";
import { formatDate } from "../../utils/helpers";
import PostDetailModal from "../Forum/PostDetailModal";

const sectionTitleProps = {
  size: "md",
  mb: 4,
  color: "gray.800",
  fontWeight: "800",
  letterSpacing: "-0.02em",
};

export default function SettingsAnonymousPosts() {
  const { toast, confirm } = useAppToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [detailPostId, setDetailPostId] = useState(null);
  const [detailPostPreview, setDetailPostPreview] = useState(null);
  const closePostDetail = useCallback(() => {
    setDetailPostId(null);
    setDetailPostPreview(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/me/anonymous-posts?limit=100&offset=0`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Napaka pri nalaganju.");
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      toast({
        status: "error",
        title: "Napaka",
        description: e.message || "Seznama ni bilo mogoče naložiti.",
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (postId) => {
    const ok = await confirm({
      title: "Trajni izbris",
      description: "Ali želite trajno izbrisati to anonimno objavo?",
      confirmText: "Izbriši",
      cancelText: "Prekliči",
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(postId);
    try {
      const res = await fetch(`${API_BASE}/api/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Brisanje ni uspelo.");
      }
      setItems((prev) => prev.filter((p) => Number(p.id) !== Number(postId)));
      setDetailPostId((openId) =>
        openId != null && Number(openId) === Number(postId) ? null : openId
      );
      setDetailPostPreview((prev) =>
        prev && Number(prev.id) === Number(postId) ? null : prev
      );
      toast({ status: "success", title: "Objava je izbrisana" });
    } catch (e) {
      toast({
        status: "error",
        title: "Napaka",
        description: e.message,
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Box>
      <Heading {...sectionTitleProps}>Anonimne objave</Heading>
      <Text fontSize="sm" color="gray.600" mb={6}>
        Te objave niso vidne na vašem profilu.
      </Text>
      <Divider mb={6} />

      {loading ? (
        <HStack py={10} justify="center">
          <Spinner color="pink.500" />
        </HStack>
      ) : items.length === 0 ? (
        <Box py={8} textAlign="center">
          <Text color="gray.600">Nimate anonimnih objav.</Text>
        </Box>
      ) : (
        <VStack spacing={3} align="stretch">
          {items.map((p) => (
            <HStack
              key={p.id}
              align="flex-start"
              spacing={4}
              p={4}
              rounded="xl"
              borderWidth="1px"
              borderColor="gray.100"
              bg="gray.50"
            >
              <Box flex="1" minW={0}>
                <Button
                  type="button"
                  variant="link"
                  colorScheme="pink"
                  fontWeight="700"
                  whiteSpace="normal"
                  textAlign="left"
                  h="auto"
                  py={0}
                  px={0}
                  minH={0}
                  lineHeight="1.35"
                  onClick={() => {
                    setDetailPostId(p.id);
                    setDetailPostPreview(p);
                  }}
                >
                  {p.title}
                </Button>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  {p.categoryName ? `${p.categoryName} · ` : ""}
                  {p.createdAt ? formatDate(p.createdAt) : ""}
                </Text>
              </Box>
              <Button
                size="sm"
                variant="outline"
                colorScheme="red"
                flexShrink={0}
                isLoading={deletingId === p.id}
                onClick={() => handleDelete(p.id)}
              >
                Izbriši
              </Button>
            </HStack>
          ))}
        </VStack>
      )}
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
    </Box>
  );
}
