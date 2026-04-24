import React from "react";
import {Box, Container, Heading, Text, VStack, Divider, List, ListItem } from "@chakra-ui/react";
import Footer from "../Footer/Footer";

const TermsOfService = () => {
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
              Pogoji uporabe – Mamin kotiček
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
              Dobrodošli na forumu Mamin kotiček. Z uporabo platforme (vključno s forumom, zasebnimi sporočili, tržnico in drugimi funkcionalnostmi) se strinjate s temi pogoji uporabe. Če se s pogoji ne strinjate, prosimo, da platforme ne uporabljate.
            </Text>
          </Box>

          <VStack align="stretch" spacing={5}>
            <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
              <VStack align="stretch" spacing={3}>
                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                  1. Splošno
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Mamin kotiček je spletna platforma, namenjena:
                </Text>
                <List spacing={2}>
                  {[
                    "izmenjavi izkušenj in informacij,",
                    "druženju uporabnic,",
                    "objavi vsebin (objave, komentarji),",
                    "zasebni komunikaciji,",
                    "uporabi dodatnih funkcij (tržnica, kvizi, lestvice itd.).",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Uporabnik se zavezuje, da bo:
                </Text>
                <List spacing={2}>
                  {[
                    "spoštoval veljavno zakonodajo,",
                    "ravnal spoštljivo do drugih,",
                    "uporabljal platformo v skladu z njenim namenom.",
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
                  2. Registracija in račun
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Za uporabo določenih funkcij je potrebna registracija.
                </Text>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Uporabnik se strinja, da:
                </Text>
                <List spacing={2}>
                  {[
                    "navede resnične in točne podatke,",
                    "ne deli svojega računa z drugimi,",
                    "varuje svoje prijavne podatke.",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Platforma:
                </Text>
                <List spacing={2}>
                  {[
                    "uporablja avtentikacijo prek varnih piškotkov (JWT),",
                    "lahko omeji ali onemogoči račun ob kršitvah,",
                    "lahko zahteva verifikacijo e-pošte.",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Uporabnik je odgovoren za vse aktivnosti, izvedene prek njegovega računa.
                </Text>
              </VStack>
            </Box>

            <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
              <VStack align="stretch" spacing={3}>
                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                  3. Dostop brez prijave (gost)
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Platforma omogoča omejen dostop brez registracije.
                </Text>
                <List spacing={2}>
                  {[
                    "Brskanje je časovno omejeno.",
                    "Po določenem času je potrebna prijava za nadaljnjo uporabo.",
                    "Nekatere funkcije (objave, komentarji, sporočila, marketplace) niso dostopne brez računa.",
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
                  4. Uporaba platforme
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Prepovedano je objavljanje ali izvajanje:
                </Text>
                <List spacing={2}>
                  {[
                    "sovražnega, žaljivega ali nasilnega govora,",
                    "diskriminacije,",
                    "spam ali oglaševanja brez dovoljenja,",
                    "zavajajočih ali lažnih informacij,",
                    "vsebin, ki kršijo avtorske pravice,",
                    "razkrivanja osebnih podatkov drugih brez soglasja,",
                    "zlorabe sistema (npr. spam, flood, tehnični napadi).",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Platforma uporablja:
                </Text>
                <List spacing={2}>
                  {[
                    "samodejne filtre (profanity, anti-spam),",
                    "omejitve pošiljanja (rate limiting),",
                    "moderacijo vsebine.",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Kršitve lahko vodijo do:
                </Text>
                <List spacing={2}>
                  {[
                    "odstranitve vsebine,",
                    "začasne omejitve,",
                    "trajne prepovedi uporabe.",
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
                  5. Uporabniška vsebina
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Uporabnik obdrži lastništvo nad svojo vsebino, vendar z objavo platformi podeli:
                </Text>
                <List spacing={2}>
                  {["neizključno,", "brezplačno,", "časovno neomejeno"].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  pravico do:
                </Text>
                <List spacing={2}>
                  {["prikaza,", "distribucije,", "prilagoditve za delovanje platforme."].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Platforma lahko vsebine:
                </Text>
                <List spacing={2}>
                  {[
                    "moderira,",
                    "odstrani,",
                    "skrije (npr. ob prijavah ali kršitvah).",
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
                  6. Moderacija in prijave
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Uporabniki lahko prijavijo:
                </Text>
                <List spacing={2}>
                  {["objave,", "komentarje,", "profile,", "oglase."].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Platforma:
                </Text>
                <List spacing={2}>
                  {[
                    "pregleda prijave,",
                    "lahko vsebino skrije ali odstrani,",
                    "omogoča pritožbe na moderacijske odločitve.",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Odločitve moderacije so dokončne, razen če je omogočen postopek pritožbe.
                </Text>
              </VStack>
            </Box>

            <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
              <VStack align="stretch" spacing={3}>
                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                  7. Zasebna sporočila
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Platforma omogoča zasebno komunikacijo med uporabniki.
                </Text>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Pomembno:
                </Text>
                <List spacing={2}>
                  {[
                    "sporočila niso javna,",
                    "vendar platforma lahko omeji komunikacijo (npr. ob blokadi ali zlorabi),",
                    "uporabniki lahko zavrnejo ali blokirajo komunikacijo,",
                    "spam ali zloraba sporočil je prepovedana.",
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
                  8. Prijateljstva in blokiranje
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Uporabniki lahko:
                </Text>
                <List spacing={2}>
                  {[
                    "pošiljajo prošnje za prijateljstvo,",
                    "sprejemajo ali zavračajo prošnje,",
                    "blokirajo druge uporabnike.",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Ob blokadi:
                </Text>
                <List spacing={2}>
                  {[
                    "komunikacija ni več mogoča,",
                    "vsebine blokiranega uporabnika niso vidne,",
                    "interakcije so omejene.",
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
                  9. Marketplace (tržnica)
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Uporabniki lahko objavljajo oglase.
                </Text>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Uporabnik je odgovoren za:
                </Text>
                <List spacing={2}>
                  {["točnost podatkov,", "zakonitost prodaje,", "komunikacijo z drugimi uporabniki."].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Platforma:
                </Text>
                <List spacing={2}>
                  {[
                    "ne sodeluje v transakcijah,",
                    "ne jamči za kakovost ali varnost,",
                    "ne odgovarja za škodo ali spore med uporabniki.",
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
                  10. Obvestila
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Platforma lahko pošilja:
                </Text>
                <List spacing={2}>
                  {["obvestila o aktivnosti (v aplikaciji),", "sistemska obvestila."].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Uporabnik se strinja s prejemanjem teh obvestil v okviru uporabe platforme.
                </Text>
              </VStack>
            </Box>

            <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
              <VStack align="stretch" spacing={3}>
                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                  11. Zasebnost in podatki
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Platforma obdeluje osebne podatke v skladu s Politiko zasebnosti.
                </Text>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Z uporabo platforme soglašate z:
                </Text>
                <List spacing={2}>
                  {["zbiranjem,", "obdelavo,", "shranjevanjem podatkov."].map((item) => (
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
                  12. Omejitev odgovornosti
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Platforma ne odgovarja za:
                </Text>
                <List spacing={2}>
                  {[
                    "vsebine uporabnikov,",
                    "točnost informacij,",
                    "škodo zaradi uporabe platforme,",
                    "interakcije med uporabniki.",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Uporaba platforme je na lastno odgovornost.
                </Text>
              </VStack>
            </Box>

            <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
              <VStack align="stretch" spacing={3}>
                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                  13. Razpoložljivost storitve
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Platforma:
                </Text>
                <List spacing={2}>
                  {[
                    "si prizadeva za nemoteno delovanje,",
                    "ne zagotavlja stalne dostopnosti,",
                    "lahko začasno prekine delovanje zaradi vzdrževanja ali napak.",
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
                  14. Spremembe pogojev
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Platforma si pridržuje pravico do spremembe pogojev kadarkoli.
                </Text>
                <List spacing={2}>
                  {[
                    "Spremembe začnejo veljati z objavo.",
                    "Nadaljnja uporaba pomeni strinjanje s spremembami.",
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
                  15. Prenehanje uporabe
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Platforma lahko:
                </Text>
                <List spacing={2}>
                  {["začasno ali trajno onemogoči račun,", "odstrani vsebino,", "omeji dostop,"].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  če uporabnik krši pogoje.
                </Text>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Uporabnik lahko kadarkoli izbriše svoj račun.
                </Text>
              </VStack>
            </Box>

            <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
              <VStack align="stretch" spacing={3}>
                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                  16. Veljavna zakonodaja
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Za te pogoje velja zakonodaja Republike Slovenije.
                </Text>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  V primeru spora:
                </Text>
                <List spacing={2}>
                  {[
                    "se stranke najprej poskušajo sporazumno dogovoriti,",
                    "sicer je pristojno sodišče v Sloveniji.",
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
                  17. Kontakt
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Za vprašanja nas kontaktirajte:
                </Text>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  info.maminkoticek@gmail.com
                </Text>
              </VStack>
            </Box>

            <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
              <VStack align="stretch" spacing={3}>
                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                  18. Strinjanje s pogoji
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Z registracijo ali uporabo platforme potrjujete, da ste prebrali in se strinjate s temi pogoji uporabe.
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

export default TermsOfService;
