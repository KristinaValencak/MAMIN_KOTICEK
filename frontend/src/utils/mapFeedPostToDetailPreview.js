/**
 * Pretvori objavo iz feeda / profila v obliko, združljivo z GET /api/posts/:id (ForumPost / usePost).
 * @param {object|null|undefined} p
 * @returns {object|null}
 */
export function mapFeedPostToDetailPreview(p) {
  if (!p || p.id == null) return null;
  let category = null;
  if (p.category && typeof p.category === "object") {
    category = p.category;
  } else if (p.categorySlug || p.categoryName) {
    category = {
      id: p.category?.id ?? null,
      name: p.categoryName || p.category?.name || "",
      slug: p.categorySlug || p.category?.slug || "",
    };
  }
  const sc = p.supportCounts;
  const supportCounts =
    sc && typeof sc === "object"
      ? {
          support: Number(sc.support) || 0,
          hug: Number(sc.hug) || 0,
          understand: Number(sc.understand) || 0,
          together: Number(sc.together) || 0,
        }
      : { support: 0, hug: 0, understand: 0, together: 0 };
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    imageUrl: p.imageUrl ?? null,
    imagePublicId: p.imagePublicId ?? null,
    city: p.city ?? null,
    tags: Array.isArray(p.tags) ? p.tags : [],
    groupKey: p.groupKey ?? null,
    createdAt: p.createdAt,
    isFeatured: Boolean(p.isFeatured),
    isHidden: Boolean(p.isHidden),
    isAnonymous: Boolean(p.isAnonymous),
    userId: p.userId ?? null,
    author: p.author ?? null,
    authorAvatarUrl: p.authorAvatarUrl ?? null,
    category,
    isFavorited: Boolean(p.isFavorited),
    likeCount: typeof p.likeCount === "number" ? p.likeCount : 0,
    isLiked: Boolean(p.isLiked),
    supportCounts,
    mySupportReaction: typeof p.mySupportReaction === "string" ? p.mySupportReaction : null,
    commentCount: typeof p.commentCount === "number" ? p.commentCount : undefined,
    appealPending: false,
    appealLastOutcome: null,
    appealAllowed: true,
    appealBlockReason: null,
  };
}
