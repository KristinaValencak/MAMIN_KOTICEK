import ContentReportModal from "../../Report/ContentReportModal";
import { API_BASE } from "../../../api/config";

export default function ReportPostModal({
  isOpen,
  onClose,
  postId,
  postTitle,
  postAuthor,
  apiBase = API_BASE,
}) {
  if (!postId) return null;
  return (
    <ContentReportModal
      isOpen={isOpen}
      onClose={onClose}
      title="Prijavi neprimerno objavo"
      successDescription="Hvala za prijavo. Preverili bomo objavo."
      submitUrl={`${apiBase}/api/posts/${postId}/report`}
      extraBody={{
        postTitle: postTitle || "Neznano",
        postAuthor: postAuthor || "Neznano",
        postId,
      }}
    />
  );
}
