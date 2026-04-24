import { useEffect, useState } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, Text, Box, VStack, Heading } from "@chakra-ui/react";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import ForgotPasswordForm from "./ForgotPasswordForm";
import { GUEST_TIMER_REASON_GRACE } from "../../constants/guestLimits";

const REASON_COPY = {
  timer: "Za neomejeno brskanje in sodelovanje se prijavi ali ustvari račun.",
  default: "Za to dejanje moraš biti prijavljena.",
};

function reasonDescription(reason) {
  if (reason === "timer" || reason === GUEST_TIMER_REASON_GRACE) {
    return REASON_COPY.timer;
  }
  if (reason && reason !== "timer" && reason !== GUEST_TIMER_REASON_GRACE) return reason;
  return REASON_COPY.default;
}

export default function AuthGateModal({
  isOpen,
  tab,
  reason,
  onClose,
  onAuthenticated,
  onTabChange,
}) {
  const { toast } = useAppToast();
  const [forgotOpen, setForgotOpen] = useState(false);
  const showRegister = tab === "register";

  useEffect(() => {
    if (!isOpen) setForgotOpen(false);
  }, [isOpen]);

  const handleAuthSuccess = () => {
    (onAuthenticated ?? onClose)();
  };

  const shouldShowReasonHeader =
    reason === "timer" ||
    reason === GUEST_TIMER_REASON_GRACE ||
    (typeof reason === "string" && reason.trim().length > 0);

  const headerNode = forgotOpen ? (
    <VStack spacing={2} align="center" textAlign="center">
      <Heading as="h2" fontSize={{ base: "lg", sm: "xl" }} color="gray.800" fontWeight="800" letterSpacing="-0.02em">
        Pozabljeno geslo?
      </Heading>
      <Text as="p" fontSize={{ base: "sm", sm: "md" }} color="gray.600" fontWeight="500" lineHeight="1.65">
        Vnesi svoj email in poslali ti bomo navodila za ponastavitev gesla
      </Text>
    </VStack>
  ) : shouldShowReasonHeader ? (
    <Text
      as="p"
      fontSize={{ base: "md", sm: "lg" }}
      color="gray.700"
      fontWeight="500"
      lineHeight="1.65"
      letterSpacing="-0.01em"
      textAlign="center"
    >
      {reasonDescription(reason)}
    </Text>
  ) : showRegister ? (
    <VStack spacing={2} align="center" textAlign="center">
      <Heading
        as="h2"
        fontSize={{ base: "2xl", sm: "3xl" }}
        fontWeight="900"
        bgGradient="linear(135deg, #D94B8C 0%, #EC5F8C 50%, #F48FB1 100%)"
        bgClip="text"
        letterSpacing="-0.02em"
      >
        Pridruži se nam
      </Heading>
      <Text as="p" fontSize={{ base: "sm", sm: "md" }} color="gray.600" fontWeight="500" lineHeight="1.65">
        Ustvari račun in postani del skupnosti
      </Text>
    </VStack>
  ) : (
    <VStack spacing={2} align="center" textAlign="center">
      <Heading
        as="h2"
        fontSize={{ base: "2xl", sm: "3xl" }}
        fontWeight="900"
        bgGradient="linear(135deg, #D94B8C 0%, #EC5F8C 50%, #F48FB1 100%)"
        bgClip="text"
        letterSpacing="-0.02em"
      >
        Dobrodošla nazaj
      </Heading>
      <Text as="p" fontSize={{ base: "sm", sm: "md" }} color="gray.600" fontWeight="500" lineHeight="1.65">
        Prijavi se in nadaljuj, kjer si ostala
      </Text>
    </VStack>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlayClick
      closeOnEsc
      isCentered
      size="lg"
      scrollBehavior="inside"
      zIndex={1600}
    >
      <ModalOverlay bg="blackAlpha.400" backdropFilter="blur(8px)" />
      <ModalContent
        borderRadius="2xl"
        mx={3}
        overflow="hidden"
        boxShadow="0 25px 50px -12px rgba(15, 23, 42, 0.18)"
        borderWidth="1px"
        borderColor="gray.100"
      >
        <ModalHeader
          pt={6}
          pb={6}
          px={{ base: 5, sm: 6 }}
          pr={{ base: 14, sm: 16 }}
          borderBottomWidth="1px"
          borderColor="gray.50"
        >
          {headerNode}
        </ModalHeader>
        <ModalCloseButton
          top={3}
          right={3}
          borderRadius="full"
          size="md"
          bg="blackAlpha.50"
          color="gray.600"
          _hover={{ bg: "blackAlpha.100", color: "gray.800" }}
          aria-label="Zapri"
          onMouseUp={(e) => e.currentTarget.blur()}
        />
        <ModalBody
          pt={5}
          pb="calc(1.5rem + env(safe-area-inset-bottom, 0px))"
          overflowY="auto"
          maxH={{ base: "calc(100dvh - 220px)", sm: "calc(100dvh - 240px)" }}
        >
          {forgotOpen ? (
            <ForgotPasswordForm showBranding={false} onBack={() => setForgotOpen(false)} />
          ) : !showRegister ? (
            <LoginForm
              showBranding={false}
              onAuthenticated={handleAuthSuccess}
              onSwitchToRegister={() => onTabChange("register")}
              onForgotPassword={() => setForgotOpen(true)}
            />
          ) : (
            <RegisterForm
              showBranding={false}
              onSwitchToLogin={() => onTabChange("login")}
              onRegisteredInModal={() => {
                toast({
                  status: "success",
                  title: "Registracija uspešna",
                  description: "Preveri email za verifikacijo, nato se prijavi.",
                  duration: 6000,
                  isClosable: true,
                });
                onTabChange("login");
              }}
            />
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
