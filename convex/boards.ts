import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getAll } from "convex-helpers/server/relationships";

import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { canAccessWorkspace, requireIdentity } from "./access";
import { boardSort } from "./sort";

/** A board as the dashboard shows it. */
const toCard = async (
  ctx: QueryCtx,
  board: Doc<"boards">,
  isFavorite: boolean
) => ({
  ...board,
  isFavorite,
  thumbnailUrl: board.thumbnailId
    ? await ctx.storage.getUrl(board.thumbnailId)
    : null,
});

/**
 * The caller's favorites in a workspace, newest first: one index read for
 * the whole list instead of one lookup per board.
 */
const favoritesOf = (ctx: QueryCtx, userId: string, orgId: string) =>
  ctx.db
    .query("userFavorites")
    .withIndex("by_user_org", (q) => q.eq("userId", userId).eq("orgId", orgId))
    .order("desc");

const favoriteIdsOf = async (ctx: QueryCtx, userId: string, orgId: string) =>
  new Set<Id<"boards">>(
    (await favoritesOf(ctx, userId, orgId).collect()).map(
      (favorite) => favorite.boardId
    )
  );

/**
 * Whether the caller's token already allows this workspace. Right after
 * switching org the client briefly still has the old token; the dashboard
 * waits for this to turn true (Convex re-runs it when the new token
 * arrives) before asking for the list.
 */
export const access = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    return !!identity && canAccessWorkspace(identity, args.orgId);
  },
});

/**
 * The dashboard list, a page at a time (usePaginatedQuery): the boards of a
 * workspace in the chosen order, the caller's favorites (most recently
 * favorited first), or a title search (best match first). `sort` only
 * applies to the plain list.
 */
export const list = query({
  args: {
    // A workspace (see workspace.ts): the caller's personal one, or their
    // active org.
    orgId: v.string(),
    search: v.optional(v.string()),
    favorites: v.optional(v.boolean()),
    sort: v.optional(boardSort),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const { orgId, paginationOpts } = args;

    // Not thrown: see `access`. The client does not normally get here.
    if (!canAccessWorkspace(identity, orgId)) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const title = args.search?.trim();

    if (title) {
      const result = await ctx.db
        .query("boards")
        .withSearchIndex("search_title", (q) =>
          q.search("title", title).eq("orgId", orgId)
        )
        .paginate(paginationOpts);
      const favoriteIds = await favoriteIdsOf(ctx, identity.subject, orgId);

      return {
        ...result,
        page: await Promise.all(
          result.page
            .filter((board) => !args.favorites || favoriteIds.has(board._id))
            .map((board) => toCard(ctx, board, favoriteIds.has(board._id)))
        ),
      };
    }

    if (args.favorites) {
      const result = await favoritesOf(ctx, identity.subject, orgId).paginate(
        paginationOpts
      );
      // getAll (not getAllOrThrow): skip favorites whose board was deleted
      // before board.remove started cleaning them up.
      const boards = await getAll(
        ctx.db,
        result.page.map((favorite) => favorite.boardId)
      );

      return {
        ...result,
        page: await Promise.all(
          boards
            .filter((board) => board !== null)
            .map((board) => toCard(ctx, board, true))
        ),
      };
    }

    const boards = ctx.db.query("boards");
    const sort = args.sort ?? "edited";
    const ordered =
      sort === "name"
        ? boards
            .withIndex("by_org_title", (q) => q.eq("orgId", orgId))
            .order("asc")
        : sort === "edited"
          ? boards
              .withIndex("by_org_activity", (q) => q.eq("orgId", orgId))
              .order("desc")
          : boards
              .withIndex("by_org", (q) => q.eq("orgId", orgId))
              .order(sort === "oldest" ? "asc" : "desc");

    const result = await ordered.paginate(paginationOpts);
    const favoriteIds = await favoriteIdsOf(ctx, identity.subject, orgId);

    return {
      ...result,
      page: await Promise.all(
        result.page.map((board) =>
          toCard(ctx, board, favoriteIds.has(board._id))
        )
      ),
    };
  },
});
