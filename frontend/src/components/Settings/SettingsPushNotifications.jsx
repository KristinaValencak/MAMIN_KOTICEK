import { useMemo, useState } from "react";
import { Box, Divider, Heading, HStack, Spacer, Switch, Text, VStack } from "@chakra-ui/react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { currentPermission, enableWebPush } from "../../push/webPush";
import { FiBell } from "react-icons/fi";
import { UnorderedList, ListItem } from "@chakra-ui/react";

const sectionTitleProps = {
  size: "md",
  mb: 4,
  color: "gray.800",
  fontWeight: "800",
  letterSpacing: "-0.02em",
};

export default function SettingsPushNotifications() {
  const { toast } = useAppToast();
  const [loading, setLoading] = useState(false);

  const permission = useMemo(() => currentPermission(), []);
  const [enabled, setEnabled] = useState(permission === "granted");

  return (
    <Box>
      <Heading {...sectionTitleProps}>Nastavitve obveščanja</Heading>
      <Divider mb={6} />

      <VStack spacing={5} align="stretch">
        <Box p={4} bg="white" rounded="xl" border="1px solid" borderColor="gray.100" boxShadow="sm">
          <HStack spacing={3}>
            <FiBell />
            <Heading size="sm" color="gray.700">
              Vklopi obvestila na telefonu
            </Heading>
            <Spacer />
            <Switch
              colorScheme="brand"
              isChecked={enabled}
              isDisabled={loading}
              onChange={async (e) => {
                const next = e.target.checked;
                setEnabled(next);

                if (!next) {
                  toast({
                    status: "info",
                    title: "Obvestila izklopljena",
                    description: "Če želiš popolnoma izklopiti obvestila, preveri tudi nastavitve brskalnika/aplikacije.",
                  });
                  return;
                }

                setLoading(true);
                try {
                  await enableWebPush();
                  toast({ status: "success", title: "Obvestila omogočena" });
                  window.location.reload();
                } catch {
                  toast({
                    status: "error",
                    title: "Ni uspelo omogočiti obvestil.",
                  });
                  setEnabled(false);
                } finally {
                  setLoading(false);
                }
              }}
            />
          </HStack>
          <UnorderedList mt={3} fontSize="xs" color="gray.500" lineHeight="1.6" spacing={1} pl={4}>
  <ListItem>V nastavitvah telefona preveri, ali so obvestila za brskalnik omogočena</ListItem>
  <ListItem>Dodaj aplikacijo na začetni zaslon (»Add to Home Screen«)</ListItem>
  <ListItem>Nato znova odpri aplikacijo in dovoli obvestila, če te aplikacija vpraša</ListItem>
  <ListItem>Opomba (iPhone): obvestila delujejo samo, če je aplikacija dodana na začetni zaslon.</ListItem>
</UnorderedList>
        </Box>
      </VStack>
    </Box>
  );
}
