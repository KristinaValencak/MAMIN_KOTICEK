import React from "react";
import { Box, Container, Heading, Text, VStack, Divider, List, ListItem } from "@chakra-ui/react";
import Footer from "../Footer/Footer";

const CookiesPolicy = () => {
    return (
        <Box minH="100vh" bg="gray.50">
            <Container maxW="container.lg" py={{ base: 10, md: 14 }} px={{ base: 4, md: 6 }}>
                <VStack align="stretch" spacing={8}>
                    <VStack align="stretch" spacing={2}>
                        <Heading
                            as="h1"
                            fontSize={{ base: "xl", md: "2xl" }}
                            fontWeight="700"
                            color="gray.800"
                            letterSpacing="-0.02em"
                        >
                            🍪 Politika piškotkov – Mamin kotiček
                        </Heading>
                        <Text fontSize="sm" color="gray.500">
                            Datum veljavnosti: 15. april 2026
                        </Text>
                    </VStack>

                    <Divider borderColor="gray.200" />

                    <Box
                        bg="white"
                        rounded="2px"
                        p={{ base: 5, md: 6 }}
                        border="1px solid"
                        borderColor="gray.200"
                        borderLeft="3px solid"
                        borderLeftColor="#EC5F8C"
                        boxShadow="0 1px 3px rgba(0,0,0,0.06)"
                    >
                        <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                            Ta politika piškotkov pojasnjuje, kako spletna platforma Mamin kotiček uporablja piškotke in podobne tehnologije.
                        </Text>
                    </Box>

                    <VStack align="stretch" spacing={5}>
                        <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
                            <VStack align="stretch" spacing={3}>
                                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                                    1. Kaj so piškotki?
                                </Heading>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Piškotki so majhne besedilne datoteke, ki jih spletna stran shrani v vaš brskalnik ob obisku.
                                </Text>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Uporabljajo se za:
                                </Text>
                                <List spacing={2}>
                                    {["delovanje osnovnih funkcionalnosti,", "zagotavljanje varne uporabe,", "ohranjanje uporabniške seje."].map((item) => (
                                        <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                                            <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                                            {item}
                                        </ListItem>
                                    ))}
                                </List>
                            </VStack>
                        </Box>

                        <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
                            <VStack align="stretch" spacing={3}>
                                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                                    2. Katere piškotke uporabljamo
                                </Heading>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Platforma uporablja izključno nujne (obvezne) piškotke, ki so potrebni za delovanje storitve.
                                </Text>

                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    2.1 Avtentikacijski piškotek
                                </Text>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Ime: token
                                </Text>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Namen: prijava uporabnika in upravljanje seje
                                </Text>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Vrsta: nujni (essential), sejni piškotek
                                </Text>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Trajanje: 24 ur ali do odjave
                                </Text>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Dostop: HttpOnly (ni dostopen JavaScript kodi)
                                </Text>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Varnost: uporablja se za varno avtentikacijo (JWT)
                                </Text>

                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Ta piškotek omogoča:
                                </Text>
                                <List spacing={2}>
                                    {[
                                        "prijavo uporabnika,",
                                        "dostop do zaščitenih funkcij (objave, komentarji, sporočila, marketplace),",
                                        "varno komunikacijo s strežnikom.",
                                    ].map((item) => (
                                        <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                                            <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                                            {item}
                                        </ListItem>
                                    ))}
                                </List>

                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Brez tega piškotka platforma ne deluje pravilno.
                                </Text>
                            </VStack>
                        </Box>

                        <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
                            <VStack align="stretch" spacing={3}>
                                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                                    3. Uporaba drugih tehnologij shranjevanja
                                </Heading>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Platforma lahko za tehnične namene uporablja tudi:
                                </Text>
                                <List spacing={2}>
                                    {["sessionStorage (npr. za upravljanje začasnih stanj, kot je omejeno gostovsko brskanje)."].map((item) => (
                                        <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                                            <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                                            {item}
                                        </ListItem>
                                    ))}
                                </List>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Ti podatki:
                                </Text>
                                <List spacing={2}>
                                    {[
                                        "niso uporabljeni za sledenje,",
                                        "se ne uporabljajo za oglaševanje,",
                                        "ostanejo lokalno v brskalniku uporabnika.",
                                    ].map((item) => (
                                        <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                                            <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                                            {item}
                                        </ListItem>
                                    ))}
                                </List>
                            </VStack>
                        </Box>

                        <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
                            <VStack align="stretch" spacing={3}>
                                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                                    4. Ali uporabljamo piškotke za sledenje ali analitiko?
                                </Heading>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Ne.
                                </Text>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Platforma ne uporablja:
                                </Text>
                                <List spacing={2}>
                                    {[
                                        "analitičnih orodij (npr. Google Analytics),",
                                        "oglaševalskih piškotkov,",
                                        "sledilnih tehnologij tretjih oseb.",
                                    ].map((item) => (
                                        <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                                            <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                                            {item}
                                        </ListItem>
                                    ))}
                                </List>
                            </VStack>
                        </Box>

                        <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
                            <VStack align="stretch" spacing={3}>
                                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                                    5. Pravna podlaga
                                </Heading>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Ker uporabljamo samo nujne piškotke, je pravna podlaga:
                                </Text>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    zakoniti interes (zagotavljanje delovanja in varnosti platforme).
                                </Text>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Za uporabo teh piškotkov ni potrebno soglasje uporabnika, saj brez njih storitev ne deluje.
                                </Text>
                            </VStack>
                        </Box>

                        <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
                            <VStack align="stretch" spacing={3}>
                                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                                    6. Upravljanje piškotkov
                                </Heading>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Uporabnik lahko piškotke upravlja v svojem brskalniku:
                                </Text>
                                <List spacing={2}>
                                    {["jih izbriše,", "jih blokira."].map((item) => (
                                        <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                                            <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                                            {item}
                                        </ListItem>
                                    ))}
                                </List>

                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    ⚠️ Pomembno:
                                </Text>
                                <List spacing={2}>
                                    {[
                                        "brez piškotkov prijava ne bo delovala,",
                                        "določene funkcije (forum, sporočila, profil) ne bodo dostopne.",
                                    ].map((item) => (
                                        <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                                            <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                                            {item}
                                        </ListItem>
                                    ))}
                                </List>
                            </VStack>
                        </Box>

                        <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
                            <VStack align="stretch" spacing={3}>
                                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                                    7. Varnost
                                </Heading>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Uporabljeni piškotki:
                                </Text>
                                <List spacing={2}>
                                    {[
                                        "ne vsebujejo neposredno berljivih osebnih podatkov,",
                                        "so zaščiteni z varnostnimi mehanizmi (npr. HttpOnly),",
                                        "se uporabljajo izključno za tehnično delovanje sistema.",
                                    ].map((item) => (
                                        <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                                            <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                                            {item}
                                        </ListItem>
                                    ))}
                                </List>
                            </VStack>
                        </Box>

                        <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
                            <VStack align="stretch" spacing={3}>
                                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                                    8. Povezava s Politiko zasebnosti
                                </Heading>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Za več informacij o obdelavi osebnih podatkov glejte Politiko zasebnosti, kjer je podrobno opisano:
                                </Text>
                                <List spacing={2}>
                                    {["katere podatke zbiramo,", "kako jih uporabljamo,", "kako jih varujemo."].map((item) => (
                                        <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                                            <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                                            {item}
                                        </ListItem>
                                    ))}
                                </List>
                            </VStack>
                        </Box>

                        <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
                            <VStack align="stretch" spacing={3}>
                                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                                    9. Spremembe politike
                                </Heading>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Politiko lahko kadarkoli posodobimo.
                                </Text>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Spremembe začnejo veljati z objavo na tej strani.
                                </Text>
                            </VStack>
                        </Box>

                        <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
                            <VStack align="stretch" spacing={3}>
                                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                                    10. Kontakt
                                </Heading>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Za vprašanja glede piškotkov:
                                </Text>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    📧 info.maminkoticek@gmail.com
                                </Text>
                            </VStack>
                        </Box>

                        <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
                            <VStack align="stretch" spacing={3}>
                                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                                    11. Strinjanje
                                </Heading>
                                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                                    Z uporabo platforme potrjujete, da ste seznanjeni z uporabo nujnih piškotkov.
                                </Text>
                            </VStack>
                        </Box>
                    </VStack>
                </VStack>
            </Container>
            <Footer variant="forum" />
        </Box>
    );
};

export default CookiesPolicy;