import ContentReportModal from "../Report/ContentReportModal";
import { API_BASE } from "../../api/config";

export default function ReportProfileModal({
  isOpen,
  onClose,
  profileUserId,
  profileUsername,
  apiBase = API_BASE,
}) {
  if (!profileUserId) return null;
  return (
    <ContentReportModal
      isOpen={isOpen}
      onClose={onClose}
      variant="profile"
      title="Prijavi neprimeren profil"
      successDescription="Hvala za prijavo. Preverili bomo profil."
      submitUrl={`${apiBase}/api/users/${profileUserId}/report`}
      extraBody={{ profileUsername: profileUsername || "Neznano" }}
    />
  );
}
