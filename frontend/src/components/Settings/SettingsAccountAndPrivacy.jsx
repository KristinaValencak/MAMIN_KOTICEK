import { Box, Heading, Divider, VStack, HStack, Text, Input, Button, Textarea, Badge, Switch } from "@chakra-ui/react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { Link as RouterLink } from "react-router-dom";
import { FiUser, FiSettings, FiTrash2, FiEdit3, FiExternalLink } from "react-icons/fi";
import { INPUT_LIMITS } from "../../constants/inputLimits";
import { coerceIsProfilePrivate } from "../../utils/helpers";

const sectionTitleProps = {
  size: "md",
  mb: 4,
  color: "gray.800",
  fontWeight: "800",
  letterSpacing: "-0.02em",
};

export default function SettingsAccountAndPrivacy({
  user,
  formData,
  setFormData,
  editingField,
  setEditingField,
  saving,
  handleSaveField,
  updatePrivacyToggle,
  handleDeleteAccount,
}) {
  const { toast } = useAppToast();

  if (!user) return null;

  return (
    <Box>
      <Heading {...sectionTitleProps}>Račun in zasebnost</Heading>
      <Divider mb={6} />

      <VStack spacing={6} align="stretch">
        <Box>
          <HStack mb={3}>
            <FiUser />
            <Heading size="sm" color="gray.700">
              Osebni podatki
            </Heading>
          </HStack>
          <VStack spacing={3} align="stretch" pl={{ base: 0, md: 6 }}>
            <HStack
              justify="space-between"
              p={4}
              bg="white"
              rounded="xl"
              border="1px solid"
              borderColor="gray.100"
              boxShadow="sm"
              align="flex-start"
              flexDir={{ base: "column", sm: "row" }}
              gap={3}
            >
              <Box flex="1" w="full">
                <Text fontSize="sm" color="gray.600">
                  Uporabniško ime
                </Text>
                {editingField === "username" ? (
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    maxLength={INPUT_LIMITS.USERNAME_MAX}
                    size="sm"
                    mt={1}
                    focusBorderColor="brand.300"
                    autoFocus
                  />
                ) : (
                  <Text fontWeight="600" mt={1}>
                    {user.username}
                  </Text>
                )}
              </Box>
              {editingField === "username" ? (
                <HStack spacing={2} flexShrink={0}>
                  <Button
                    size="sm"
                    variant="ghost"
                    colorScheme="gray"
                    onClick={() => {
                      setFormData({ ...formData, username: user.username });
                      setEditingField(null);
                    }}
                  >
                    Prekliči
                  </Button>
                  <Button
                    size="sm"
                    bg="brand.500"
                    color="white"
                    _hover={{ bg: "brand.600" }}
                    onClick={async () => {
                      if (!formData.username.trim()) {
                        toast({ status: "error", title: "Uporabniško ime je obvezno" });
                        return;
                      }
                      await handleSaveField("username");
                    }}
                    isLoading={saving}
                  >
                    Shrani
                  </Button>
                </HStack>
              ) : (
                <Button
                  size="sm"
                  leftIcon={<FiEdit3 />}
                  variant="ghost"
                  colorScheme="brand"
                  onClick={() => setEditingField("username")}
                  alignSelf={{ base: "flex-start", sm: "center" }}
                >
                  Spremeni
                </Button>
              )}
            </HStack>

            <HStack
              justify="space-between"
              p={4}
              bg="white"
              rounded="xl"
              border="1px solid"
              borderColor="gray.100"
              boxShadow="sm"
              align="flex-start"
              flexDir={{ base: "column", sm: "row" }}
              gap={3}
            >
              <Box flex="1" w="full">
                <Text fontSize="sm" color="gray.600">
                  Email
                </Text>
                {editingField === "email" ? (
                  <Box>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      maxLength={INPUT_LIMITS.EMAIL}
                      size="sm"
                      mt={1}
                      focusBorderColor="brand.300"
                      autoFocus
                    />
                    {editingField === "email" && formData.email.trim().toLowerCase() !== user.email?.trim().toLowerCase() && (
                      <Text fontSize="xs" color="orange.600" mt={1} fontWeight="500">
                        Sprememba emaila zahteva ponovno verifikacijo. Po spremembi boste odjavljeni.
                      </Text>
                    )}
                  </Box>
                ) : (
                  <VStack align="start" spacing={1} mt={1}>
                    <Text fontWeight="600">{user.email}</Text>
                    {!user.email_verified && (
                      <HStack spacing={1}>
                        <Badge colorScheme="orange" fontSize="xs">
                          Neverificiran
                        </Badge>
                        <Text fontSize="xs" color="orange.600">
                          Preveri email za verifikacijsko povezavo
                        </Text>
                      </HStack>
                    )}
                  </VStack>
                )}
              </Box>
              {editingField === "email" ? (
                <HStack spacing={2} flexShrink={0}>
                  <Button
                    size="sm"
                    variant="ghost"
                    colorScheme="gray"
                    onClick={() => {
                      setFormData({ ...formData, email: user.email });
                      setEditingField(null);
                    }}
                  >
                    Prekliči
                  </Button>
                  <Button
                    size="sm"
                    bg="brand.500"
                    color="white"
                    _hover={{ bg: "brand.600" }}
                    onClick={async () => {
                      if (!formData.email.trim()) {
                        toast({ status: "error", title: "Email je obvezen" });
                        return;
                      }
                      await handleSaveField("email");
                    }}
                    isLoading={saving}
                  >
                    Shrani
                  </Button>
                </HStack>
              ) : (
                <Button
                  size="sm"
                  leftIcon={<FiEdit3 />}
                  variant="ghost"
                  colorScheme="brand"
                  onClick={() => setEditingField("email")}
                  alignSelf={{ base: "flex-start", sm: "center" }}
                >
                  Spremeni
                </Button>
              )}
            </HStack>

            <HStack
              justify="space-between"
              p={4}
              bg="white"
              rounded="xl"
              border="1px solid"
              borderColor="gray.100"
              boxShadow="sm"
              align="flex-start"
              flexDir={{ base: "column", sm: "row" }}
              gap={3}
            >
              <Box flex="1" w="full">
                <Text fontSize="sm" color="gray.600">
                  Geslo
                </Text>
                {editingField === "password" ? (
                  <VStack spacing={2} align="stretch" mt={1}>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      maxLength={INPUT_LIMITS.PASSWORD_MAX}
                      size="sm"
                      placeholder="Novo geslo (vsaj 8 znakov)"
                      focusBorderColor="brand.300"
                      autoFocus
                    />
                    {formData.password && (
                      <Input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        maxLength={INPUT_LIMITS.PASSWORD_MAX}
                        size="sm"
                        placeholder="Potrdi novo geslo"
                        focusBorderColor="brand.300"
                      />
                    )}
                  </VStack>
                ) : (
                  <Text fontWeight="600" mt={1} color="gray.400">
                    ••••••••
                  </Text>
                )}
              </Box>
              {editingField === "password" ? (
                <HStack spacing={2} flexShrink={0}>
                  <Button
                    size="sm"
                    variant="ghost"
                    colorScheme="gray"
                    onClick={() => {
                      setFormData({ ...formData, password: "", confirmPassword: "" });
                      setEditingField(null);
                    }}
                  >
                    Prekliči
                  </Button>
                  <Button
                    size="sm"
                    bg="brand.500"
                    color="white"
                    _hover={{ bg: "brand.600" }}
                    onClick={async () => {
                      if (formData.password && formData.password.length < 8) {
                        toast({ status: "error", title: "Geslo mora biti vsaj 8 znakov dolgo" });
                        return;
                      }
                      if (formData.password && formData.password !== formData.confirmPassword) {
                        toast({ status: "error", title: "Gesli se ne ujemata" });
                        return;
                      }
                      await handleSaveField("password");
                    }}
                    isLoading={saving}
                  >
                    Shrani
                  </Button>
                </HStack>
              ) : (
                <Button
                  size="sm"
                  leftIcon={<FiEdit3 />}
                  variant="ghost"
                  colorScheme="brand"
                  onClick={() => setEditingField("password")}
                  alignSelf={{ base: "flex-start", sm: "center" }}
                >
                  Spremeni
                </Button>
              )}
            </HStack>

            <HStack
              justify="space-between"
              align="flex-start"
              p={4}
              bg="white"
              rounded="xl"
              border="1px solid"
              borderColor="gray.100"
              boxShadow="sm"
              flexDir={{ base: "column", sm: "row" }}
              gap={3}
            >
              <Box flex="1" w="full">
                <Text fontSize="sm" color="gray.600">
                  BIO
                </Text>
                {editingField === "bio" ? (
                  <VStack spacing={2} align="stretch" mt={1}>
                    <Textarea
                      value={formData.bio || ""}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      placeholder="Napišite nekaj o sebi..."
                      rows={6}
                      size="sm"
                      focusBorderColor="brand.300"
                      resize="vertical"
                      maxLength={INPUT_LIMITS.BIO}
                    />
                    <Text fontSize="xs" color="gray.500" textAlign="right">
                      {(formData.bio || "").length}/{INPUT_LIMITS.BIO} znakov
                    </Text>
                  </VStack>
                ) : (
                  <Text
                    fontSize="sm"
                    color="gray.600"
                    mt={1}
                    whiteSpace="pre-wrap"
                    overflowWrap="anywhere"
                    wordBreak="break-word"
                    maxW="100%"
                    fontWeight={user?.bio ? "600" : "400"}
                  >
                    {user?.bio || (
                      <Text as="span" fontStyle="italic" color="gray.400" fontWeight="400">
                        Ni dodanega BIO-ja
                      </Text>
                    )}
                  </Text>
                )}
              </Box>
              {editingField === "bio" ? (
                <HStack spacing={2} flexShrink={0}>
                  <Button
                    size="sm"
                    variant="ghost"
                    colorScheme="gray"
                    onClick={() => {
                      setEditingField(null);
                      setFormData({
                        ...formData,
                        bio: user?.bio || "",
                      });
                    }}
                    isDisabled={saving}
                  >
                    Prekliči
                  </Button>
                  <Button
                    size="sm"
                    bg="brand.500"
                    color="white"
                    _hover={{ bg: "brand.600" }}
                    onClick={async () => {
                      await handleSaveField("bio");
                    }}
                    isLoading={saving}
                  >
                    Shrani
                  </Button>
                </HStack>
              ) : (
                <Button
                  size="sm"
                  leftIcon={<FiEdit3 />}
                  variant="ghost"
                  colorScheme="brand"
                  onClick={() => setEditingField("bio")}
                  alignSelf={{ base: "flex-start", sm: "center" }}
                >
                  Spremeni
                </Button>
              )}
            </HStack>
          </VStack>
        </Box>

        <Divider />

        <Box>
          <HStack mb={3}>
            <FiSettings />
            <Heading size="sm" color="gray.700">
              Dejanja
            </Heading>
          </HStack>
          <VStack spacing={2} align="stretch" pl={{ base: 0, md: 6 }}>
            <Button
              variant="outline"
              colorScheme="red"
              justifyContent="flex-start"
              leftIcon={<FiTrash2 />}
              onClick={handleDeleteAccount}
            >
              Izbriši račun
            </Button>
          </VStack>
        </Box>

        <Divider />

        <Box>
          <HStack mb={3} justify="space-between" align="center" flexWrap="wrap" gap={2}>
            <HStack>
              <FiSettings />
              <Heading size="sm" color="gray.700">
                Javni profil
              </Heading>
            </HStack>
            <Button
              as={RouterLink}
              to={`/user/${user.id}`}
              size="sm"
              variant="outline"
              colorScheme="pink"
              rounded="full"
              px={4}
              leftIcon={<FiExternalLink />}
            >
              Poglej javni profil
            </Button>
          </HStack>

          <VStack spacing={4} align="stretch" pl={{ base: 0, md: 6 }}>
            <HStack justify="space-between" p={4} bg="white" rounded="xl" border="1px solid" borderColor="gray.100" boxShadow="sm">
              <Box>
                <Text fontSize="sm" color="gray.700" fontWeight="600">
                  Zasebni profil
                </Text>
                <Text fontSize="xs" color="gray.500">
                  Ko je vklopljeno, javna stran profila za ne-prijateljice ni na voljo.
                </Text>
              </Box>
              <Switch
                colorScheme="pink"
                isChecked={coerceIsProfilePrivate(user.isProfilePrivate)}
                isDisabled={saving}
                onChange={(e) =>
                  e.target.checked
                    ? updatePrivacyToggle({
                        isProfilePrivate: true,
                        showListingsOnProfile: false,
                        showSupportOnProfile: false,
                        showPostsOnProfile: false,
                      })
                    : updatePrivacyToggle({
                        isProfilePrivate: false,
                        showListingsOnProfile: true,
                        showSupportOnProfile: true,
                        showPostsOnProfile: true,
                      })
                }
              />
            </HStack>

            <HStack justify="space-between" p={4} bg="white" rounded="xl" border="1px solid" borderColor="gray.100" boxShadow="sm">
              <Box>
                <Text fontSize="sm" color="gray.700" fontWeight="600">
                  Prikaži oglase na javnem profilu
                </Text>
                <Text fontSize="xs" color="gray.500">
                  Če izklopite, bo zavihek »Oglasi« skrit.
                </Text>
              </Box>
              <Switch
                colorScheme="pink"
                isChecked={Boolean(user.showListingsOnProfile)}
                isDisabled={saving || coerceIsProfilePrivate(user.isProfilePrivate)}
                onChange={(e) => updatePrivacyToggle({ showListingsOnProfile: e.target.checked })}
              />
            </HStack>

            <HStack justify="space-between" p={4} bg="white" rounded="xl" border="1px solid" borderColor="gray.100" boxShadow="sm">
              <Box>
                <Text fontSize="sm" color="gray.700" fontWeight="600">
                  Prikaži podporo na javnem profilu
                </Text>
                <Text fontSize="xs" color="gray.500">
                  Če izklopite, bo zavihek »Podpora« skrit.
                </Text>
              </Box>
              <Switch
                colorScheme="pink"
                isChecked={Boolean(user.showSupportOnProfile)}
                isDisabled={saving || coerceIsProfilePrivate(user.isProfilePrivate)}
                onChange={(e) => updatePrivacyToggle({ showSupportOnProfile: e.target.checked })}
              />
            </HStack>

            <HStack justify="space-between" p={4} bg="white" rounded="xl" border="1px solid" borderColor="gray.100" boxShadow="sm">
              <Box>
                <Text fontSize="sm" color="gray.700" fontWeight="600">
                  Prikaži objave na javnem profilu
                </Text>
                <Text fontSize="xs" color="gray.500">
                  Če izklopite, bo zavihek »Objave« skrit.
                </Text>
              </Box>
              <Switch
                colorScheme="pink"
                isChecked={user.showPostsOnProfile !== false}
                isDisabled={saving || coerceIsProfilePrivate(user.isProfilePrivate)}
                onChange={(e) => updatePrivacyToggle({ showPostsOnProfile: e.target.checked })}
              />
            </HStack>
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
}
