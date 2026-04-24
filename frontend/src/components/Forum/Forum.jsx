import { useState, useEffect, useCallback } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { Box, Grid, GridItem, VStack, Container, Skeleton, Text, Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon, FormControl, FormLabel, HStack, Input, Button, Select, Progress } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { useDisclosure } from "@chakra-ui/react";
import PostDetailModal from "./PostDetailModal";
import ReportPostModal from "./Report/ReportPostModal";
import { useCategories } from "../../hooks/forum/useCategories";
import { useCities } from "../../hooks/forum/useCities";
import { useGroups } from "../../hooks/forum/useGroups";
import { useCategoryTags } from "../../hooks/forum/useCategoryTags";
import { useForumPosts } from "../../hooks/forum/useForumPosts";
import { usePostLikes } from "../../hooks/forum/usePostLikes";
import { useFeaturedContent } from "../../hooks/forum/useFeaturedContent";
import { useForumFilters } from "../../hooks/forum/useForumFilters";
import { useInfiniteScroll } from "../../hooks/forum/useInfiniteScroll";
import { ForumSidebar } from "./ForumSidebar";
import { ForumHeader } from "./ForumHeader";
import { PostList } from "./PostList";
import { FeaturedContent } from "./FeaturedContent";
import TopMomsPreview from "./TopMomsPreview";
import { ForumPromoStack } from "./ForumPromoStack";
import { GlobalSearch } from "../Search/GlobalSearch";
import { API_BASE } from "../../api/config";
import { mergeForumPostIntoParams, normalizeForumCity, normalizeForumGroup, normalizeForumTag } from "../../utils/forumSearchParams";
import { getApiErrorMessageFromBody } from "../../utils/parseApiError.js";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useTopMoms } from "../../hooks/support/useTopMoms";
import { useGlobalSearch } from "../../hooks/search/useGlobalSearch";
import { SEARCH_DEBOUNCE_MS } from "../../constants/timing";
import { useAuthGate } from "../../context/AuthGateContext";
import { getStoredUser } from "../../utils/helpers";

export default function Forum() {
  const { isOpen: isReportOpen, onOpen: onReportOpen, onClose: onReportClose } = useDisclosure();
  const [reportingPost, setReportingPost] = useState(null);
  const navigate = useNavigate();
  const { toast, confirm } = useAppToast();
  const { requestAuth } = useAuthGate();

  const { categories } = useCategories();
  const { cities } = useCities();
  const { groups } = useGroups();
  const { selectedCategory, view, searchQuery, setSearchQuery, searchType, setSearchType, tag, setTag, city, setCity, group, setGroup, handleSelectCategory, goLatest, goTop, goFriends, clearCategory, selectedPostId, searchParams, setSearchParams } = useForumFilters(categories);
  const { tags: categoryTags } = useCategoryTags(selectedCategory?.slug);
  const [tagDraft, setTagDraft] = useState(tag || "");
  const [cityDraft, setCityDraft] = useState(city || "");
  const [groupDraft, setGroupDraft] = useState(group || "");

  useEffect(() => setTagDraft(tag || ""), [tag]);
  useEffect(() => setCityDraft(city || ""), [city]);
  useEffect(() => setGroupDraft(group || ""), [group]);

  const tagDebounced = useDebouncedValue(tagDraft, 350);
  const cityDebounced = useDebouncedValue(cityDraft, 350);
  const groupDebounced = useDebouncedValue(groupDraft, 350);

  useEffect(() => {
    // Push debounced value only if it still matches the current draft.
    // This prevents "Počisti" from being overwritten by a stale debounced value.
    if (normalizeForumTag(tagDraft) !== normalizeForumTag(tagDebounced)) return;
    const next = normalizeForumTag(tagDebounced);
    if (next !== normalizeForumTag(tag)) setTag(next);
  }, [tagDebounced, tagDraft, tag, setTag]);

  useEffect(() => {
    if (normalizeForumCity(cityDraft) !== normalizeForumCity(cityDebounced)) return;
    const next = normalizeForumCity(cityDebounced);
    if (next !== normalizeForumCity(city)) setCity(next);
  }, [cityDebounced, cityDraft, city, setCity]);

  useEffect(() => {
    if (normalizeForumGroup(groupDraft) !== normalizeForumGroup(groupDebounced)) return;
    const next = normalizeForumGroup(groupDebounced);
    if (next !== normalizeForumGroup(group)) setGroup(next);
  }, [groupDebounced, groupDraft, group, setGroup]);

  const searchLimitNorm = String(searchType || "all").trim().toLowerCase();
  const forumSearchApi = useGlobalSearch({
    query: searchQuery,
    type: searchType,
    limit: searchLimitNorm === "all" ? 8 : 10,
    debounceMs: SEARCH_DEBOUNCE_MS,
  });
  const topMomsApi = useTopMoms({ pageSize: 3 });

  const { items, loading, refreshing, loadingMore, hasMore, error, loadItems, reset, updatePostFavorite } = useForumPosts(selectedCategory, view, tag, city, group);
  const { postLikes, likingPosts, handleLike, updateLikesFromPosts } = usePostLikes();
  const { featuredPost, featuredComment, loadingPost, loadingComment } = useFeaturedContent();
  useEffect(() => {
    if (items.length > 0) updateLikesFromPosts(items);
  }, [items, updateLikesFromPosts]);

  useEffect(() => {
    loadItems(false);
  }, [selectedCategory?.slug, view, tag, city, group, loadItems]);

  const clearTag = useCallback(() => { setTagDraft(""); setTag(""); }, [setTag]);
  const clearCity = useCallback(() => { setCityDraft(""); setCity(""); }, [setCity]);
  const clearGroup = useCallback(() => { setGroupDraft(""); setGroup(""); }, [setGroup]);
  const clearAllFilters = useCallback(() => {
    setTagDraft("");
    setCityDraft("");
    setGroupDraft("");
    setTag("");
    setCity("");
    setGroup("");
    const params = new URLSearchParams(searchParams);
    params.delete("cat");
    params.delete("tag");
    params.delete("city");
    params.delete("group");
    params.delete("post");
    setSearchParams(params);
  }, [searchParams, setSearchParams, setTag, setCity, setGroup]);

  const goFriendsGuarded = useCallback(() => {
    if (!getStoredUser()) {
      requestAuth({ tab: "login", reason: "Za objave prijateljic se moraš prijaviti." });
      return;
    }
    goFriends();
  }, [goFriends, requestAuth]);

  const forumScrollSentinelRef = useInfiniteScroll(loadItems, hasMore, loading, loadingMore, "");

  const [postModalPreview, setPostModalPreview] = useState(null);

  const openPost = useCallback((p) => {
    const id = p && typeof p === "object" && p.id != null ? p.id : p;
    if (id == null || String(id).trim() === "") return;
    if (p && typeof p === "object" && p.id != null) setPostModalPreview(p);
    else setPostModalPreview(null);
    setSearchParams(mergeForumPostIntoParams(searchParams, p));
  }, [searchParams, setSearchParams]);

  const closePost = useCallback(() => {
    setPostModalPreview(null);
    const params = new URLSearchParams(searchParams);
    params.delete("post");
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const onCreated = () => reset();
    window.addEventListener("forum-post-created", onCreated);
    return () => window.removeEventListener("forum-post-created", onCreated);
  }, [reset]);

  const handleDeleteOwnPost = useCallback(
    async (post) => {
      if (!post?.id) return;
      const ok = await confirm({
        title: "Brisanje objave",
        description: "Ko objavo izbrišete, je ne bo več mogoče obnoviti. Ali želite nadaljevati?",
        confirmText: "Izbriši",
        cancelText: "Prekliči",
        destructive: true,
      });
      if (!ok) return;
      try {
        const res = await fetch(`${API_BASE}/api/posts/${post.id}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast({
            status: "error",
            title: "Brisanje ni uspelo",
            description: getApiErrorMessageFromBody(data) || "Poskusite znova.",
            isClosable: true,
          });
          return;
        }
        toast({ status: "success", title: "Objava je odstranjena", isClosable: true });
        reset();
      } catch {
        toast({ status: "error", title: "Napaka pri brisanju", isClosable: true });
      }
    },
    [reset, toast, confirm]
  );

  return (
    <>
      <Container
        maxW="8xl"
        mx="auto"
        w="full"
        px={{ base: 5, sm: 6, md: 8 }}
        py={{ base: 3, md: 6 }}
        mt={{ base: 0, md: 8 }}
        mb={{ base: 4, md: 8 }}
        minW={0}
      >
        <Grid
          templateColumns={{
            base: "minmax(0, 1fr)",
            md: "minmax(240px, 28vw) minmax(0, 1fr)",
            xl: "minmax(0, 280px) minmax(0, 1fr) minmax(0, 280px)",
          }}
          gap={{ base: 4, md: 6, xl: 8 }}
          alignItems="start"
          w="full"
          maxW="full"
          minW={0}
        >
          <GridItem display={{ base: "none", md: "block" }} minW={0}>
            <ForumSidebar
              selectedCategory={selectedCategory}
              view={view}
              onSelectCategory={handleSelectCategory}
              onGoLatest={goLatest}
              onGoTop={goTop}
              onGoFriends={goFriendsGuarded}
              tag={tagDraft}
              city={cityDraft}
              group={groupDraft}
              cities={cities}
              groups={groups}
              categoryTags={categoryTags}
              onTagChange={setTagDraft}
              onCityChange={setCityDraft}
              onGroupChange={setGroupDraft}
              onGoClearTag={clearTag}
              onGoClearCity={clearCity}
              onGoClearGroup={clearGroup}
              onClearAllFilters={clearAllFilters}
              onClearCategory={clearCategory}
            />
          </GridItem>
          <GridItem minW={0}>
            <VStack align="stretch" spacing={5} minW={0} maxW="full" w="full" overflowX="hidden">
              <ForumHeader selectedPostId={null} selectedCategory={selectedCategory} selectedPostTitle={undefined} onClose={closePost} />
              <Box display={{ base: "none", md: "block", xl: "none" }} minW={0} w="full" overflowX="hidden">
                <VStack align="stretch" spacing={4} minW={0} w="full">
                  <Box h="40px" display="flex" alignItems="center" minW={0}>
                    <GlobalSearch
                      searchApi={forumSearchApi}
                      value={searchQuery}
                      onChange={setSearchQuery}
                      type={searchType}
                      onTypeChange={setSearchType}
                      onSelectPost={openPost}
                      onNavigate={navigate}
                      variant="dropdown"
                      size="md"
                    />
                  </Box>
                  <Accordion allowToggle>
                    <AccordionItem border="1px solid" borderColor="gray.100" borderRadius="xl" overflow="hidden" bg="white" boxShadow="sm">
                      <AccordionButton py={3} px={4} _hover={{ bg: "gray.50" }}>
                        <Box flex="1" textAlign="left" fontWeight="700" fontSize="sm" color="gray.700">
                          Ta teden na forumu
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel pt={0} pb={4} px={4}>
                        <VStack spacing={4} align="stretch">
                          <FeaturedContent
                            featuredPost={featuredPost}
                            featuredComment={featuredComment}
                            loadingPost={loadingPost}
                            loadingComment={loadingComment}
                            onOpenPost={openPost}
                          />
                          <TopMomsPreview api={topMomsApi} />
                        </VStack>
                      </AccordionPanel>
                    </AccordionItem>
                  </Accordion>
                </VStack>
              </Box>
              <Box display={{ base: "block", md: "none" }} w="full" minW={0} overflowX="hidden">
                <Accordion allowToggle>
                  <AccordionItem border="1px solid" borderColor="gray.100" borderRadius="xl" overflow="hidden" bg="white" boxShadow="sm" mb={3}>
                    <AccordionButton py={3} px={4} _hover={{ bg: "gray.50" }}>
                      <Box flex="1" textAlign="left" fontWeight="700" fontSize="sm" color="gray.700">
                        Filtri objav
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel pt={2} pb={4} px={4} overflow="visible">
                      <VStack spacing={3} align="stretch" minW={0} w="full">
                        <FormControl minW={0}>
                          <FormLabel
                            fontSize="sm"
                            lineHeight="1.2"
                            fontWeight="700"
                            color="gray.700"
                            letterSpacing="-0.01em"
                            mb={1.5}
                          >
                            Tag
                          </FormLabel>
                          <HStack spacing={2} minW={0} w="full" align="stretch">
                            <Select
                              value={tagDraft || ""}
                              onChange={(e) => setTagDraft(e.target.value)}
                              size="sm"
                              borderRadius="xl"
                              borderColor="gray.200"
                              bg="white"
                              flex={1}
                              minW={0}
                              isDisabled={!selectedCategory?.slug}
                              _hover={{ borderColor: "pink.200" }}
                              _focusVisible={{
                                borderColor: "pink.400",
                                boxShadow: "0 0 0 1px var(--chakra-colors-pink-400)",
                              }}
                            >
                              <option value="">{selectedCategory?.slug ? "Vsi tagi" : "Najprej izberi kategorijo"}</option>
                              {categoryTags.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </Select>
                            <Button
                              size="xs"
                              variant="ghost"
                              rounded="full"
                              fontWeight="700"
                              color="gray.500"
                              _hover={{ color: "pink.600", bg: "pink.50" }}
                              onClick={clearTag}
                              isDisabled={!String(tag || "").trim()}
                              flexShrink={0}
                            >
                              Počisti
                            </Button>
                          </HStack>
                        </FormControl>
                        <FormControl minW={0}>
                          <FormLabel
                            fontSize="sm"
                            lineHeight="1.2"
                            fontWeight="700"
                            color="gray.700"
                            letterSpacing="-0.01em"
                            mb={1.5}
                          >
                            Mesto
                          </FormLabel>
                          <HStack spacing={2} minW={0} w="full" align="stretch">
                            <Select
                              value={cityDraft || ""}
                              onChange={(e) => setCityDraft(e.target.value)}
                              size="sm"
                              borderRadius="xl"
                              borderColor="gray.200"
                              bg="white"
                              flex={1}
                              minW={0}
                              _hover={{ borderColor: "pink.200" }}
                              _focusVisible={{
                                borderColor: "pink.400",
                                boxShadow: "0 0 0 1px var(--chakra-colors-pink-400)",
                              }}
                            >
                              <option value="">Vsa mesta</option>
                              {cities.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </Select>
                            <Button
                              size="xs"
                              variant="ghost"
                              rounded="full"
                              fontWeight="700"
                              color="gray.500"
                              _hover={{ color: "pink.600", bg: "pink.50" }}
                              onClick={clearCity}
                              isDisabled={!String(city || "").trim()}
                              flexShrink={0}
                            >
                              Počisti
                            </Button>
                          </HStack>
                        </FormControl>
                        <FormControl minW={0}>
                          <FormLabel
                            fontSize="sm"
                            lineHeight="1.2"
                            fontWeight="700"
                            color="gray.700"
                            letterSpacing="-0.01em"
                            mb={1.5}
                          >
                            Skupina
                          </FormLabel>
                          <HStack spacing={2} minW={0} w="full" align="stretch">
                            <Select
                              value={groupDraft || ""}
                              onChange={(e) => setGroupDraft(e.target.value)}
                              size="sm"
                              borderRadius="xl"
                              borderColor="gray.200"
                              bg="white"
                              flex={1}
                              minW={0}
                              _hover={{ borderColor: "pink.200" }}
                              _focusVisible={{
                                borderColor: "pink.400",
                                boxShadow: "0 0 0 1px var(--chakra-colors-pink-400)",
                              }}
                            >
                              <option value="">Vse skupine</option>
                              {groups.map((g) => (
                                <option key={g.key} value={g.key}>
                                  {g.label}
                                </option>
                              ))}
                            </Select>
                            <Button
                              size="xs"
                              variant="ghost"
                              rounded="full"
                              fontWeight="700"
                              color="gray.500"
                              _hover={{ color: "pink.600", bg: "pink.50" }}
                              onClick={clearGroup}
                              isDisabled={!String(group || "").trim()}
                              flexShrink={0}
                            >
                              Počisti
                            </Button>
                          </HStack>
                        </FormControl>
                        <Button
                          size="sm"
                          w="full"
                          rounded="xl"
                          fontWeight="700"
                          variant="outline"
                          borderColor="pink.200"
                          color="pink.600"
                          bg="white"
                          _hover={{ bg: "pink.50", borderColor: "pink.300" }}
                          _active={{ bg: "pink.100" }}
                          onClick={clearAllFilters}
                          isDisabled={
                            !String(tag || "").trim() &&
                            !String(city || "").trim() &&
                            !String(group || "").trim() &&
                            !selectedCategory?.slug
                          }
                        >
                          Počisti vse filtre
                        </Button>
                      </VStack>
                    </AccordionPanel>
                  </AccordionItem>
                  <AccordionItem border="1px solid" borderColor="gray.100" borderRadius="xl" overflow="hidden" bg="white" boxShadow="sm">
                    <AccordionButton py={3} px={4} _hover={{ bg: "gray.50" }}>
                      <Box flex="1" textAlign="left" fontWeight="700" fontSize="sm" color="gray.700">
                        Ta teden na forumu
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel pt={0} pb={4} px={4}>
                      <VStack spacing={4} align="stretch">
                        <FeaturedContent
                          featuredPost={featuredPost}
                          featuredComment={featuredComment}
                          loadingPost={loadingPost}
                          loadingComment={loadingComment}
                          onOpenPost={openPost}
                        />
                        <TopMomsPreview api={topMomsApi} />
                      </VStack>
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
                <Box
                  mt={3}
                  bg="white"
                  rounded="full"
                  p={1}
                  borderWidth="1px"
                  borderColor="gray.100"
                  boxShadow="sm"
                >
                  <HStack spacing={1}>
                    <Button
                      onClick={goLatest}
                      flex={1}
                      size="sm"
                      rounded="full"
                      fontWeight="700"
                      fontSize="sm"
                      h="38px"
                      bg="transparent"
                      color={view === "latest" ? "gray.900" : "gray.600"}
                      boxShadow="none"
                      _hover={{ bg: "gray.50" }}
                      _active={{ bg: "gray.100" }}
                      position="relative"
                      _after={
                        view === "latest"
                          ? {
                              content: '""',
                              position: "absolute",
                              left: "14px",
                              right: "14px",
                              bottom: "6px",
                              height: "2px",
                              borderRadius: "999px",
                              bg: "pink.500",
                            }
                          : undefined
                      }
                    >
                      Najnovejše
                    </Button>
                    <Button
                      onClick={goTop}
                      flex={1}
                      size="sm"
                      rounded="full"
                      fontWeight="700"
                      fontSize="sm"
                      h="38px"
                      bg="transparent"
                      color={view === "top" ? "gray.900" : "gray.600"}
                      boxShadow="none"
                      _hover={{ bg: "gray.50" }}
                      _active={{ bg: "gray.100" }}
                      position="relative"
                      _after={
                        view === "top"
                          ? {
                              content: '""',
                              position: "absolute",
                              left: "14px",
                              right: "14px",
                              bottom: "6px",
                              height: "2px",
                              borderRadius: "999px",
                              bg: "pink.500",
                            }
                          : undefined
                      }
                    >
                      Naj odziva
                    </Button>
                    <Button
                      onClick={goFriendsGuarded}
                      flex={1}
                      size="sm"
                      rounded="full"
                      fontWeight="700"
                      fontSize="sm"
                      h="38px"
                      bg="transparent"
                      color={view === "friends" ? "gray.900" : "gray.600"}
                      boxShadow="none"
                      _hover={{ bg: "gray.50" }}
                      _active={{ bg: "gray.100" }}
                      position="relative"
                      _after={
                        view === "friends"
                          ? {
                              content: '""',
                              position: "absolute",
                              left: "14px",
                              right: "14px",
                              bottom: "6px",
                              height: "2px",
                              borderRadius: "999px",
                              bg: "pink.500",
                            }
                          : undefined
                      }
                    >
                      Prijateljice
                    </Button>
                  </HStack>
                </Box>
              </Box>
              {error && <Box color="red.600" fontSize="sm">{error}</Box>}
              {refreshing && items.length > 0 ? (
                <Progress size="xs" isIndeterminate colorScheme="pink" borderRadius="full" aria-label="Osveževanje objav" />
              ) : null}
              {loading && items.length === 0 ? (
                <>
                  <Skeleton height="84px" borderRadius="md" />
                  <Skeleton height="84px" borderRadius="md" />
                  <Skeleton height="84px" borderRadius="md" />
                </>
              ) : items.length === 0 ? (
                <Text color="gray.600">Ni objav.</Text>
              ) : (
                <PostList posts={items} postLikes={postLikes} likingPosts={likingPosts} onLike={handleLike} onOpen={openPost} onReport={(p) => { setReportingPost(p); onReportOpen(); }} onDeleteOwn={handleDeleteOwnPost} onFavoriteChange={updatePostFavorite} navigate={navigate} loadingMore={loadingMore} hasMore={hasMore} searchQuery={searchQuery} scrollSentinelRef={forumScrollSentinelRef} />
              )}
            </VStack>
          </GridItem>
          <GridItem className="forum-promotion-column" display={{ base: "none", xl: "block" }} minW={0}>
            <ForumPromoStack
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchType={searchType}
              onSearchTypeChange={setSearchType}
              onSelectPost={openPost}
              onNavigate={navigate}
              featuredPost={featuredPost}
              featuredComment={featuredComment}
              loadingPost={loadingPost}
              loadingComment={loadingComment}
              onOpenPost={openPost}
              searchApi={forumSearchApi}
              topMomsApi={topMomsApi}
            />
          </GridItem>
        </Grid>
      </Container>
      <ReportPostModal isOpen={isReportOpen} onClose={onReportClose} postId={reportingPost?.id} postTitle={reportingPost?.title} postAuthor={reportingPost?.author} apiBase={API_BASE} />
      <PostDetailModal
        postId={selectedPostId}
        isOpen={Boolean(selectedPostId)}
        onClose={closePost}
        previewFromFeed={
          postModalPreview && selectedPostId && String(postModalPreview.id) === String(selectedPostId)
            ? postModalPreview
            : null
        }
      />
    </>
  );
}
