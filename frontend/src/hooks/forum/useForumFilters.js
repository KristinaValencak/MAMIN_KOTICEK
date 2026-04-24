import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { mergeForumSearchQueryIntoParams, mergeForumSearchTypeIntoParams, mergeForumTagIntoParams, mergeForumCityIntoParams, mergeForumGroupIntoParams, normalizeForumTag, normalizeForumCity, normalizeForumGroup, normalizeForumSearchType, parseForumSearchFromSearchParams } from "../../utils/forumSearchParams";

export const useForumFilters = (categories) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [view, setView] = useState("latest");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("all");
  const [tag, setTag] = useState("");
  const [city, setCity] = useState("");
  const [group, setGroup] = useState("");

  useEffect(() => {
    const cat = searchParams.get("cat");
    const v = searchParams.get("view") || "latest";
    const { searchQuery: sq, searchType: st } = parseForumSearchFromSearchParams(searchParams);
    const tagFromUrl = normalizeForumTag(searchParams.get("tag"));
    const cityFromUrl = normalizeForumCity(searchParams.get("city"));
    const groupFromUrl = normalizeForumGroup(searchParams.get("group"));
    setView(v);
    setSearchQuery(sq);
    setSearchType(st);
    setTag(tagFromUrl);
    setCity(cityFromUrl);
    setGroup(groupFromUrl);
    if (!cat) {
      setSelectedCategory(null);
      return;
    }
    const foundCat = categories.find(c => c.slug === cat);
    if (foundCat) setSelectedCategory(foundCat);
    else setSelectedCategory({ slug: cat, name: cat, id: null });
  }, [searchParams, categories]);

  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat);
    const params = new URLSearchParams(searchParams);
    params.set("cat", cat.slug);
    const currentView = (searchParams.get("view") || "latest").trim().toLowerCase();
    const keepView = currentView === "top" || currentView === "friends" ? currentView : "latest";
    params.set("view", keepView);
    setView(keepView);
    params.delete("post");
    setSearchQuery("");
    params.delete("search");
    params.delete("type");
    setSearchParams(params);
  };

  const goLatest = () => {
    setView("latest");
    const params = new URLSearchParams(searchParams);
    params.set("view", "latest");
    params.delete("post");
    setSearchQuery("");
    params.delete("search");
    params.delete("type");
    setSearchParams(params);
  };

  const goTop = () => {
    setView("top");
    const params = new URLSearchParams(searchParams);
    params.set("view", "top");
    params.delete("post");
    setSearchQuery("");
    params.delete("search");
    params.delete("type");
    setSearchParams(params);
  };

  const goFriends = () => {
    setView("friends");
    const params = new URLSearchParams(searchParams);
    params.set("view", "friends");
    params.delete("post");
    setSearchQuery("");
    params.delete("search");
    params.delete("type");
    setSearchParams(params);
  };

  const clearCategory = () => {
    setSelectedCategory(null);
    const params = new URLSearchParams(searchParams);
    params.delete("cat");
    params.delete("post");
    setSearchParams(params);
  };

  const selectedPostId = searchParams.get("post");

  const setSearchQueryAndUrl = (next) => {
    const v = String(next || "");
    setSearchQuery(v);
    setSearchParams(mergeForumSearchQueryIntoParams(searchParams, v, searchType));
  };

  const setSearchTypeAndUrl = (nextType) => {
    const normalized = normalizeForumSearchType(nextType);
    setSearchType(normalized);
    setSearchParams(mergeForumSearchTypeIntoParams(searchParams, searchQuery, normalized));
  };

  const setTagAndUrl = (next) => {
    setTag(String(next || ""));
    setSearchParams(mergeForumTagIntoParams(searchParams, next));
  };

  const setCityAndUrl = (next) => {
    setCity(String(next || ""));
    setSearchParams(mergeForumCityIntoParams(searchParams, next));
  };

  const setGroupAndUrl = (next) => {
    setGroup(String(next || ""));
    setSearchParams(mergeForumGroupIntoParams(searchParams, next));
  };

  return {
    selectedCategory,
    view,
    searchQuery,
    setSearchQuery: setSearchQueryAndUrl,
    searchType,
    setSearchType: setSearchTypeAndUrl,
    tag,
    setTag: setTagAndUrl,
    city,
    setCity: setCityAndUrl,
    group,
    setGroup: setGroupAndUrl,
    handleSelectCategory,
    goLatest,
    goTop,
    goFriends,
    clearCategory,
    selectedPostId,
    searchParams,
    setSearchParams,
  };
};
