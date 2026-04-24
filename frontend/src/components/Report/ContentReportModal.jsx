import { useRef, useState } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Button, VStack } from "@chakra-ui/react";
import ReportReasonFields from "./ReportReasonFields";
import { getApiErrorMessageFromBody } from "../../utils/parseApiError.js";

export const REPORT_FORM_INVALID_TOAST = {
  status: "warning",
  title: "Manjkajoči podatki",
  description:
    "Izberite vsaj en razlog. Če označite »Drugo«, vpišite kratek opis (do 500 znakov).",
};

export default function ContentReportModal({
  isOpen,
  onClose,
  variant = "default",
  title,
  successTitle = "Prijava poslana",
  successDescription,
  submitUrl,
  extraBody = null,
  bodyBeforeForm = null,
}) {
  const reasonRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useAppToast();
  const isProfile = variant === "profile";

  const handleClose = () => {
    onClose?.();
  };

  const handleSubmit = async () => {
    if (!submitUrl) return;
    if (!reasonRef.current?.isValid()) {
      toast({ ...REPORT_FORM_INVALID_TOAST, isClosable: true });
      return;
    }
    const reason = reasonRef.current.getReason().trim();
    setSubmitting(true);
    try {
      const body =
        extraBody && typeof extraBody === "object" && !Array.isArray(extraBody)
          ? { reason, ...extraBody }
          : { reason };
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast({
          status: "info",
          title: "Prijava že obstaja",
          description: getApiErrorMessageFromBody(data) || "To vsebino ste že prijavili.",
          duration: 5000,
          isClosable: true,
        });
        return;
      }
      if (!res.ok) {
        throw new Error(getApiErrorMessageFromBody(data) || "Napaka pri pošiljanju prijave.");
      }
      toast({
        status: "success",
        title: successTitle,
        description: successDescription,
        duration: 3000,
        isClosable: true,
      });
      handleClose();
    } catch (err) {
      console.error(err);
      toast({
        status: "error",
        title: "Napaka",
        description: err.message || "Prijave ni bilo mogoče poslati.",
        isClosable: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered={isProfile}>
      {isProfile ? (
        <ModalOverlay bg="blackAlpha.400" backdropFilter="blur(4px)" />
      ) : (
        <ModalOverlay />
      )}
      <ModalContent borderRadius={isProfile ? "2xl" : undefined} mx={isProfile ? 3 : undefined}>
        <ModalHeader
          fontWeight={isProfile ? "800" : undefined}
          letterSpacing={isProfile ? "-0.02em" : undefined}
        >
          {title}
        </ModalHeader>
        <ModalCloseButton onMouseUp={(e) => e.currentTarget.blur()} />
        <ModalBody>
          {bodyBeforeForm ? (
            <VStack spacing={4} align="stretch">
              {bodyBeforeForm}
              <ReportReasonFields
                ref={reasonRef}
                isActive={isOpen}
                focusBorderColor={isProfile ? "pink.400" : "brand.500"}
                textareaBorderRadius={isProfile ? "xl" : undefined}
              />
            </VStack>
          ) : (
            <ReportReasonFields
              ref={reasonRef}
              isActive={isOpen}
              focusBorderColor={isProfile ? "pink.400" : "brand.500"}
              textareaBorderRadius={isProfile ? "xl" : undefined}
            />
          )}
        </ModalBody>
        <ModalFooter gap={isProfile ? 2 : undefined}>
          <Button
            variant="ghost"
            mr={isProfile ? 0 : 3}
            onClick={handleClose}
            borderRadius={isProfile ? "xl" : undefined}
          >
            Prekliči
          </Button>
          <Button
            {...(isProfile
              ? {
                  bgGradient: "linear(135deg, #EC5F8C 0%, #F48FB1 100%)",
                  color: "white",
                  _hover: { opacity: 0.92 },
                  borderRadius: "xl",
                }
              : {
                  bg: "brand.500",
                  color: "white",
                  _hover: { bg: "brand.600" },
                })}
            onClick={handleSubmit}
            isLoading={submitting}
            isDisabled={!submitUrl}
          >
            Pošlji prijavo
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
