import { Box, VStack } from "@chakra-ui/react";
import { GlobalSearch } from "../Search/GlobalSearch";
import { FeaturedContent } from "./FeaturedContent";
import TopMomsPreview from "./TopMomsPreview";

export function ForumPromoStack({
  searchQuery,
  onSearchChange,
  searchType,
  onSearchTypeChange,
  onSelectPost,
  onNavigate,
  featuredPost,
  featuredComment,
  loadingPost,
  loadingComment,
  onOpenPost,
  searchApi,
  topMomsApi,
}) {
  return (
    <VStack align="stretch" spacing={4} minW={0} w="full">
      <Box h="40px" display="flex" alignItems="center" minW={0}>
        <GlobalSearch
          searchApi={searchApi}
          value={searchQuery}
          onChange={onSearchChange}
          type={searchType}
          onTypeChange={onSearchTypeChange}
          onSelectPost={onSelectPost}
          onNavigate={onNavigate}
          variant="dropdown"
          size="md"
        />
      </Box>
      <VStack spacing={4} align="stretch" minW={0}>
        <FeaturedContent
          featuredPost={featuredPost}
          featuredComment={featuredComment}
          loadingPost={loadingPost}
          loadingComment={loadingComment}
          onOpenPost={onOpenPost}
        />
        <TopMomsPreview api={topMomsApi} />
      </VStack>
    </VStack>
  );
}
