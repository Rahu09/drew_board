import { v } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

import { query } from "./_generated/server";
import { getActiveOrgId, requireIdentity } from "./access";

export const get = query({
  args: {
    orgId: v.string(),
    search: v.optional(v.string()),
    favorites: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);

    // Only list boards of the caller's active org. Right after switching
    // org, the client can briefly ask for the new org with the old token, so
    // return null (the UI treats it as "still loading") instead of throwing;
    // Convex re-runs the query as soon as the refreshed token arrives.
    if (getActiveOrgId(identity) !== args.orgId) {
      return null;
    }

    const title = args.search;

    if (args.favorites) {
      const favoritedBoards = await ctx.db
        .query("userFavorites")
        .withIndex("by_user_org", (q) =>
          q.eq("userId", identity.subject).eq("orgId", args.orgId)
        )
        .order("desc")
        .collect();

      if (title) {
        // Search the same way Team boards does (the title search index),
        // then keep only the boards this user favorited.
        const favoriteIds = new Set(favoritedBoards.map((f) => f.boardId));

        const matches = await ctx.db
          .query("boards")
          .withSearchIndex("search_title", (q) =>
            q.search("title", title).eq("orgId", args.orgId)
          )
          .collect();

        return matches
          .filter((board) => favoriteIds.has(board._id))
          .map((board) => ({
            ...board,
            isFavorite: true,
          }));
      }

      const ids = favoritedBoards.map((b) => b.boardId);

      // getAll (not getAllOrThrow): skip favorites whose board was deleted
      // before board.remove started cleaning them up.
      const boards = await getAll(ctx.db, ids);

      return boards
        .filter((board) => board !== null)
        .map((board) => ({
          ...board,
          isFavorite: true,
        }));
    }

    const boards = title
      ? await ctx.db
          .query("boards")
          .withSearchIndex("search_title", (q) =>
            q.search("title", title).eq("orgId", args.orgId)
          )
          .collect()
      : await ctx.db
          .query("boards")
          .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
          .order("desc")
          .collect();

    return await Promise.all(
      boards.map(async (board) => {
        const favorite = await ctx.db
          .query("userFavorites")
          .withIndex("by_user_board", (q) =>
            q.eq("userId", identity.subject).eq("boardId", board._id)
          )
          .unique();

        return {
          ...board,
          isFavorite: !!favorite,
        };
      })
    );
  },
});
