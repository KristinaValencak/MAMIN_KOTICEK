import { useState, useMemo } from "react";
import { Box, VStack, Text, Button, Spinner, Collapse } from "@chakra-ui/react";
import CommentCard from "./CommentCard";
import ReplyCard from "./ReplyCard";

export default function CommentsList({ comments, loadingComments, loadingMore, hasMore, totalCount, onLoadMore, postId, isAdmin, user, commentLikes, likingComments, onLike, onDelete, onFeature, onReplyAdded, onReportComment, onCommentAppealSubmitted }) {
    const [expandedReplies, setExpandedReplies] = useState(() => new Set());

    const toggleReplies = (commentId) => {
        setExpandedReplies((prev) => {
            const next = new Set(prev);
            if (next.has(commentId)) next.delete(commentId);
            else next.add(commentId);
            return next;
        });
    };

    const organizedComments = useMemo(() => {
        const parents = comments.filter(c => !c.parentCommentId);
        return parents.map(parent => ({
            ...parent,
            replies: comments.filter(c => c.parentCommentId === parent.id)
        }));
    }, [comments]);

    if (loadingComments) {
        return (
            <VStack spacing={3} mt={4}>
                <Spinner />
            </VStack>
        );
    }

    if (!organizedComments.length) {
        return (
            <Text fontSize="sm" color="gray.500" mt={4}>
                Ni komentarjev.
            </Text>
        );
    }

    return (
        <Box mt={6}>
            <Text fontSize="sm" fontWeight="600" mb={3}>
                Komentarji ({totalCount})
            </Text>

            <VStack align="stretch" spacing={1}>
                {organizedComments.map(comment => (
                    <Box key={comment.id}>
                        <CommentCard
                            comment={comment}
                            postId={postId}
                            isAdmin={isAdmin}
                            user={user}
                            commentLikes={commentLikes}
                            likingComments={likingComments}
                            onLike={onLike}
                            onDelete={onDelete}
                            onFeature={onFeature}
                            onReplyAdded={onReplyAdded}
                            onReport={onReportComment}
                            onAppealSubmitted={onCommentAppealSubmitted}
                            repliesExpanded={expandedReplies.has(comment.id)}
                            onToggleReplies={comment.replies?.length ? () => toggleReplies(comment.id) : undefined}
                        />

                        {comment.replies?.length > 0 && (
                            <Collapse in={expandedReplies.has(comment.id)} animateOpacity>
                                <VStack align="stretch" spacing={0} pl={1}>
                                    {comment.replies.map((reply) => (
                                        <ReplyCard
                                            key={reply.id}
                                            reply={reply}
                                            isAdmin={isAdmin}
                                            user={user}
                                            commentLikes={commentLikes}
                                            likingComments={likingComments}
                                            onLike={onLike}
                                            onDelete={onDelete}
                                            onReport={onReportComment}
                                        />
                                    ))}
                                </VStack>
                            </Collapse>
                        )}
                    </Box>
                ))}
            </VStack>

            {hasMore && (
                <Button mt={3} size="sm" variant="ghost" onClick={onLoadMore} isLoading={loadingMore}>
                    Naloži več komentarjev
                </Button>
            )}
        </Box>
    );
}
