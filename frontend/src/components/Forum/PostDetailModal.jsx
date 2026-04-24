import { Modal, ModalOverlay, ModalContent, ModalBody, ModalCloseButton, useBreakpointValue } from "@chakra-ui/react";
import ForumPost from "./ForumPost";
import { hideScrollbarSx } from "../../utils/helpers";

function normalizePostId(postId) {
  if (postId == null) return "";
  const s = String(postId).trim();
  if (!s) return "";
  const n = Number(s);
  return Number.isFinite(n) ? s : "";
}

export default function PostDetailModal({ postId, isOpen, onClose, previewFromFeed = null }) {
  const size = useBreakpointValue({ base: "full", md: "4xl" });
  const parsed = normalizePostId(postId);
  const valid = parsed !== "";

  return (
    <Modal
      isOpen={Boolean(isOpen && valid)}
      onClose={onClose}
      size={size}
      scrollBehavior="inside"
      motionPreset="slideInBottom"
    >
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent
        maxH={{ base: "100dvh", md: "92vh" }}
        m={{ base: 0, md: 4 }}
        borderRadius={{ base: 0, md: "xl" }}
        overflow="hidden"
      >
        <ModalCloseButton
          zIndex={2}
          top={{ base: "calc(env(safe-area-inset-top, 0px) + 16px)", md: 3 }}
          right={{ base: 4, md: 3 }}
          onMouseUp={(e) => e.currentTarget.blur()}
        />
        <ModalBody
          p={{ base: 3, md: 6 }}
          pt={{ base: "calc(env(safe-area-inset-top, 0px) + 132px)", md: 10 }}
          overflowY="auto"
          sx={hideScrollbarSx}
        >
          <ForumPost
            key={parsed}
            postId={parsed}
            onBack={onClose}
            previewFromFeed={
              previewFromFeed && String(previewFromFeed.id) === parsed ? previewFromFeed : null
            }
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
