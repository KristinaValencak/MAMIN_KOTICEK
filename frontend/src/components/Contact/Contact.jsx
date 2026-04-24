import React, { useRef, useState } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import {
  Box,
  Button,
  Container,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  Text,
  Textarea,
  VStack,
  Flex,
  HStack,
  Link,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { Send, User, Mail, MessageSquare, FileText } from "lucide-react";
import { API_BASE } from "../../api/config";
import { INPUT_LIMITS } from "../../constants/inputLimits";

const MotionBox = motion(Box);

export default function Contact({ variant = "full" }) {
  const { toast } = useAppToast();
  const formRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const { isOpen, onOpen, onClose } = useDisclosure();

  function validate(form) {
    const newErrors = {};
    const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;

    if (!form["user_name"].value.trim()) {
      newErrors.name = "Vnesi ime.";
    }

    if (!form["user_email"].value.trim()) {
      newErrors.email = "Vnesi e‑pošto.";
    } else if (!emailRegex.test(form["user_email"].value)) {
      newErrors.email = "Neveljaven e‑poštni naslov.";
    }

    if (!form["subject"].value.trim()) {
      newErrors.subject = "Dodaj zadevo.";
    }

    if (!form["message"].value.trim()) {
      newErrors.message = "Sporočilo ne sme biti prazno.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const form = formRef.current;

    if (!validate(form)) return;

    const formData = {
      name: form["user_name"].value.trim(),
      email: form["user_email"].value.trim(),
      subject: form["subject"].value.trim(),
      message: form["message"].value.trim(),
    };

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Napaka pri pošiljanju");
      }

      toast({
        title: "Hvala!",
        description: "Tvoje sporočilo je bilo poslano.",
        status: "success",
      });

      form.reset();
      setErrors({});
    } catch (err) {
      console.error(err);
      toast({
        title: "Napaka pri pošiljanju",
        description: err.message || "Poskusite znova ali nas kontaktirajte neposredno.",
        status: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const Form = ({ inModal = false }) => (
    <Box
      as="form"
      ref={formRef}
      onSubmit={(e) => {
        onSubmit(e);
        // If submit succeeds we reset; close modal when no errors and not submitting.
        // We'll close after submit in a microtask if there are no validation errors.
        if (inModal) {
          queueMicrotask(() => {
            const hasErrors = Object.keys(errors || {}).length > 0;
            if (!hasErrors) onClose();
          });
        }
      }}
      noValidate
      bg="white"
      p={{ base: 6, md: 8 }}
      borderRadius="2xl"
      boxShadow={inModal ? "none" : "0 4px 24px rgba(0, 0, 0, 0.06)"}
      border={inModal ? "none" : "1px solid"}
      borderColor={inModal ? undefined : "rgba(236, 95, 140, 0.15)"}
    >
      <VStack spacing={6} align="stretch">
        <FormControl isInvalid={!!errors.name}>
          <FormLabel
            color="#333333"
            fontWeight="600"
            fontSize="sm"
            mb={2}
            display="flex"
            alignItems="center"
            gap={2}
          >
            <User size={18} color="#EC5F8C" />
            Ime
          </FormLabel>
          <Input
            name="user_name"
            placeholder="Tvoje ime"
            maxLength={INPUT_LIMITS.CONTACT_NAME}
            variant="unstyled"
            fontSize="md"
            color="#333333"
            px={0}
            pb={3}
            pt={1}
            borderBottom="2px solid"
            borderBottomColor="gray.200"
            borderRadius={0}
            _placeholder={{ color: "gray.400" }}
            _focus={{
              borderBottomColor: "#EC5F8C",
              borderBottomWidth: "3px",
              outline: "none",
              boxShadow: "none",
            }}
            _hover={{ borderBottomColor: "gray.300" }}
          />
          {errors.name && <FormErrorMessage mt={2}>{errors.name}</FormErrorMessage>}
        </FormControl>

        <FormControl isInvalid={!!errors.email}>
          <FormLabel
            color="#333333"
            fontWeight="600"
            fontSize="sm"
            mb={2}
            display="flex"
            alignItems="center"
            gap={2}
          >
            <Mail size={18} color="#EC5F8C" />
            E‑pošta
          </FormLabel>
          <Input
            type="email"
            name="user_email"
            placeholder="ti@primer.si"
            maxLength={INPUT_LIMITS.EMAIL}
            variant="unstyled"
            fontSize="md"
            color="#333333"
            px={0}
            pb={3}
            pt={1}
            borderBottom="2px solid"
            borderBottomColor="gray.200"
            borderRadius={0}
            _placeholder={{ color: "gray.400" }}
            _focus={{
              borderBottomColor: "#EC5F8C",
              borderBottomWidth: "3px",
              outline: "none",
              boxShadow: "none",
            }}
            _hover={{ borderBottomColor: "gray.300" }}
          />
          {errors.email && <FormErrorMessage mt={2}>{errors.email}</FormErrorMessage>}
        </FormControl>

        <FormControl isInvalid={!!errors.subject}>
          <FormLabel
            color="#333333"
            fontWeight="600"
            fontSize="sm"
            mb={2}
            display="flex"
            alignItems="center"
            gap={2}
          >
            <FileText size={18} color="#EC5F8C" />
            Zadeva
          </FormLabel>
          <Input
            name="subject"
            placeholder="Kaj te zanima?"
            maxLength={INPUT_LIMITS.CONTACT_SUBJECT}
            variant="unstyled"
            fontSize="md"
            color="#333333"
            px={0}
            pb={3}
            pt={1}
            borderBottom="2px solid"
            borderBottomColor="gray.200"
            borderRadius={0}
            _placeholder={{ color: "gray.400" }}
            _focus={{
              borderBottomColor: "#EC5F8C",
              borderBottomWidth: "3px",
              outline: "none",
              boxShadow: "none",
            }}
            _hover={{ borderBottomColor: "gray.300" }}
          />
          {errors.subject && <FormErrorMessage mt={2}>{errors.subject}</FormErrorMessage>}
        </FormControl>

        <FormControl isInvalid={!!errors.message}>
          <FormLabel
            color="#333333"
            fontWeight="600"
            fontSize="sm"
            display="flex"
            alignItems="center"
            gap={2}
          >
            <MessageSquare size={18} color="#EC5F8C" />
            Sporočilo
          </FormLabel>
          <Textarea
            name="message"
            placeholder="Povej več o projektu ali ideji…"
            maxLength={INPUT_LIMITS.CONTACT_MESSAGE}
            variant="unstyled"
            fontSize="md"
            color="#333333"
            px={0}
            pb={3}
            pt={1}
            borderBottom="2px solid"
            borderBottomColor="gray.200"
            borderRadius={0}
            resize="vertical"
            rows={3}
            _placeholder={{ color: "gray.400" }}
            _focus={{
              borderBottomColor: "#EC5F8C",
              borderBottomWidth: "3px",
              outline: "none",
              boxShadow: "none",
            }}
            _hover={{ borderBottomColor: "gray.300" }}
          />
          {errors.message && <FormErrorMessage mt={2}>{errors.message}</FormErrorMessage>}
        </FormControl>

        <Flex justify="space-between" align="center" pt={4} gap={4} flexWrap="wrap">
          <Button
            type="submit"
            isLoading={submitting}
            loadingText="Pošiljam"
            rightIcon={<Send size={18} />}
            bg="linear-gradient(135deg, #EC5F8C 0%, #F48FB1 100%)"
            color="white"
            fontWeight="600"
            px={10}
            py={7}
            borderRadius="full"
            _hover={{
              bg: "linear-gradient(135deg, #D94B8C 0%, #EC5F8C 100%)",
              transform: "translateY(-2px)",
              boxShadow: "0 8px 24px rgba(236, 95, 140, 0.4)",
            }}
            _active={{ transform: "translateY(0)" }}
            transition="all 0.3s ease"
            boxShadow="0 4px 16px rgba(236, 95, 140, 0.3)"
          >
            Pošlji sporočilo
          </Button>
        </Flex>
      </VStack>
    </Box>
  );

  if (variant === "modal") {
    return (
      <Box
        as="section"
        id="kontakt"
        position="relative"
        py={{ base: 16, md: 20 }}
        bg="linear-gradient(135deg, #FFF8FA 0%, #FFFFFF 50%, #FFF8FA 100%)"
      >
        <Container maxW="container.lg">
          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            bg="white"
            p={{ base: 6, md: 8 }}
            borderRadius="2xl"
            boxShadow="0 4px 24px rgba(0, 0, 0, 0.06)"
            border="1px solid"
            borderColor="rgba(236, 95, 140, 0.15)"
          >
            <VStack spacing={4} align="stretch">
              <Heading size="xl" color="#333333" fontWeight="extrabold">
                Kontakt
              </Heading>
              <Text fontSize="md" color="#4A4A4A" lineHeight="1.7" maxW="2xl">
                Imaš vprašanje, predlog ali potrebuješ pomoč? Z veseljem ti odgovorimo. Spodaj lahko hitro pošlješ
                sporočilo ali pa nam pišeš direktno na e‑pošto.
              </Text>
                              <Link
                  href="mailto:info.maminkoticek@gmail.com"
                  fontWeight="700"
                  color="pink.600"
                  _hover={{ textDecoration: "underline", color: "pink.700" }}
                >
                  info.maminkoticek@gmail.com
                </Link>
              <HStack spacing={3} flexWrap="wrap">
                <Button
                  onClick={onOpen}
                  rounded="full"
                  px={8}
                  bg="linear-gradient(135deg, #EC5F8C 0%, #F48FB1 100%)"
                  color="white"
                  fontWeight="700"
                  _hover={{ transform: "translateY(-2px)", boxShadow: "0 8px 24px rgba(236, 95, 140, 0.25)" }}
                  transition="all 0.2s ease"
                >
                  Pošlji sporočilo
                </Button>
              </HStack>
            </VStack>
          </MotionBox>
        </Container>

        <Modal isOpen={isOpen} onClose={onClose} size={{ base: "lg", md: "lg" }} scrollBehavior="inside" isCentered>
          <ModalOverlay bg="rgba(0,0,0,0.45)" backdropFilter="blur(4px)" />
          <ModalContent
            borderRadius="2xl"
            mx={{ base: 3, sm: 4 }}
            my={{ base: 4, sm: 6 }}
            maxH={{ base: "calc(100dvh - 2rem)", sm: "calc(100dvh - 3rem)" }}
            overflow="hidden"
          >
            <ModalHeader>Kontaktni obrazec</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <Form inModal />
            </ModalBody>
          </ModalContent>
        </Modal>
      </Box>
    );
  }

  return (
    <Box
      as="section"
      id="kontakt"
      position="relative"
      minH="100dvh"
      py={{ base: 16, md: 24 }}
      bg="linear-gradient(135deg, #FFF8FA 0%, #FFFFFF 50%, #FFF8FA 100%)"
    >
      <Container maxW="container.md" position="relative">
        <VStack spacing={12} align="stretch">
          <MotionBox initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <VStack spacing={4} textAlign="center">
              <Heading size="2xl" color="#333333" fontWeight="extrabold">
                Povežimo se
              </Heading>
              <Text fontSize="lg" color="#4A4A4A" maxW="2xl" mx="auto">
                Imaš vprašanje, idejo ali potrebuješ pomoč? Z veseljem ti odgovorimo.
              </Text>
            </VStack>
          </MotionBox>

          <MotionBox initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}>
            <Form />
          </MotionBox>
        </VStack>
      </Container>
    </Box>
  );
}