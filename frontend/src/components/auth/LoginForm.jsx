import { useState, useMemo } from "react";
import {VStack, Heading, Text, FormControl, FormLabel, Input, Button, Link, HStack, Divider} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { FiMail, FiLock, FiArrowRight } from "react-icons/fi";
import { API_BASE } from "../../api/config";
import { refreshUserSession } from "../../utils/userSession";
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
 * @param {() => void} [props.onAuthenticated] 
 * @param {(path: string) => void} [props.navigate]
 * @param {() => void} [props.onSwitchToRegister] 
 * @param {() => void} [props.onForgotPassword] 
 */
export default function LoginForm({
  showBranding = true,
  onAuthenticated,
  navigate,
  onSwitchToRegister,
  onForgotPassword,
}) {
  const { toast, confirm } = useAppToast();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);

  const valid = {
    identifier: form.identifier.includes("@") ? emailOk(form.identifier) : userOk(form.identifier),
    password: passOk(form.password),
  };
  const allValid = useMemo(() => Object.values(valid).every(Boolean), [valid]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const finishSuccess = async (username) => {
    if (onAuthenticated) {
      onAuthenticated();
      return;
    }
    toast({
      status: "success",
      title: "Uspešna prijava!",
      description: `Dobrodošla nazaj, ${username}!`,
      duration: 2200,
      onAfterClose: () => navigate?.("/"),
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!allValid) return;

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          identifier: form.identifier.trim(),
          password: form.password,
        }),
      });

      if (res.status === 401) {
        const pe = await parseApiErrorResponse(res);
        toast({
          status: "error",
          title: "Napaka pri prijavi",
          description: pe.message || "Napačni prijavni podatki.",
        });
        return;
      }

      if (res.status === 403) {
        const d = await res.json().catch(() => ({}));
        if (d.emailVerified === false) {
          const msg = d.error?.message || d.message || "Email še ni verificiran.";
          const sendAgain = await confirm({
            title: "Email ni verificiran",
            description: `${msg}\n\nŽeliš ponovno prejeti verifikacijski email?`,
            confirmText: "Pošlji ponovno",
            cancelText: "Prekliči",
          });

          if (sendAgain) {
            try {
              const resendRes = await fetch(`${API_BASE}/api/resend-verification`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: d.email }),
              });

              if (resendRes.ok) {
                const resendData = await resendRes.json().catch(() => ({}));
                toast({
                  status: "success",
                  title: "Email poslan!",
                  description: resendData.message || "Preveri nabiralnik.",
                });
              } else {
                const pe = await parseApiErrorResponse(resendRes);
                throw new Error(pe.message);
              }
            } catch (err) {
              toast({
                status: "error",
                title: "Napaka",
                description: err.message || "Napaka pri pošiljanju emaila.",
              });
            }
          }
          return;
        }
      }

      if (!res.ok) {
        const pe = await parseApiErrorResponse(res);
        throw new Error(pe.message || "Napaka pri prijavi.");
      }

      const payload = await res.json();
      const { id, username, email, isAdmin, avatarUrl } = payload || {};

      if (!id || !username || !email) {
        throw new Error("Manjkajoči podatki v odgovoru (id/username/email).");
      }

      localStorage.setItem(
        "user",
        JSON.stringify({
          id,
          username,
          email,
          isAdmin: isAdmin || false,
          avatarUrl: avatarUrl || null,
          permissions: [],
          roles: [],
        })
      );

      await refreshUserSession(true);

      window.dispatchEvent(new Event("auth-changed"));

      await finishSuccess(username);
    } catch (err) {
      toast({
        status: "error",
        title: "Napaka",
        description: err.message || "Napaka pri prijavi.",
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
            Dobrodošla nazaj
          </Heading>
          <Text fontSize="md" color="gray.600" fontWeight="500">
            Prijavi se in nadaljuj, kjer si ostala
          </Text>
        </VStack>
      ) : null}

      <VStack spacing={showBranding ? 6 : 4} w="full">
        <FormControl isRequired>
          <FormLabel
            fontSize="sm"
            fontWeight="600"
            color="gray.700"
            mb={2}
            display="flex"
            alignItems="center"
            gap={2}
          >
            <FiMail size={16} />
            Email
          </FormLabel>
          <Input
            name="identifier"
            value={form.identifier}
            onChange={onChange}
            maxLength={INPUT_LIMITS.LOGIN_IDENTIFIER}
            placeholder="ana@example.com"
            size={showBranding ? "lg" : "md"}
            variant="flushed"
            borderBottomWidth="2px"
            borderColor={form.identifier && !valid.identifier ? "red.400" : "gray.300"}
            _hover={{
              borderColor: form.identifier && !valid.identifier ? "red.400" : "gray.400",
            }}
            _focus={{
              borderColor: form.identifier && !valid.identifier ? "red.500" : "brand.500",
              boxShadow: "none",
            }}
            fontSize="md"
            py={3}
            bg="transparent"
            transition="all 0.2s"
          />
          {form.identifier && !valid.identifier && (
            <Text fontSize="xs" color="red.500" mt={1}>
              {form.identifier.includes("@")
                ? "Vnesite veljaven email."
                : `Uporabniško ime: ${INPUT_LIMITS.USERNAME_MIN}–${INPUT_LIMITS.USERNAME_MAX} znakov.`}
            </Text>
          )}
        </FormControl>

        <FormControl isRequired>
          <FormLabel
            fontSize="sm"
            fontWeight="600"
            color="gray.700"
            mb={2}
            display="flex"
            alignItems="center"
            gap={2}
          >
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
          Prijava
        </Button>
      </VStack>

      <HStack justify="flex-end" w="full">
        {onForgotPassword ? (
          <Link
            as="button"
            type="button"
            color="brand.500"
            fontSize="sm"
            fontWeight="500"
            onClick={onForgotPassword}
            _hover={{ textDecoration: "underline" }}
          >
            Pozabljeno geslo?
          </Link>
        ) : (
          <Link
            href="/forgot-password"
            color="brand.500"
            fontSize="sm"
            fontWeight="500"
            _hover={{ textDecoration: "underline" }}
          >
            Pozabljeno geslo?
          </Link>
        )}
      </HStack>

      <HStack spacing={4} w="full">
        <Divider borderColor="gray.300" />
        <Text fontSize="xs" color="gray.500" fontWeight="500" whiteSpace="nowrap">
          ALI
        </Text>
        <Divider borderColor="gray.300" />
      </HStack>

      <VStack spacing={3}>
        <Text fontSize="sm" color="gray.600">
          Nimaš računa?{" "}
          {onSwitchToRegister ? (
            <Link
              as="button"
              type="button"
              color="brand.500"
              fontWeight="600"
              onClick={onSwitchToRegister}
              _hover={{ textDecoration: "underline" }}
            >
              Ustvari račun
            </Link>
          ) : (
            <Link as={RouterLink} to="/registracija" color="brand.500" fontWeight="600" _hover={{ textDecoration: "underline" }}>
              Ustvari račun
            </Link>
          )}
        </Text>
      </VStack>

    </VStack>
  );
}