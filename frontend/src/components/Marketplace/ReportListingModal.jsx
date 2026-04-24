import { Text } from "@chakra-ui/react";
import ContentReportModal from "../Report/ContentReportModal";
import { API_BASE } from "../../api/config";

export default function ReportListingModal({ isOpen, onClose, listingId, listingTitle, apiBase = API_BASE }) {
  if (!listingId) return null;
  const bodyBeforeForm =
    listingTitle != null && String(listingTitle).trim() !== "" ? (
      <Text fontSize="sm" fontWeight="700" color="gray.800">
        {listingTitle}
      </Text>
    ) : null;

  return (
    <ContentReportModal
      isOpen={isOpen}
      onClose={onClose}
      title="Prijavi neprimeren oglas"
      successDescription="Hvala za prijavo. Oglas bomo pregledali."
      submitUrl={`${apiBase}/api/marketplace/${listingId}/report`}
      bodyBeforeForm={bodyBeforeForm}
    />
  );
}
