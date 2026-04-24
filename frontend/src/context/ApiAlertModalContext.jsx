import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Modal, ModalOverlay, ModalContent, ModalBody, ModalFooter, Button, Text, Box, Flex, VStack, HStack, Icon, Circle, IconButton, Input, FormControl, FormErrorMessage } from "@chakra-ui/react";
import { CloseIcon } from "@chakra-ui/icons";
import { FaCheck, FaExclamationTriangle, FaInfoCircle, FaQuestionCircle } from "react-icons/fa";

const ApiAlertModalContext = createContext(null);

function coerceText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  try {
    // Prefer readable JSON for objects (avoid "[object Object]").
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusAccent(status) {
  switch (status) {
    case "success":
      return "brand.400";
    case "error":
      return "red.400";
    case "warning":
      return "orange.400";
    default:
      return "brand.400";
  }
}

function statusActionLabel(status) {
  switch (status) {
    case "success":
      return "V redu";
    case "warning":
      return "Razumem";
    case "error":
      return "Zapri";
    default:
      return "V redu";
  }
}

function statusIcon(status) {
  switch (status) {
    case "success":
      return FaCheck;
    case "warning":
      return FaExclamationTriangle;
    case "error":
      return FaExclamationTriangle;
    case "question":
      return FaQuestionCircle;
    default:
      return FaInfoCircle;
  }
}

function statusSoftBg(status) {
  switch (status) {
    case "error":
      return "red.50";
    case "warning":
      return "orange.50";
    case "success":
      return "pink.50";
    default:
      return "brand.50";
  }
}

function statusButtonProps(status) {
  if (status === "error") {
    return {
      bg: "red.500",
      _hover: { bg: "red.600" },
      _active: { bg: "red.700" },
    };
  }
  if (status === "warning") {
    return {
      bg: "orange.500",
      _hover: { bg: "orange.600" },
      _active: { bg: "orange.700" },
    };
  }
  return {
    bgGradient: "linear(135deg, #EC5F8C 0%, #F48FB1 100%)",
    _hover: { opacity: 0.92 },
    _active: { opacity: 0.86 },
  };
}

const CONFIRM_INIT = {
  open: false,
  title: "",
  description: "",
  confirmText: "Potrdi",
  cancelText: "Prekliči",
  destructive: false,
  requireExactText: null,
  inputPlaceholder: "",
  typedValue: "",
  inlineError: "",
};

export function ApiAlertModalProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    status: "error",
    title: "",
    description: "",
    actionText: "",
  });
  const closeTimerRef = useRef(null);
  const afterCloseRef = useRef(null);

  const [confirmState, setConfirmState] = useState(CONFIRM_INIT);
  const confirmResolveRef = useRef(null);
  const cancelRef = useRef(null);

  const close = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    const cb = afterCloseRef.current;
    afterCloseRef.current = null;
    setState((s) => ({ ...s, open: false }));
    if (typeof cb === "function") {
      queueMicrotask(() => {
        try {
          cb();
        } catch (e) {
          console.error(e);
        }
      });
    }
  }, []);

  const toast = useCallback(
    ({
      status = "info",
      title = "",
      description = "",
      duration = null,
      onAfterClose = null,
      actionText = "",
    }) => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      afterCloseRef.current = typeof onAfterClose === "function" ? onAfterClose : null;
      setState({
        open: true,
        status,
        title: coerceText(title) || (status === "success" ? "Uspešno" : "Obvestilo"),
        description: coerceText(description),
        actionText: String(actionText || ""),
      });
      const ms =
        duration != null && Number.isFinite(Number(duration))
          ? Number(duration)
          : status === "success"
            ? 2600
            : 3500;
      if (ms != null && ms > 0) {
        closeTimerRef.current = setTimeout(() => {
          close();
        }, ms);
      }
    },
    [close]
  );

  const closeConfirm = useCallback((value) => {
    const resolve = confirmResolveRef.current;
    confirmResolveRef.current = null;
    setConfirmState(CONFIRM_INIT);
    if (resolve) resolve(Boolean(value));
  }, []);

  const confirm = useCallback((opts) => {
    const {
      title = "",
      description = "",
      confirmText = "Potrdi",
      cancelText = "Prekliči",
      destructive = false,
      requireExactText = null,
      inputPlaceholder = "",
    } = opts || {};
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmState({
        open: true,
        title,
        description: String(description || ""),
        confirmText,
        cancelText,
        destructive,
        requireExactText: requireExactText != null ? String(requireExactText) : null,
        inputPlaceholder: String(inputPlaceholder || ""),
        typedValue: "",
        inlineError: "",
      });
    });
  }, []);

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    []
  );

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  const onConfirmAction = useCallback(() => {
    if (confirmState.requireExactText) {
      if (confirmState.typedValue !== confirmState.requireExactText) {
        setConfirmState((s) => ({
          ...s,
          inlineError: `Vnesite točno "${confirmState.requireExactText}".`,
        }));
        return;
      }
    }
    closeConfirm(true);
  }, [confirmState.requireExactText, confirmState.typedValue, closeConfirm]);

  return (
    <ApiAlertModalContext.Provider value={value}>
      {children}
      <Modal
        isOpen={state.open}
        onClose={close}
        isCentered
        size="lg"
        scrollBehavior="inside"
        closeOnOverlayClick
        closeOnEsc
      >
        <ModalOverlay bg="blackAlpha.400" backdropFilter="blur(8px)" />
        <ModalContent
          mx={3}
          borderRadius="2xl"
          overflow="hidden"
          w="full"
          maxW={{ base: "calc(100vw - 24px)", sm: "lg" }}
          boxShadow="0 25px 50px -12px rgba(15, 23, 42, 0.18)"
          borderWidth="1px"
          borderColor="gray.100"
        >
          <Box h="2px" bg={statusAccent(state.status)} flexShrink={0} opacity={0.9} />
          <Flex justify="flex-end" align="center" h="44px" px={2} flexShrink={0} borderBottomWidth="1px" borderColor="gray.50">
            <IconButton
              aria-label="Zapri"
              icon={<CloseIcon boxSize={3} />}
              size="sm"
              variant="ghost"
              borderRadius="full"
              minW="36px"
              h="36px"
              color="gray.600"
              _hover={{ bg: "gray.100", color: "gray.800" }}
              onClick={close}
            />
          </Flex>
          <ModalBody
            pt={{ base: 5, sm: 6 }}
              pb={{ base: 6, sm: 7 }}
            px={{ base: 5, sm: 6 }}
          >
              <VStack align="stretch" spacing={state.description ? 4 : 3} py={{ base: 2, sm: 4 }}>
                <Flex justify="center" pt={1}>
                  <Circle
                    size={{ base: "44px", sm: "52px" }}
                    bg={statusSoftBg(state.status)}
                    borderWidth="1px"
                    borderColor="blackAlpha.100"
                  >
                    <Icon as={statusIcon(state.status)} boxSize={{ base: 5, sm: 6 }} color={statusAccent(state.status)} />
                  </Circle>
                </Flex>
              <Text
                as="p"
                fontSize={{ base: "sm", sm: "md" }}
                fontWeight="600"
                color="gray.700"
                letterSpacing="-0.01em"
                lineHeight="1.65"
                  textAlign="center"
              >
                {state.title}
              </Text>
              {state.description ? (
                <Text
                  as="p"
                  fontSize="sm"
                  fontWeight="400"
                  color="gray.600"
                  whiteSpace="pre-wrap"
                  lineHeight="1.8"
                    textAlign="center"
                >
                  {state.description}
                </Text>
              ) : null}
            </VStack>
          </ModalBody>
            {/* No mandatory OK button; close via X / overlay / ESC (or auto-close timer). */}
        </ModalContent>
      </Modal>

      <Modal
        isOpen={confirmState.open}
        onClose={() => closeConfirm(false)}
        isCentered
        size="lg"
        scrollBehavior="inside"
        closeOnOverlayClick
        closeOnEsc
      >
        <ModalOverlay bg="blackAlpha.400" backdropFilter="blur(8px)" />
        <ModalContent
          mx={3}
          borderRadius="2xl"
          overflow="hidden"
          w="full"
          maxW={{ base: "calc(100vw - 24px)", sm: "lg" }}
          boxShadow="0 25px 50px -12px rgba(15, 23, 42, 0.18)"
          borderWidth="1px"
          borderColor="gray.100"
        >
          <Box
            h="2px"
            bg={confirmState.destructive ? "red.400" : "brand.400"}
            flexShrink={0}
            opacity={0.9}
          />
          <Box
            position="relative"
            pt={{ base: 5, sm: 6 }}
            pb={{ base: 5, sm: 6 }}
            pl={{ base: 5, sm: 6 }}
            pr={{ base: 14, sm: 16 }}
            borderBottomWidth="1px"
            borderColor="gray.50"
          >
            <HStack spacing={3} align="center">
              <Circle
                size="36px"
                bg={confirmState.destructive ? "red.50" : "brand.50"}
                borderWidth="1px"
                borderColor="blackAlpha.100"
                flexShrink={0}
              >
                <Icon
                  as={confirmState.destructive ? FaExclamationTriangle : FaQuestionCircle}
                  boxSize={{ base: "10px", sm: "15px" }}
                  color={confirmState.destructive ? "red.500" : "brand.500"}
                />
              </Circle>
              <Text
                as="span"
                display="block"
                pr={1}
                fontSize={{ base: "sm", sm: "md" }}
                fontWeight="600"
                color="gray.700"
                letterSpacing="-0.01em"
                lineHeight="1.65"
              >
                {confirmState.title}
              </Text>
            </HStack>
            <IconButton
              aria-label="Zapri"
              icon={<CloseIcon boxSize={3} />}
              size="sm"
              variant="ghost"
              borderRadius="full"
              minW="36px"
              h="36px"
              position="absolute"
              top={{ base: 3, sm: 3 }}
              right={{ base: 2, sm: 3 }}
              color="gray.600"
              _hover={{ bg: "gray.100", color: "gray.800" }}
              onClick={() => closeConfirm(false)}
            />
          </Box>
          <ModalBody
            px={{ base: 5, sm: 6 }}
            py={{ base: 7, sm: 9 }}
          >
            <Text
              fontSize="sm"
              fontWeight="400"
              color="gray.600"
              whiteSpace="pre-wrap"
              lineHeight="1.8"
              mb={confirmState.requireExactText ? 5 : 0}
            >
              {confirmState.description == null ? "" : String(confirmState.description)}
            </Text>
            {confirmState.requireExactText ? (
              <FormControl isInvalid={Boolean(confirmState.inlineError)}>
                <Input
                  value={confirmState.typedValue}
                  placeholder={confirmState.inputPlaceholder || undefined}
                  borderRadius="lg"
                  onChange={(e) =>
                    setConfirmState((s) => ({
                      ...s,
                      typedValue: e.target.value,
                      inlineError: "",
                    }))
                  }
                />
                {confirmState.inlineError ? (
                  <FormErrorMessage>{confirmState.inlineError}</FormErrorMessage>
                ) : null}
              </FormControl>
            ) : null}
          </ModalBody>
          <ModalFooter
            px={{ base: 5, sm: 6 }}
            pb={{ base: 7, sm: 8 }}
            pt={5}
            gap={2}
            flexWrap="wrap"
            justifyContent="flex-end"
            borderTopWidth="1px"
            borderColor="gray.50"
          >
            <Button
              ref={cancelRef}
              onClick={() => closeConfirm(false)}
              variant="ghost"
              size="sm"
              h="auto"
              py={2}
              px={2}
              fontWeight="500"
              color="gray.500"
              _hover={{ color: "gray.800", bg: "transparent" }}
            >
              {confirmState.cancelText}
            </Button>
            <Button
              onClick={onConfirmAction}
              size="sm"
              height="36px"
              px={5}
              rounded="full"
              fontWeight="500"
              fontSize="sm"
              bg={confirmState.destructive ? "red.500" : "brand.500"}
              color="white"
              _hover={{
                bg: confirmState.destructive ? "red.600" : "brand.600",
              }}
              _active={{
                bg: confirmState.destructive ? "red.700" : "brand.700",
              }}
            >
              {confirmState.confirmText}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </ApiAlertModalContext.Provider>
  );
}

/** @returns {{ toast: Function, confirm: Function }} */
export function useAppToast() {
  const ctx = useContext(ApiAlertModalContext);
  if (!ctx) {
    throw new Error("useAppToast mora biti znotraj ApiAlertModalProvider");
  }
  return ctx;
}
