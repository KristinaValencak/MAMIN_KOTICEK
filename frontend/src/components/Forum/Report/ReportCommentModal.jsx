import ContentReportModal from "../../Report/ContentReportModal";
import { API_BASE } from "../../../api/config";

export default function ReportCommentModal({
  isOpen,
  onClose,
  commentId,
  commentContent,
  commentAuthor,
  apiBase = API_BASE,
}) {
  if (!commentId) return null;
  return (
    <ContentReportModal
      isOpen={isOpen}
      onClose={onClose}
      title="Prijavi neprimeren komentar"
      successDescription="Hvala za prijavo. Preverili bomo komentar."
      submitUrl={`${apiBase}/api/comments/${commentId}/report`}
      extraBody={{
        commentContent: commentContent || "Neznano",
        commentAuthor: commentAuthor || "Neznano",
        commentId,
      }}
    />
  );
}
