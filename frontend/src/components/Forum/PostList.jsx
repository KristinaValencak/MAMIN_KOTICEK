import { Box, Text, Spinner } from "@chakra-ui/react";
import { PostCard } from "./PostCard";

export const PostList = ({
  posts,
  postLikes,
  likingPosts,
  onLike,
  onOpen,
  onReport,
  onDeleteOwn,
  onFavoriteChange,
  navigate,
  loadingMore,
  hasMore,
  searchQuery,
  scrollSentinelRef,
}) => (
  <>
    {posts.map((p, index) => (
      <PostCard
        key={p.id}
        post={p}
        postLikes={postLikes}
        likingPosts={likingPosts}
        onLike={onLike}
        onOpen={onOpen}
        onReport={onReport}
        onDeleteOwn={onDeleteOwn}
        onFavoriteChange={onFavoriteChange}
        navigate={navigate}
        priorityMedia={index < 3}
      />
    ))}
    {scrollSentinelRef ? <Box ref={scrollSentinelRef} h="2px" w="full" aria-hidden /> : null}
    {!searchQuery && loadingMore && (
      <Box py={8} textAlign="center">
        <Spinner color="#EC5F8C" size="lg" />
      </Box>
    )}
    {!searchQuery && !hasMore && posts.length > 0 && (
      <Box py={8} textAlign="center" color="gray.500">
        <Text fontSize="sm">Ni več objav</Text>
      </Box>
    )}
  </>
);
