import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton } from "@chakra-ui/react";
import CreatePostForm from "./CreatePostForm";
import { API_BASE } from "../../api/config";
import { getStoredUser } from "../../utils/helpers";
import { useAuthGate } from "../../context/AuthGateContext";

export const OPEN_NEW_POST_MODAL_EVENT = "open-new-post-modal";

export default function GlobalNewPostModal() {
  const { requestAuth } = useAuthGate();
  const [isOpen, setIsOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const handleOpen = useCallback(() => {
    if (!getStoredUser()) {
      requestAuth({ tab: "login", reason: "Za objavo nove teme se morate prijaviti." });
      return;
    }
    setFormKey((k) => k + 1);
    setIsOpen(true);
  }, [requestAuth]);

  useEffect(() => {
    window.addEventListener(OPEN_NEW_POST_MODAL_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_NEW_POST_MODAL_EVENT, handleOpen);
  }, [handleOpen]);

  const handleClose = useCallback(() => setIsOpen(false), []);

  const handleSuccess = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent
        borderRadius="lg"
        maxH="min(90dvh, 900px)"
        display="flex"
        flexDirection="column"
        mx={{ base: 3, md: "auto" }}
      >
        <ModalHeader flexShrink={0} fontSize="lg" fontWeight="600" pr={10}>
          Nova objava
        </ModalHeader>
        <ModalCloseButton onMouseUp={(e) => e.currentTarget.blur()} />
        <ModalBody
          pb={6}
          flex="1"
          minH={0}
          overflowY="auto"
          sx={{
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            "&::-webkit-scrollbar": {
              display: "none",
            },
          }}
        >
          <CreatePostForm
            key={formKey}
            apiBase={API_BASE}
            onSuccess={handleSuccess}
            onCancel={handleClose}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export function NewPostLegacyRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/", { replace: true });
    if (getStoredUser()) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(OPEN_NEW_POST_MODAL_EVENT));
      }, 0);
    }
  }, [navigate]);
  return null;
}
