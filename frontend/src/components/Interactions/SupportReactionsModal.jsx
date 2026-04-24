import {Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerBody, DrawerCloseButton, Text, VStack, HStack, Box, Divider, Avatar, useBreakpointValue} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import ReactionPicker from "./ReactionPicker";
import { REACTION_META, hideScrollbarSx, profilePathForUserId } from "../../utils/helpers";
import { buildAvatarDisplayUrl } from "../../utils/cloudinaryUpload";

function reactorEmoji(entry) {
  if (entry.reactionKind === "like") return "👍";
  const t = entry.reactionType;
  if (t && REACTION_META[t]) return REACTION_META[t].emoji;
  return "·";
}

export default function SupportReactionsModal({
  isOpen,
  onClose,
  totalReactions,
  supportScore,
  reactors = [],
  likeCount,
  isLiked,
  onLike,
  isLiking,
  counts,
  myReaction,
  onReact,
  isLoading,
}) {
  const useDrawer = useBreakpointValue({ base: true, md: false }, false);

  const headerBlock = (
    <VStack align="stretch" spacing={1} pb={2}>
      <Text fontSize="sm" color="gray.600">
        Skupaj reakcij: <Text as="span" fontWeight="700" color="gray.800">{totalReactions}</Text>
      </Text>
      <Text fontSize="sm" color="gray.600">
        Skupaj točk (podpora):{" "}
        <Text as="span" fontWeight="700" color="gray.800">{supportScore}</Text>
      </Text>
    </VStack>
  );

  const pickerBlock = (
    <Box py={3}>
      <ReactionPicker
        likeCount={likeCount}
        isLiked={isLiked}
        onLike={onLike}
        isLiking={isLiking}
        counts={counts}
        myReaction={myReaction}
        onReact={onReact}
        isLoading={isLoading}
      />
    </Box>
  );

  const listBlock = (
    <VStack
      align="stretch"
      spacing={0}
      maxH={{ base: "48vh", md: "320px" }}
      overflowY="auto"
      pb={2}
      sx={hideScrollbarSx}
    >
      {reactors.length === 0 ? (
        <Text fontSize="sm" color="gray.500" py={4}>
          Še ni reakcij.
        </Text>
      ) : (
        reactors.map((r, idx) => (
          <HStack
            key={`${r.userId}-${r.reactionKind}-${r.reactionType || "like"}-${idx}`}
            spacing={3}
            py={2}
            borderBottomWidth={idx < reactors.length - 1 ? "1px" : 0}
            borderColor="gray.100"
          >
            <Avatar
              size="sm"
              src={buildAvatarDisplayUrl(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME, r.avatarUrl)}
              name={r.username || "?"}
              bgGradient="linear(135deg, #EC5F8C 0%, #F48FB1 100%)"
              color="white"
            />
            <Box flex="1" minW={0}>
              <Link to={profilePathForUserId(r.userId)} onClick={onClose} style={{ textDecoration: "none" }}>
                <Text
                  fontWeight="600"
                  fontSize="sm"
                  color="gray.800"
                  _hover={{ color: "pink.600", textDecoration: "underline" }}
                  noOfLines={1}
                >
                  {r.username || "Uporabnik"}
                </Text>
              </Link>
            </Box>
            <Text fontSize="lg" lineHeight="1" flexShrink={0}>
              {reactorEmoji(r)}
            </Text>
          </HStack>
        ))
      )}
    </VStack>
  );

  if (useDrawer) {
    return (
      <Drawer isOpen={isOpen} placement="bottom" onClose={onClose}>
        <DrawerOverlay bg="blackAlpha.400" backdropFilter="blur(2px)" />
        <DrawerContent borderTopRadius="2xl" maxH="88vh">
          <DrawerCloseButton onMouseUp={(e) => e.currentTarget.blur()} />
          <DrawerHeader fontSize="md" pb={0}>
            Reakcije
          </DrawerHeader>
          <DrawerBody pt={2} overflowY="auto" sx={hideScrollbarSx}>
            {headerBlock}
            <Divider />
            {pickerBlock}
            <Divider />
            <Text fontSize="xs" fontWeight="600" color="gray.500" textTransform="uppercase" letterSpacing="0.04em" mb={1}>
              Kdo je reagiral
            </Text>
            {listBlock}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} motionPreset="slideInBottom" isCentered size="md">
      <ModalOverlay bg="blackAlpha.400" backdropFilter="blur(2px)" />
      <ModalContent borderRadius="xl" mx={3}>
        <ModalCloseButton onMouseUp={(e) => e.currentTarget.blur()} />
        <ModalHeader fontSize="md">Reakcije</ModalHeader>
        <ModalBody pb={6}>
          {headerBlock}
          <Divider />
          {pickerBlock}
          <Divider />
          <Text fontSize="xs" fontWeight="600" color="gray.500" textTransform="uppercase" letterSpacing="0.04em" mb={1}>
            Kdo je reagiral
          </Text>
          {listBlock}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
