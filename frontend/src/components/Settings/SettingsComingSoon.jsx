import { Box, Heading, Text } from "@chakra-ui/react";

export default function SettingsComingSoon({ title, description }) {
  return (
    <Box>
      <Heading size="md" color="gray.800" fontWeight="800" letterSpacing="-0.02em" mb={2}>
        {title}
      </Heading>
      {description ? (
        <Text fontSize="sm" color="gray.600" mb={4} maxW="lg">
          {description}
        </Text>
      ) : null}
      <Text fontSize="sm" color="gray.500" fontStyle="italic">
        Ta del bomo dodali v naslednjih korakih.
      </Text>
    </Box>
  );
}
