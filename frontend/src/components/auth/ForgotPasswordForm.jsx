import { useState } from "react";
import { Box, VStack, Heading, Text, FormControl, FormLabel, Input, Button, Link, HStack } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { FiMail, FiArrowLeft } from "react-icons/fi";
import { API_BASE } from "../../api/config";
import { INPUT_LIMITS } from "../../constants/inputLimits";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { parseApiErrorResponse } from "../../utils/parseApiError.js";

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/**
 * @param {object} props
 * @param {boolean} [props.showBranding=true]
 * @param {() => void} [props.onBack] — modal: po uspehu / ob „Nazaj“ brez navigacije na /forgot-password stran
 * @param {(path: string) => void} [props.navigate] — stran: po uspehu → /prijava
 */
export default function ForgotPasswordForm({ showBranding = true, onBack, navigate }) {
  const { toast } = useAppToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const valid = emailOk(email);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!valid) return;

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          status: "success",
          title: "Email poslan!",
          description: `${data.message || ""}\n\nPreveri svoj email (tudi mapo z neželeno pošto) in sledi navodilom za ponastavitev gesla.`,
          duration: null,
          onAfterClose: () => {
            if (onBack) onBack();
            else navigate?.("/prijava");
          },
        });
      } else {
        const pe = await parseApiErrorResponse(res);
        throw new Error(pe.message || "Napaka pri pošiljanju emaila.");
      }
    } catch (err) {
      toast({
        status: "error",
        title: "Napaka",
        description: err.message || "Napaka pri pošiljanju emaila.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <VStack as="form" onSubmit={onSubmit} spacing={showBranding ? 8 : 5} w="full" align="stretch">
      {showBranding ? (
        <VStack spacing={3} align="center" textAlign="center">
          <Heading
            fontSize={{ base: "3xl", md: "4xl" }}
            fontWeight="800"
            bgGradient="linear(135deg, #D94B8C 0%, #EC5F8C 50%, #F48FB1 100%)"
            bgClip="text"
            letterSpacing="-0.02em"
          >
            Pozabljeno geslo?
          </Heading>
          <Text fontSize="md" color="gray.600" fontWeight="500">
            Vnesi svoj email in poslali ti bomo navodila za ponastavitev gesla
          </Text>
        </VStack>
      ) : null}

      <VStack spacing={showBranding ? 6 : 4} w="full">
        <FormControl isRequired>
          <FormLabel fontSize="sm" fontWeight="600" color="gray.700" mb={2} display="flex" alignItems="center" gap={2}>
            <FiMail size={16} />
            Email
          </FormLabel>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={INPUT_LIMITS.EMAIL}
            placeholder="ana@example.com"
            size={showBranding ? "lg" : "md"}
            variant="flushed"
            borderBottomWidth="2px"
            borderColor={email && !valid ? "red.400" : "gray.300"}
            _hover={{
              borderColor: email && !valid ? "red.400" : "gray.400",
            }}
            _focus={{
              borderColor: email && !valid ? "red.500" : "brand.500",
              boxShadow: "none",
            }}
            fontSize="md"
            py={3}
            bg="transparent"
            transition="all 0.2s"
          />
          {email && !valid && (
            <Text fontSize="xs" color="red.500" mt={1}>
              Vnesite veljaven email naslov
            </Text>
          )}
        </FormControl>

        <Button
          type="submit"
          isDisabled={!valid}
          isLoading={loading}
          w="full"
          h={showBranding ? "54px" : "48px"}
          bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
          color="white"
          fontSize="md"
          fontWeight="600"
          _hover={{
            bgGradient: "linear(135deg, #D94B8C 0%, #EC5F8C 100%)",
            transform: "translateY(-2px)",
            boxShadow: "0 8px 24px rgba(236, 95, 140, 0.25)",
          }}
          _active={{
            transform: "translateY(0)",
          }}
          transition="all 0.2s"
          mt={2}
        >
          Pošlji navodila
        </Button>
      </VStack>

      <HStack spacing={4} w="full" justify="center">
        {onBack ? (
          <Link
            as="button"
            type="button"
            color="brand.500"
            fontWeight="600"
            _hover={{ textDecoration: "underline" }}
            display="flex"
            alignItems="center"
            gap={2}
            onClick={onBack}
          >
            <FiArrowLeft size={16} />
            Nazaj na prijavo
          </Link>
        ) : (
          <Link
            as={RouterLink}
            to="/prijava"
            color="brand.500"
            fontWeight="600"
            _hover={{ textDecoration: "underline" }}
            display="flex"
            alignItems="center"
            gap={2}
          >
            <FiArrowLeft size={16} />
            Nazaj na prijavo
          </Link>
        )}
      </HStack>

      {showBranding ? (
        <Box pt={2} />
      ) : null}
    </VStack>
  );
}
