import { Box, HStack, IconButton, Avatar, useDisclosure, Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerBody, DrawerCloseButton, Text, Flex, VStack, Button, Spinner, Icon } from "@chakra-ui/react";
import { Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import { FaHome, FaTh, FaBaby, FaChild, FaGraduationCap, FaHeart, FaMoon, FaUtensils, FaShoppingBag, FaHandsHelping, FaComments, FaCalendarAlt } from "react-icons/fa";
import { AddIcon, SearchIcon } from "@chakra-ui/icons";
import { useState, useEffect } from "react";
import { API_BASE } from "../../api/config";
import { buildAvatarDisplayUrl } from "../../utils/cloudinaryUpload";
import { getStoredUser } from "../../utils/helpers";
import { OPEN_NEW_POST_MODAL_EVENT } from "./GlobalNewPostModal";
import { useMobileShell } from "../../context/MobileShellContext";
import { useAuthGate } from "../../context/AuthGateContext";

const MobileFooterNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { requestAuth } = useAuthGate();
  const { openGlobalSearch } = useMobileShell();
  const { isOpen: isCategoriesOpen, onOpen: onCategoriesOpen, onClose: onCategoriesClose } = useDisclosure();
  const [user, setUser] = useState(getStoredUser());
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  useEffect(() => {
    let abort = false;
    async function loadCategories() {
      try {
        setCategoriesLoading(true);
        const res = await fetch(`${API_BASE}/api/categories`);
        if (!res.ok) throw new Error("Napaka pri branju kategorij");
        const data = await res.json();
        if (!abort) {
          setCategories(Array.isArray(data) ? data : []);
          setCategoriesLoading(false);
        }
      } catch (e) {
        console.error(e);
        if (!abort) setCategoriesLoading(false);
      }
    }
    loadCategories();
    return () => { abort = true; };
  }, []);

  useEffect(() => {
    const sync = () => setUser(getStoredUser());
    const onStorage = (e) => { if (e.key === "user") sync(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("auth-changed", sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth-changed", sync);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cat = params.get("cat");
    if (cat) {
      const foundCat = categories.find(c => c.slug === cat);
      if (foundCat) {
        setSelectedCategory(foundCat);
      } else {
        setSelectedCategory({ slug: cat, name: cat, id: null });
      }
    } else {
      setSelectedCategory(null);
    }
  }, [location.search, categories]);

  const handleCreatePost = () => {
    if (!user) {
      requestAuth({ tab: "login", reason: "Za objavo nove teme se morate prijaviti." });
      return;
    }
    if (location.pathname !== "/") {
      navigate("/");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.dispatchEvent(new CustomEvent(OPEN_NEW_POST_MODAL_EVENT));
  };

  const handleCategorySelect = (cat) => {
    if (cat) {
      navigate(`/?cat=${cat.slug}`);
    } else {
      navigate("/");
    }
    onCategoriesClose();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getCategoryIcon = (categoryId) => {
    const iconMap = {
      1: null,
      2: FaBaby,
      3: FaChild,
      4: FaGraduationCap,
      5: FaHeart,
      6: FaMoon,
      7: FaUtensils,
      8: FaShoppingBag,
      9: FaHeart,
      10: FaHandsHelping,
      11: FaComments,
      12: FaCalendarAlt,
    };
    return iconMap[categoryId] || FaComments;
  };

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <Box
        display={{ base: "block", md: "none" }}
        position="fixed"
        bottom="0"
        left="0"
        right="0"
        zIndex="1000"
        bg="white"
        borderTop="1px solid"
        borderColor="gray.200"
        boxShadow="0 -2px 10px rgba(0, 0, 0, 0.05)"
        pt={2}
        px={{ base: 5, sm: 6 }}
        pb="calc(0.5rem + env(safe-area-inset-bottom, 0px))"
      >
        <HStack
          justify="space-between"
          align="center"
          spacing={0}
          maxW="100%"
        >
          <IconButton
            as={RouterLink}
            to="/"
            aria-label="Kotiček"
            icon={<FaHome />}
            variant="ghost"
            size="lg"
            color={isActive("/") ? "#EC5F8C" : "gray.600"}
            _hover={{
              bg: "gray.50",
              color: "#EC5F8C"
            }}
            _active={{
              bg: "gray.100"
            }}
            borderRadius="md"
            flex="1"
            maxW="25%"
          />

          <IconButton
            aria-label="Kategorije"
            icon={<FaTh />}
            variant="ghost"
            size="lg"
            color={selectedCategory ? "#EC5F8C" : "gray.600"}
            _hover={{
              bg: "gray.50",
              color: "#EC5F8C"
            }}
            _active={{
              bg: "gray.100"
            }}
            borderRadius="md"
            onClick={onCategoriesOpen}
            flex="1"
            maxW="25%"
          />

          <IconButton
            aria-label="Nova objava"
            icon={<AddIcon />}
            size="lg"
            bg="#EC5F8C"
            color="white"
            borderRadius="full"
            _hover={{
              bg: "#D94B8C",
              transform: "scale(1.1)"
            }}
            _active={{
              bg: "#C73A7A",
              transform: "scale(0.95)"
            }}
            boxShadow="0 4px 12px rgba(236, 95, 140, 0.4)"
            transition="all 0.2s"
            onClick={handleCreatePost}
            flex="0 0 auto"
            minW="48px"
            h="48px"
          />

          <IconButton
            aria-label="Iskanje"
            icon={<SearchIcon />}
            variant="ghost"
            size="lg"
            color="gray.600"
            _hover={{
              bg: "gray.50",
              color: "#EC5F8C"
            }}
            _active={{
              bg: "gray.100"
            }}
            borderRadius="md"
            onClick={openGlobalSearch}
            flex="1"
            maxW="25%"
          />

          <Box flex="1" maxW="25%" display="flex" justifyContent="center">
            {user ? (
              <IconButton
                as={RouterLink}
                to="/profile"
                aria-label="Moj profil"
                icon={
                  <Avatar
                    name={user.username || "U"}
                    size="sm"
                    bg="linear-gradient(135deg, #EC5F8C 0%, #F48FB1 100%)"
                    color="white"
                    src={buildAvatarDisplayUrl(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME, user.avatarUrl)}
                  />
                }
                variant="ghost"
                size="lg"
                color={isActive("/profile") || isActive("/nastavitve") ? "#EC5F8C" : "gray.600"}
                _hover={{
                  bg: "gray.50",
                  color: "#EC5F8C"
                }}
                _active={{
                  bg: "gray.100"
                }}
                borderRadius="md"
                p={0}
              />
            ) : (
              <IconButton
                as={RouterLink}
                to="/prijava"
                aria-label="Prijava"
                icon={
                  <Avatar
                    name="?"
                    size="sm"
                    bg="gray.300"
                    color="white"
                  />
                }
                variant="ghost"
                size="lg"
                color="gray.600"
                _hover={{
                  bg: "gray.50",
                  color: "#EC5F8C"
                }}
                _active={{
                  bg: "gray.100"
                }}
                borderRadius="md"
                p={0}
              />
            )}
          </Box>
        </HStack>
      </Box>

      <Drawer
        isOpen={isCategoriesOpen}
        placement="bottom"
        onClose={onCategoriesClose}
      >
        <DrawerOverlay />
        <DrawerContent
          borderTopRadius="2xl"
          mt="auto"
          maxH={{ base: "55vh", sm: "60vh" }}
          h="auto"
          overflow="hidden"
        >
          <DrawerHeader
            borderBottom="1px solid"
            borderColor="gray.200"
            pb={4}
          >
            <Flex justify="space-between" align="center">
              <Text fontSize="xl" fontWeight="700" color="gray.800">
                Kategorije
              </Text>
              <DrawerCloseButton position="relative" top={0} right={0} />
            </Flex>
          </DrawerHeader>
          <DrawerBody pt={6} overflowY="auto" pb="calc(1rem + env(safe-area-inset-bottom, 0px))">
            {categoriesLoading ? (
              <Box py={8} textAlign="center">
                <Spinner color="#EC5F8C" size="lg" />
              </Box>
            ) : (
              <VStack align="stretch" spacing={2}>
                <Button
                  onClick={() => handleCategorySelect(null)}
                  variant={!selectedCategory ? "solid" : "ghost"}
                  colorScheme="brand"
                  justifyContent="flex-start"
                  h="48px"
                  fontSize="md"
                  fontWeight="600"
                  leftIcon={<FaHome />}
                  borderRadius="lg"
                >
                  Vse objave
                </Button>

                {categories.map((cat) => {
                  const IconComponent = getCategoryIcon(cat.id);
                  const isSelected = selectedCategory?.slug === cat.slug || selectedCategory?.id === cat.id;

                  return (
                    <Button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat)}
                      variant={isSelected ? "solid" : "ghost"}
                      colorScheme={isSelected ? "brand" : "gray"}
                      justifyContent="flex-start"
                      h="48px"
                      fontSize="md"
                      fontWeight={isSelected ? "600" : "500"}
                      leftIcon={
                        cat.id === 1 ? (
                          <Text fontSize="lg">🤰</Text>
                        ) : (
                          <Icon as={IconComponent} boxSize={4} />
                        )
                      }
                      borderRadius="lg"
                      _hover={{
                        bg: isSelected ? "brand.600" : "gray.50"
                      }}
                    >
                      {cat.name}
                    </Button>
                  );
                })}
              </VStack>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default MobileFooterNavbar;
