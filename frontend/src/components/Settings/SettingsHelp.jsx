import { Box, Heading, Text, VStack, Button, Divider } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";

const sectionTitleProps = {
  size: "md",
  mb: 4,
  color: "gray.800",
  fontWeight: "800",
  letterSpacing: "-0.02em",
};

const linkRow = {
  variant: "ghost",
  justifyContent: "flex-start",
  h: "auto",
  py: 3,
  px: 4,
  rounded: "xl",
  fontWeight: "600",
  color: "gray.700",
  _hover: { bg: "pink.50", color: "pink.600" },
  whiteSpace: "normal",
  textAlign: "left",
};

function HelpLink({ to, title, description }) {
  return (
    <Button as={RouterLink} to={to} {...linkRow}>
      <Box as="span" w="full">
        <Text as="span" display="block">
          {title}
        </Text>
        {description ? (
          <Text as="span" display="block" fontSize="xs" fontWeight="400" color="gray.500" mt={1}>
            {description}
          </Text>
        ) : null}
      </Box>
    </Button>
  );
}

export default function SettingsHelp() {
  return (
    <Box>
      <Heading {...sectionTitleProps}>Pomoč in podpora</Heading>
      <Divider mb={4} />
      <VStack align="stretch" spacing={1} mb={8}>
        <HelpLink
          to="mailto:info.maminakotickek@gmail.com"
          title="Kontakt"
          description="info.maminakotickek@gmail.com"
        />
        <HelpLink
          to="/o-nas"
          title="O maminem kotičku"
          description="Kratka usmeritev, kaj je v skupnosti dobrodošlo."
        />
      </VStack>
      <VStack align="stretch" spacing={1}>
        <HelpLink to="/pogoji-uporabe" title="Pogoji uporabe" />
        <HelpLink to="/politika-zasebnosti" title="Politika zasebnosti" />
        <HelpLink to="/politika-piskotkov" title="Politika piškotkov" />
      </VStack>
    </Box>
  );
}
