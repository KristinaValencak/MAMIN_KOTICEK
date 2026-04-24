import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box, Container, VStack, Heading, Text, Spinner, Button } from "@chakra-ui/react";
import { FiCheckCircle, FiXCircle } from "react-icons/fi";
import Footer from "../Footer/Footer";
import { API_BASE } from "../../api/config";
import { refreshUserSession } from "../../utils/userSession";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const hasVerified = useRef(false);

  useEffect(() => {
    if (hasVerified.current) return;

    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Manjka verifikacijski token.");
      return;
    }

    const verifyEmail = async () => {
      hasVerified.current = true;

      try {
        const res = await fetch(`${API_BASE}/api/verify-email?token=${token}`, {
          credentials: 'include'
        });
        const data = await res.json();

        if (!res.ok) {
          setStatus("error");

          if (data.alreadyVerified) {
            setMessage("Ta povezava je že bila uporabljena. Tvoj email je že verificiran!");
            setTimeout(() => {
              navigate("/prijava");
            }, 3000);
          } else {
            setMessage(data.message || "Napaka pri verifikaciji emaila.");
          }
          return;
        }

        if (data.id && data.username) {
          localStorage.setItem("user", JSON.stringify({
            id: data.id,
            username: data.username,
            email: data.email,
            isAdmin: data.isAdmin || false,
            avatarUrl: data.avatarUrl || null,
            permissions: [],
            roles: [],
          }));
          await refreshUserSession(true);
          window.dispatchEvent(new Event("auth-changed"));
        }

        setStatus("success");
        setMessage(data.message || "Email uspešno verificiran!");

        setTimeout(() => {
          navigate("/");
        }, 3000);
      } catch {
        setStatus("error");
        setMessage("Napaka pri verifikaciji emaila.");
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

  return (
    <Box minH="100vh" display="flex" flexDirection="column" bgGradient="linear(to-br, #fafafa, #f5f5f5, #fafafa)">
      <Container maxW="600px" flex="1" display="flex" alignItems="center" py={20}>
        <VStack spacing={8} w="full" align="center" textAlign="center">
          {status === "loading" && (
            <>
              <Spinner size="xl" color="brand.500" thickness="4px" />
              <Heading size="lg">Verificiram email...</Heading>
              <Text color="gray.600">Prosim počakaj trenutek.</Text>
            </>
          )}

          {status === "success" && (
            <>
              <Box
                p={6}
                bg="green.100"
                rounded="full"
                color="green.500"
              >
                <FiCheckCircle size={64} />
              </Box>
              <Heading size="lg" color="green.600">Uspešno!</Heading>
              <Text fontSize="lg" color="gray.600">{message}</Text>
              <Text fontSize="sm" color="gray.500">
                Preusmerjam te na forum...
              </Text>
            </>
          )}

          {status === "error" && (
            <>
              <Box
                p={6}
                bg="red.100"
                rounded="full"
                color="red.500"
              >
                <FiXCircle size={64} />
              </Box>
              <Heading size="lg" color="red.600">Napaka</Heading>
              <Text fontSize="lg" color="gray.600">{message}</Text>
              <Button
                onClick={() => navigate("/registracija")}
                bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
                color="white"
                _hover={{
                  bgGradient: "linear(135deg, #D94B8C 0%, #EC5F8C 100%)",
                }}
              >
                Nazaj na registracijo
              </Button>
            </>
          )}
        </VStack>
      </Container>
      <Footer variant="forum" />
    </Box>
  );
};

export default VerifyEmail;
