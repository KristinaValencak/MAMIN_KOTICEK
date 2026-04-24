import { useState, useMemo } from "react";
import { VStack, Heading, Text, FormControl, FormLabel, Input, Button, Link, HStack, Divider, Checkbox } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { FiUser, FiMail, FiLock, FiCheckCircle, FiArrowRight } from "react-icons/fi";
import { API_BASE } from "../../api/config";
import { INPUT_LIMITS } from "../../constants/inputLimits";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { parseApiErrorResponse } from "../../utils/parseApiError.js";

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const userOk = (v) => {
  const t = v.trim();
  return t.length >= INPUT_LIMITS.USERNAME_MIN && t.length <= INPUT_LIMITS.USERNAME_MAX;
};
const passOk = (v) => v.length >= 8 && v.length <= INPUT_LIMITS.PASSWORD_MAX;

/**
 * @param {object} props
 * @param {boolean} [props.showBranding=true]
 * @param {() => void} [props.onSwitchToLogin]
 * @param {(path: string) => void} [props.navigate]
 * @param {() => void} [props.onRegisteredInModal] — po uspešni registraciji v modalu (obvestilo + preklop na prijavo)
 */
export default function RegisterForm({ showBranding = true, onSwitchToLogin, navigate, onRegisteredInModal }) {
  const { toast } = useAppToast();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    repeat: "",
    privacyPolicyAccepted: false,
  });
  const [loading, setLoading] = useState(false);

  const valid = {
    username: userOk(form.username),
    email: emailOk(form.email),
    password: passOk(form.password),
    repeat: form.repeat === form.password && form.repeat.length > 0,
    privacyPolicy: form.privacyPolicyAccepted,
  };
  const allValid = useMemo(() => Object.values(valid).every(Boolean), [valid]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!allValid) return;

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          privacyPolicyAccepted: form.privacyPolicyAccepted,
        }),
      });

      if (res.status === 409) {
        const pe = await parseApiErrorResponse(res);
        toast({
          status: "warning",
          title: "Email že obstaja",
          description: pe.message || "Email je že registriran. Pojdi na prijavo.",
        });
        return;
      }

      if (!res.ok) {
        const pe = await parseApiErrorResponse(res);
        throw new Error(pe.message || "Napaka pri registraciji.");
      }

      const payload = await res.json();

      if (onRegisteredInModal) {
        onRegisteredInModal(payload);
        return;
      }

      toast({
        status: "success",
        title: "Registracija uspešna!",
        description: `Dobrodošla, ${payload.username}!\n\nNa email naslov ${payload.email} smo ti poslali verifikacijsko povezavo.\n\nProsim preveri svoj email in klikni na povezavo za aktivacijo računa.`,
        duration: null,
        onAfterClose: () => navigate?.("/prijava"),
      });
    } catch (err) {
      toast({
        status: "error",
        title: "Napaka",
        description: err.message || "Napaka pri registraciji.",
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
            Pridruži se nam
          </Heading>
          <Text fontSize="md" color="gray.600" fontWeight="500">
            Ustvari račun in postani del skupnosti
          </Text>
        </VStack>
      ) : null}

      <VStack spacing={showBranding ? 6 : 4} w="full">
        <FormControl isRequired>
          <FormLabel fontSize="sm" fontWeight="600" color="gray.700" mb={2} display="flex" alignItems="center" gap={2}>
            <FiUser size={16} />
            Uporabniško ime
          </FormLabel>
          <Input
            name="username"
            value={form.username}
            onChange={onChange}
            maxLength={INPUT_LIMITS.USERNAME_MAX}
            placeholder="mami.ana"
            size={showBranding ? "lg" : "md"}
            variant="flushed"
            borderBottomWidth="2px"
            borderColor={form.username && !valid.username ? "red.400" : "gray.300"}
            _hover={{
              borderColor: form.username && !valid.username ? "red.400" : "gray.400",
            }}
            _focus={{
              borderColor: form.username && !valid.username ? "red.500" : "brand.500",
              boxShadow: "none",
            }}
            fontSize="md"
            py={3}
            bg="transparent"
            transition="all 0.2s"
          />
          {form.username && !valid.username && (
            <Text fontSize="xs" color="red.500" mt={1}>
              Uporabniško ime: {INPUT_LIMITS.USERNAME_MIN}–{INPUT_LIMITS.USERNAME_MAX} znakov
            </Text>
          )}
        </FormControl>

        <FormControl isRequired>
          <FormLabel fontSize="sm" fontWeight="600" color="gray.700" mb={2} display="flex" alignItems="center" gap={2}>
            <FiMail size={16} />
            Email
          </FormLabel>
          <Input
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            maxLength={INPUT_LIMITS.EMAIL}
            placeholder="ana@example.com"
            size={showBranding ? "lg" : "md"}
            variant="flushed"
            borderBottomWidth="2px"
            borderColor={form.email && !valid.email ? "red.400" : "gray.300"}
            _hover={{
              borderColor: form.email && !valid.email ? "red.400" : "gray.400",
            }}
            _focus={{
              borderColor: form.email && !valid.email ? "red.500" : "brand.500",
              boxShadow: "none",
            }}
            fontSize="md"
            py={3}
            bg="transparent"
            transition="all 0.2s"
          />
          {form.email && !valid.email && (
            <Text fontSize="xs" color="red.500" mt={1}>
              Vnesite veljaven email naslov
            </Text>
          )}
        </FormControl>

        <FormControl isRequired>
          <FormLabel fontSize="sm" fontWeight="600" color="gray.700" mb={2} display="flex" alignItems="center" gap={2}>
            <FiLock size={16} />
            Geslo
          </FormLabel>
          <Input
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            maxLength={INPUT_LIMITS.PASSWORD_MAX}
            placeholder="••••••••"
            size={showBranding ? "lg" : "md"}
            variant="flushed"
            borderBottomWidth="2px"
            borderColor={form.password && !valid.password ? "red.400" : "gray.300"}
            _hover={{
              borderColor: form.password && !valid.password ? "red.400" : "gray.400",
            }}
            _focus={{
              borderColor: form.password && !valid.password ? "red.500" : "brand.500",
              boxShadow: "none",
            }}
            fontSize="md"
            py={3}
            bg="transparent"
            transition="all 0.2s"
          />
          {form.password && !valid.password && (
            <Text fontSize="xs" color="red.500" mt={1}>
              Geslo mora biti vsaj 8 znakov dolgo
            </Text>
          )}
        </FormControl>

        <FormControl isRequired>
          <FormLabel fontSize="sm" fontWeight="600" color="gray.700" mb={2} display="flex" alignItems="center" gap={2}>
            <FiCheckCircle size={16} />
            Potrdi geslo
          </FormLabel>
          <Input
            type="password"
            name="repeat"
            value={form.repeat}
            onChange={onChange}
            maxLength={INPUT_LIMITS.PASSWORD_MAX}
            placeholder="••••••••"
            size={showBranding ? "lg" : "md"}
            variant="flushed"
            borderBottomWidth="2px"
            borderColor={form.repeat && !valid.repeat ? "red.400" : "gray.300"}
            _hover={{
              borderColor: form.repeat && !valid.repeat ? "red.400" : "gray.400",
            }}
            _focus={{
              borderColor: form.repeat && !valid.repeat ? "red.500" : "brand.500",
              boxShadow: "none",
            }}
            fontSize="md"
            py={3}
            bg="transparent"
            transition="all 0.2s"
          />
          {form.repeat && !valid.repeat && (
            <Text fontSize="xs" color="red.500" mt={1}>
              Gesli se ne ujemata
            </Text>
          )}
        </FormControl>

        <FormControl isRequired>
          <Checkbox
            name="privacyPolicyAccepted"
            isChecked={form.privacyPolicyAccepted}
            onChange={onChange}
            colorScheme="pink"
            size="md"
            spacing={3}
          >
            <Text fontSize="sm" color="gray.700">
              Strinjam se s{" "}
              <Link href="/politika-zasebnosti" target="_blank" color="brand.500" fontWeight="600" _hover={{ textDecoration: "underline" }}>
                politiko zasebnosti
              </Link>{" "}
              in{" "}
              <Link href="/pogoji-uporabe" target="_blank" color="brand.500" fontWeight="600" _hover={{ textDecoration: "underline" }}>
                pogoji uporabe
              </Link>
            </Text>
          </Checkbox>
          {!valid.privacyPolicy && form.username && (
            <Text fontSize="xs" color="red.500" mt={2}>
              Za nadaljevanje moraš sprejeti politiko zasebnosti
            </Text>
          )}
        </FormControl>

        <Button
          type="submit"
          isDisabled={!allValid}
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
          rightIcon={<FiArrowRight />}
          mt={2}
        >
          Ustvari račun
        </Button>
      </VStack>

      <HStack spacing={4} w="full">
        <Divider borderColor="gray.300" />
        <Text fontSize="xs" color="gray.500" fontWeight="500" whiteSpace="nowrap">
          ALI
        </Text>
        <Divider borderColor="gray.300" />
      </HStack>

      <VStack spacing={3}>
        <Text fontSize="sm" color="gray.600">
          Že imaš račun?{" "}
          {onSwitchToLogin ? (
            <Link
              as="button"
              type="button"
              color="brand.500"
              fontWeight="600"
              onClick={onSwitchToLogin}
              _hover={{ textDecoration: "underline" }}
            >
              Prijavi se
            </Link>
          ) : (
            <Link as={RouterLink} to="/prijava" color="brand.500" fontWeight="600" _hover={{ textDecoration: "underline" }}>
              Prijavi se
            </Link>
          )}
        </Text>
      </VStack>

    </VStack>
  );
}