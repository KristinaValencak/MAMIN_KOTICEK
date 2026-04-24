import React from "react";
import { Box, Container, Heading, Text, VStack, Divider, List, ListItem } from "@chakra-ui/react";
import Footer from "../Footer/Footer";

const PrivacyPolicy = () => {
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
              Politika zasebnosti – Mamin kotiček
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
              Ta politika zasebnosti pojasnjuje, kako platforma Mamin kotiček zbira, uporablja, hrani in varuje osebne podatke v skladu z Splošno uredbo o varstvu podatkov (GDPR) in veljavno zakonodajo Republike Slovenije.
            </Text>
          </Box>

          <VStack align="stretch" spacing={5}>
            <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
              <VStack align="stretch" spacing={3}>
                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                  1. Upravljavec osebnih podatkov
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Upravljavec osebnih podatkov je: Kristina Valenčak
                </Text>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Naziv: Mamin kotiček
                </Text>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  E-pošta: info.maminkoticek@gmail.com
                </Text>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Za vsa vprašanja glede obdelave osebnih podatkov se lahko obrnete na zgornji kontakt.
                </Text>
              </VStack>
            </Box>

            <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
              <VStack align="stretch" spacing={3}>
                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                  2. Katere osebne podatke zbiramo
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Glede na uporabo platforme lahko zbiramo naslednje podatke:
                </Text>

                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  2.1 Podatki ob registraciji in računu
                </Text>
                <List spacing={2}>
                  {[
                    "uporabniško ime,",
                    "e-poštni naslov,",
                    "geslo (shranjeno izključno v varni, zgoščeni/hashed obliki),",
                    "status verifikacije e-pošte.",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>

                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  2.2 Podatki o uporabi
                </Text>
                <List spacing={2}>
                  {[
                    "IP naslov,",
                    "datum in čas prijav,",
                    "podatki o seji (npr. prijava prek varnega piškotka),",
                    "osnovni tehnični podatki (npr. brskalnik, naprava – kjer je relevantno za varnost).",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>

                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  2.3 Uporabniška vsebina
                </Text>
                <List spacing={2}>
                  {[
                    "objave, komentarji, odgovori,",
                    "zasebna sporočila,",
                    "oglasi v marketplace-u,",
                    "profilni podatki (npr. bio, avatar).",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>

                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  2.4 Podatki o interakcijah
                </Text>
                <List spacing={2}>
                  {[
                    "všečki in podporne reakcije,",
                    "prijateljstva in zahteve,",
                    "blokade uporabnikov,",
                    "prijave vsebine (reports) in pritožbe (appeals).",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>

                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  2.5 Posebne vrste podatkov
                </Text>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Platforma namenoma ne zbira posebnih vrst osebnih podatkov (npr. zdravstveni podatki), razen če jih uporabnik sam prostovoljno objavi.
                </Text>
              </VStack>
            </Box>

            <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
              <VStack align="stretch" spacing={3}>
                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                  3. Namen obdelave podatkov
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Vaše podatke obdelujemo za:
                </Text>
                <List spacing={2}>
                  {[
                    "ustvarjanje in upravljanje uporabniškega računa,",
                    "omogočanje komunikacije (komentarji, sporočila),",
                    "delovanje foruma in vseh funkcionalnosti (prijateljstva, marketplace itd.),",
                    "zagotavljanje varnosti (preprečevanje zlorab, spam, neprimerna vsebina),",
                    "moderacijo vsebine,",
                    "obveščanje o pomembnih dogodkih ali spremembah,",
                    "izboljšanje delovanja platforme.",
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
                  4. Pravna podlaga za obdelavo
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Obdelava temelji na:
                </Text>
                <List spacing={2}>
                  {["izvajanju pogodbe (uporaba platforme),", "soglasju (npr. ob registraciji),", "zakonitem interesu, zlasti za:"].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <List spacing={2}>
                  {["varnost sistema,", "preprečevanje zlorab,", "zaščito uporabnikov."].map((item) => (
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
                  5. Avtentikacija in piškotki
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Za prijavo uporabljamo:
                </Text>
                <List spacing={2}>
                  {[
                    "varne piškotke (httpOnly) za avtentikacijo (JWT),",
                    "piškotki se uporabljajo izključno za delovanje sistema.",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Ti piškotki:
                </Text>
                <List spacing={2}>
                  {[
                    "ne omogočajo neposrednega sledenja brez konteksta prijave,",
                    "so nujni za delovanje platforme.",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Podrobnosti bodo dodatno opredeljene v Politiki piškotkov.
                </Text>
              </VStack>
            </Box>

            <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
              <VStack align="stretch" spacing={3}>
                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                  6. Hramba podatkov
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Podatke hranimo:
                </Text>
                <List spacing={2}>
                  {["dokler imate aktiven uporabniški račun,", "ali dokler je to potrebno za namen obdelave."].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Po izbrisu računa:
                </Text>
                <List spacing={2}>
                  {[
                    "se osebni podatki izbrišejo ali anonimizirajo,",
                    "vsebine (npr. objave) lahko ostanejo v anonimizirani obliki (brez identifikacije uporabnika).",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Podatke lahko hranimo dlje, če to zahteva zakon ali zaradi reševanja sporov.
                </Text>
              </VStack>
            </Box>

            <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
              <VStack align="stretch" spacing={3}>
                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                  7. Posredovanje podatkov tretjim osebam
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Vaših osebnih podatkov:
                </Text>
                <List spacing={2}>
                  {["ne prodajamo,", "ne delimo za marketinške namene."].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Lahko pa jih delimo z:
                </Text>
                <List spacing={2}>
                  {[
                    "ponudniki infrastrukture (npr. strežniki, e-poštne storitve),",
                    "ponudniki tehničnih storitev (npr. gostovanje slik),",
                    "pristojnimi organi, če to zahteva zakon.",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Vsi partnerji so dolžni zagotavljati ustrezno varstvo podatkov.
                </Text>
              </VStack>
            </Box>

            <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
              <VStack align="stretch" spacing={3}>
                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                  8. Varnost podatkov
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Uporabljamo ustrezne tehnične in organizacijske ukrepe:
                </Text>
                <List spacing={2}>
                  {[
                    "šifriranje gesel (hashiranje),",
                    "varna komunikacija (HTTPS),",
                    "zaščita API-jev (npr. rate limiting),",
                    "sistemi za preprečevanje zlorab (anti-spam, filtri),",
                    "omejen dostop do podatkov,",
                    "redne varnostne posodobitve.",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Kljub temu noben sistem ni 100 % varen.
                </Text>
              </VStack>
            </Box>

            <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
              <VStack align="stretch" spacing={3}>
                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                  9. Zasebna komunikacija
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Zasebna sporočila:
                </Text>
                <List spacing={2}>
                  {[
                    "so dostopna samo udeleženim uporabnikom,",
                    "se uporabljajo izključno za komunikacijo med uporabniki.",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Platforma lahko:
                </Text>
                <List spacing={2}>
                  {["omeji komunikacijo ob kršitvah,", "obravnava zlorabe (npr. prijave)."].map((item) => (
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
                  10. Pravice uporabnikov
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Uporabniki imajo pravico do:
                </Text>
                <List spacing={2}>
                  {[
                    "dostopa do svojih podatkov,",
                    "popravka netočnih podatkov,",
                    'izbrisa ("pravica do pozabe"),',
                    "omejitve obdelave,",
                    "prenosljivosti podatkov,",
                    "ugovora obdelavi,",
                    "preklica soglasja.",
                  ].map((item) => (
                    <ListItem key={item} fontSize="sm" color="gray.600" lineHeight="1.7" display="flex" alignItems="flex-start" gap={2}>
                      <Box as="span" mt={1.5} w="4px" h="4px" rounded="full" bg="#EC5F8C" flexShrink={0} />
                      {item}
                    </ListItem>
                  ))}
                </List>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Zahteve pošljite na:
                </Text>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  info.maminkoticek@gmail.com
                </Text>
              </VStack>
            </Box>

            <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
              <VStack align="stretch" spacing={3}>
                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                  11. Kršitve varnosti podatkov
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  V primeru kršitve varnosti:
                </Text>
                <List spacing={2}>
                  {[
                    "bomo ukrepali v skladu z GDPR,",
                    "po potrebi obvestili pristojni organ,",
                    "in prizadete uporabnike.",
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
                  12. Otroci
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Platforma ni namenjena otrokom brez nadzora.
                </Text>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Če ugotovimo, da so bili podatki zbrani brez ustrezne pravne podlage, jih bomo izbrisali.
                </Text>
              </VStack>
            </Box>

            <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
              <VStack align="stretch" spacing={3}>
                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                  13. Spremembe politike
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Politiko lahko kadarkoli posodobimo.
                </Text>
                <List spacing={2}>
                  {["Spremembe začnejo veljati z objavo.", "Priporočamo redno spremljanje."].map((item) => (
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
                  14. Kontakt
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Za vprašanja ali uveljavljanje pravic:
                </Text>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  📧 info.maminkoticek@gmail.com
                </Text>
              </VStack>
            </Box>

            <Box bg="white" rounded="2px" p={{ base: 5, md: 6 }} border="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="#EC5F8C" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
              <VStack align="stretch" spacing={3}>
                <Heading as="h2" size="sm" fontWeight="700" color="gray.800">
                  15. Strinjanje
                </Heading>
                <Text fontSize="sm" color="gray.600" lineHeight="1.7">
                  Z uporabo platforme potrjujete, da ste seznanjeni s to politiko zasebnosti in se z njo strinjate.
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

export default PrivacyPolicy;
