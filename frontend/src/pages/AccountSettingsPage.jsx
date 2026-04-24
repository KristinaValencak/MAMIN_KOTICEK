import { useState, useMemo, useEffect } from "react";
import {Box, Button, Container, Grid, GridItem, Heading, IconButton, Menu, MenuButton, MenuItem, MenuList, Skeleton, Text, VStack } from "@chakra-ui/react";
import { ChevronDownIcon } from "@chakra-ui/icons";
import { useSearchParams } from "react-router-dom";
import { useMeAccount } from "../hooks/useMeAccount";
import SettingsAccountAndPrivacy from "../components/Settings/SettingsAccountAndPrivacy";
import SettingsBlockedUsers from "../components/Settings/SettingsBlockedUsers";
import SettingsFavoritePosts from "../components/Settings/SettingsFavoritePosts";
import SettingsAnonymousPosts from "../components/Settings/SettingsAnonymousPosts";
import SettingsHiddenContent from "../components/Settings/SettingsHiddenContent";
import SettingsHelp from "../components/Settings/SettingsHelp";
import SettingsPushNotifications from "../components/Settings/SettingsPushNotifications";

const surface = {
  bg: "white",
  border: "1px solid",
  borderColor: "gray.100",
  rounded: "2xl",
  boxShadow: "0 4px 24px rgba(15, 23, 42, 0.06)",
};

const NAV = [
  { id: "account", label: "Račun in zasebnost" },
  { id: "blocked", label: "Blokirani uporabniki" },
  { id: "notifications", label: "Nastavitve obveščanja" },
  { id: "favorites", label: "Priljubljene objave" },
  { id: "anonymous", label: "Anonimne objave" },
  { id: "community", label: "Vsebina in pravila skupnosti" },
  { id: "help", label: "Pomoč in podpora" },
];

const SECTION_IDS = new Set(NAV.map((n) => n.id));

export default function AccountSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionFromUrl = searchParams.get("section");
  const normalizedSectionFromUrl = sectionFromUrl === "hidden_listings" ? "community" : sectionFromUrl;
  const initialSection =
    normalizedSectionFromUrl && SECTION_IDS.has(normalizedSectionFromUrl) ? normalizedSectionFromUrl : "account";
  const [section, setSection] = useState(initialSection);

  useEffect(() => {
    const raw = searchParams.get("section");
    const normalized = raw === "hidden_listings" ? "community" : raw;
    const next = normalized && SECTION_IDS.has(normalized) ? normalized : "account";
    setSection((prev) => (prev === next ? prev : next));
  }, [searchParams]);

  const setSectionAndUrl = (id) => {
    setSection(id);
    setSearchParams(id === "account" ? {} : { section: id }, { replace: true });
  };
  const {
    user,
    loading,
    saving,
    formData,
    setFormData,
    editingField,
    setEditingField,
    handleSaveField,
    updatePrivacyToggle,
    handleDeleteAccount,
  } = useMeAccount();

  const sectionLabel = useMemo(
    () => NAV.find((n) => n.id === section)?.label ?? "Nastavitve",
    [section]
  );

  const mainContent = useMemo(() => {
    if (loading || !user) return null;
    switch (section) {
      case "account":
        return (
          <SettingsAccountAndPrivacy
            user={user}
            formData={formData}
            setFormData={setFormData}
            editingField={editingField}
            setEditingField={setEditingField}
            saving={saving}
            handleSaveField={handleSaveField}
            updatePrivacyToggle={updatePrivacyToggle}
            handleDeleteAccount={handleDeleteAccount}
          />
        );
      case "blocked":
        return <SettingsBlockedUsers />;
      case "notifications":
        return <SettingsPushNotifications />;
      case "favorites":
        return <SettingsFavoritePosts />;
      case "anonymous":
        return <SettingsAnonymousPosts />;
      case "community":
        return <SettingsHiddenContent />;
      case "help":
        return <SettingsHelp />;
      default:
        return null;
    }
  }, [
    section,
    loading,
    user,
    formData,
    setFormData,
    editingField,
    setEditingField,
    saving,
    handleSaveField,
    updatePrivacyToggle,
    handleDeleteAccount,
  ]);

  return (
    <Box flex="1" display="flex" flexDirection="column" minH={0} w="100%" maxW="100%" alignSelf="stretch" bg="gray.50">
      <Box flex="1" display="flex" flexDirection="column" minH={0} w="100%" maxW="100%">
        <Container
          maxW="7xl"
          mx="auto"
          w="100%"
          pt={{ base: 8, md: 12 }}
          pb={{ base: 3, md: 8 }}
          px={{ base: 4, md: 8 }}
          flex="1"
        >
          <Heading
            size="lg"
            mb={1}
            bgGradient="linear(135deg, #D94B8C 0%, #EC5F8C 50%, #F48FB1 100%)"
            bgClip="text"
            fontWeight="800"
          >
            Nastavitve
          </Heading>

          <Box display={{ base: "block", lg: "none" }} w="100%" maxW="100%" mb={5}>
            <Menu placement="bottom-start" strategy="fixed" gutter={6}>
              <MenuButton
                as={Button}
                w="100%"
                justifyContent="space-between"
                rightIcon={<ChevronDownIcon />}
                rounded="xl"
                h="52px"
                px={4}
                fontWeight="600"
                fontSize="sm"
                color="gray.800"
                bg="white"
                borderWidth="1px"
                borderColor="gray.200"
                boxShadow="0 2px 8px rgba(15, 23, 42, 0.06)"
                _hover={{ bg: "gray.50", borderColor: "gray.300" }}
                _active={{ bg: "gray.50" }}
                textAlign="left"
                whiteSpace="normal"
                lineHeight="1.3"
              >
                {sectionLabel}
              </MenuButton>
              <MenuList
                zIndex={2000}
                rounded="xl"
                py={2}
                px={1}
                minW="100%"
                borderColor="gray.100"
                boxShadow="0 16px 48px rgba(15, 23, 42, 0.12)"
                maxH="min(70vh, 420px)"
                overflowY="auto"
              >
                {NAV.map((item) => {
                  const active = section === item.id;
                  return (
                    <MenuItem
                      key={item.id}
                      onClick={() => setSectionAndUrl(item.id)}
                      rounded="lg"
                      py={3}
                      px={3}
                      mx={1}
                      mb={0.5}
                      fontWeight={active ? "700" : "500"}
                      color={active ? "pink.600" : "gray.700"}
                      bg={active ? "pink.50" : "transparent"}
                      _hover={{ bg: active ? "pink.50" : "gray.50" }}
                      _focus={{ bg: active ? "pink.50" : "gray.50" }}
                    >
                      {item.label}
                    </MenuItem>
                  );
                })}
              </MenuList>
            </Menu>
          </Box>

          <Grid templateColumns={{ base: "1fr", lg: "260px 1fr" }} gap={{ base: 4, lg: 10 }} alignItems="start">
            <GridItem display={{ base: "none", lg: "block" }}>
              <Box {...surface} p={2}>
                <VStack align="stretch" spacing={1}>
                  {NAV.map((item) => {
                    const active = section === item.id;
                    return (
                      <Button
                        key={item.id}
                        variant="ghost"
                        justifyContent="flex-start"
                        fontWeight={active ? "700" : "500"}
                        color={active ? "brand.600" : "gray.700"}
                        bg={active ? "pink.50" : "transparent"}
                        borderLeftWidth="3px"
                        borderLeftColor={active ? "pink.500" : "transparent"}
                        rounded="lg"
                        pl={3}
                        py={6}
                        h="auto"
                        whiteSpace="normal"
                        textAlign="left"
                        onClick={() => setSectionAndUrl(item.id)}
                        aria-current={active ? "page" : undefined}
                      >
                        {item.label}
                      </Button>
                    );
                  })}
                </VStack>
              </Box>
            </GridItem>

            <GridItem minW={0}>
              <Box {...surface} p={{ base: 5, md: 8 }}>
                {loading ? (
                  <VStack spacing={4} align="stretch">
                    <Skeleton height="28px" width="60%" borderRadius="md" />
                    <Skeleton height="120px" borderRadius="xl" />
                    <Skeleton height="120px" borderRadius="xl" />
                  </VStack>
                ) : (
                  mainContent
                )}
              </Box>
            </GridItem>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
}
