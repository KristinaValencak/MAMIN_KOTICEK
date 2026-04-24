import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {Box, Container, VStack, Heading, Text, FormControl, FormLabel, Input, Button, Link, HStack} from "@chakra-ui/react";
import Footer from "../../Footer/Footer";
import { FiLock, FiArrowLeft } from "react-icons/fi";
import { API_BASE } from "../../../api/config";
import { INPUT_LIMITS } from "../../../constants/inputLimits";
import { useAppToast } from "../../../context/ApiAlertModalContext.jsx";
import { parseApiErrorResponse } from "../../../utils/parseApiError.js";

const passOk = (v) => v.length >= 8 && v.length <= INPUT_LIMITS.PASSWORD_MAX;

const ResetPassword = () => {
    const { toast } = useAppToast();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const navigate = useNavigate();

    const [form, setForm] = useState({
        password: "",
        confirmPassword: ""
    });
    const [loading, setLoading] = useState(false);
    const missingTokenToastRef = useRef(false);

    useEffect(() => {
        if (!token && !missingTokenToastRef.current) {
            missingTokenToastRef.current = true;
            toast({
                status: "error",
                title: "Manjka token",
                description: "Token za ponastavitev gesla ni veljaven.",
                duration: null,
                onAfterClose: () => navigate("/forgot-password"),
            });
        }
    }, [token, navigate, toast]);

    const valid = {
        password: passOk(form.password),
        confirmPassword: form.password === form.confirmPassword && form.confirmPassword.length > 0
    };
    const allValid = valid.password && valid.confirmPassword;

    const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!allValid || !token) return;

        try {
            setLoading(true);

            const res = await fetch(`${API_BASE}/api/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token: token,
                    password: form.password,
                }),
            });

            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                toast({
                    status: "success",
                    title: "Geslo uspešno ponastavljeno!",
                    description: data.message || "",
                    duration: null,
                    onAfterClose: () => navigate("/prijava"),
                });
            } else {
                const pe = await parseApiErrorResponse(res);
                throw new Error(pe.message || "Napaka pri ponastavitvi gesla.");
            }
        } catch (err) {
            toast({
                status: "error",
                title: "Napaka",
                description: err.message || "Napaka pri ponastavitvi gesla.",
            });
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return null;
    }

    return (
        <Box
            minH="100vh"
            display="flex"
            flexDirection="column"
            position="relative"
            overflow="hidden"
            bgGradient="linear(to-br, #fafafa, #f5f5f5, #fafafa)"
        >
            <Container maxW="450px" flex="1" display="flex" alignItems="center" py={{ base: 12, md: 20 }} position="relative" zIndex={1}>
                <VStack
                    as="form"
                    onSubmit={onSubmit}
                    spacing={8}
                    w="full"
                    align="stretch"
                >
                    <VStack spacing={3} align="center" textAlign="center">
                        <Heading
                            fontSize={{ base: "3xl", md: "4xl" }}
                            fontWeight="800"
                            bgGradient="linear(135deg, #D94B8C 0%, #EC5F8C 50%, #F48FB1 100%)"
                            bgClip="text"
                            letterSpacing="-0.02em"
                        >
                            Ponastavi geslo
                        </Heading>
                        <Text fontSize="md" color="gray.600" fontWeight="500">
                            Vnesi novo geslo za svoj račun
                        </Text>
                    </VStack>

                    <VStack spacing={6} w="full">
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
                                Novo geslo
                            </FormLabel>
                            <Input
                                type="password"
                                name="password"
                                value={form.password}
                                onChange={onChange}
                                maxLength={INPUT_LIMITS.PASSWORD_MAX}
                                placeholder="••••••••"
                                size="lg"
                                variant="flushed"
                                borderBottomWidth="2px"
                                borderColor={form.password && !valid.password ? "red.400" : "gray.300"}
                                _hover={{
                                    borderColor: form.password && !valid.password ? "red.400" : "gray.400"
                                }}
                                _focus={{
                                    borderColor: form.password && !valid.password ? "red.500" : "brand.500",
                                    boxShadow: "none"
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
                                Potrdi geslo
                            </FormLabel>
                            <Input
                                type="password"
                                name="confirmPassword"
                                value={form.confirmPassword}
                                onChange={onChange}
                                maxLength={INPUT_LIMITS.PASSWORD_MAX}
                                placeholder="••••••••"
                                size="lg"
                                variant="flushed"
                                borderBottomWidth="2px"
                                borderColor={form.confirmPassword && !valid.confirmPassword ? "red.400" : "gray.300"}
                                _hover={{
                                    borderColor: form.confirmPassword && !valid.confirmPassword ? "red.400" : "gray.400"
                                }}
                                _focus={{
                                    borderColor: form.confirmPassword && !valid.confirmPassword ? "red.500" : "brand.500",
                                    boxShadow: "none"
                                }}
                                fontSize="md"
                                py={3}
                                bg="transparent"
                                transition="all 0.2s"
                            />
                            {form.confirmPassword && !valid.confirmPassword && (
                                <Text fontSize="xs" color="red.500" mt={1}>
                                    Gesli se morata ujemati
                                </Text>
                            )}
                        </FormControl>

                        <Button
                            type="submit"
                            isDisabled={!allValid}
                            isLoading={loading}
                            w="full"
                            h="54px"
                            bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
                            color="white"
                            fontSize="md"
                            fontWeight="600"
                            _hover={{
                                bgGradient: "linear(135deg, #D94B8C 0%, #EC5F8C 100%)",
                                transform: "translateY(-2px)",
                                boxShadow: "0 8px 24px rgba(236, 95, 140, 0.25)"
                            }}
                            _active={{
                                transform: "translateY(0)"
                            }}
                            transition="all 0.2s"
                            mt={2}
                        >
                            Ponastavi geslo
                        </Button>
                    </VStack>

                    <HStack spacing={4} w="full" justify="center">
                        <Link
                            href="/prijava"
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
                    </HStack>
                </VStack>
            </Container>
            <Footer variant="forum" />
        </Box>
    );
};

export default ResetPassword;