import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import {
  getAccessibleBoard,
  getActiveOrgId,
  requireBoard,
  requireIdentity,
  requireWorkspaceAccess,
} from "./access";
import {
  isPersonalWorkspaceId,
  ORG_NOT_ACTIVE,
  personalWorkspaceId,
} from "./workspace";

const images = [
  "/placeholders/1.svg",
  "/placeholders/2.svg",
  "/placeholders/3.svg",
  "/placeholders/4.svg",
  "/placeholders/5.svg",
  "/placeholders/6.svg",
  "/placeholders/7.svg",
  "/placeholders/8.svg",
  "/placeholders/9.svg",
  "/placeholders/10.svg",
];

const MAX_TITLE_LENGTH = 60;

const validateTitle = (rawTitle: string) => {
  const title = rawTitle.trim();

  if (!title) {
    throw new Error("Title is required");
  }

  if (title.length > MAX_TITLE_LENGTH) {
    throw new Error(
      `Title cannot be longer than ${MAX_TITLE_LENGTH} characters`
    );
  }

  return title;
};

export const create = mutation({
  args: {
    // The workspace (see workspace.ts): an org id, or the caller's own
    // personal workspace id.
    orgId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireWorkspaceAccess(ctx, args.orgId);

    const randomImage = images[Math.floor(Math.random() * images.length)];

    return await ctx.db.insert("boards", {
      title: validateTitle(args.title),
      orgId: args.orgId,
      authorId: identity.subject,
      // Not every Clerk user has a name (e.g. email-only sign-ups).
      authorName: identity.name ?? identity.email ?? "Anonymous",
      imageUrl: randomImage,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("boards") },
  handler: async (ctx, args) => {
    const { board } = await requireBoard(ctx, args.id);

    // Remove every user's favorite of this board, not just the caller's,
    // so nobody is left with a favorite pointing at a deleted board.
    const favorites = await ctx.db
      .query("userFavorites")
      .withIndex("by_board", (q) => q.eq("boardId", board._id))
      .collect();

    await Promise.all(favorites.map((favorite) => ctx.db.delete(favorite._id)));

    // Uploaded images, and comment threads with their replies.
    const images = await ctx.db
      .query("boardImages")
      .withIndex("by_board", (q) => q.eq("boardId", board._id))
      .collect();

    await Promise.all(
      images.map(async (image) => {
        await ctx.storage.delete(image.storageId);
        await ctx.db.delete(image._id);
      })
    );

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_board", (q) => q.eq("boardId", board._id))
      .collect();

    await Promise.all(comments.map((comment) => ctx.db.delete(comment._id)));

    for (const resolved of [false, true]) {
      const threads = await ctx.db
        .query("commentThreads")
        .withIndex("by_board_resolved", (q) =>
          q.eq("boardId", board._id).eq("resolved", resolved)
        )
        .collect();

      await Promise.all(threads.map((thread) => ctx.db.delete(thread._id)));
    }

    if (board.thumbnailId) {
      await ctx.storage.delete(board.thumbnailId);
    }

    await ctx.db.delete(board._id);

    // The Liveblocks room id is the board id (see components/room.tsx).
    await ctx.scheduler.runAfter(0, internal.liveblocks.deleteRoom, {
      roomId: board._id,
    });
  },
});

// Share-link secrets are made in the browser (crypto.getRandomValues) and
// only accepted in this shape: 32 or more URL-safe characters.
const SHARE_TOKEN = /^[A-Za-z0-9_-]{32,64}$/;

/**
 * Turns the board's read-only link on (with a new secret) or off (null).
 * Anyone who can use the board can do either.
 */
export const setShareLink = mutation({
  args: { id: v.id("boards"), token: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const { board } = await requireBoard(ctx, args.id);

    if (args.token !== null && !SHARE_TOKEN.test(args.token)) {
      throw new ConvexError("INVALID_SHARE_TOKEN");
    }

    await ctx.db.patch(board._id, { shareToken: args.token ?? undefined });
  },
});

/**
 * The board behind a read-only link, for /view/<token>. Public: the secret
 * token is the permission. Returns only what the viewer page needs.
 */
export const getShared = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!SHARE_TOKEN.test(args.token)) {
      return null;
    }

    const board = await ctx.db
      .query("boards")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .unique();

    return board ? { _id: board._id, title: board.title } : null;
  },
});

export const update = mutation({
  args: { id: v.id("boards"), title: v.string() },
  handler: async (ctx, args) => {
    const { board } = await requireBoard(ctx, args.id);

    await ctx.db.patch(board._id, {
      title: validateTitle(args.title),
    });

    return board._id;
  },
});

/**
 * Shares a personal board by moving it into an organization: every member
 * of that org can then open and edit it, and it stops being personal.
 *
 * Only the board's owner can move it, and only into the org that is active
 * in their token: Convex knows nothing else about org membership, and Clerk
 * only lets a user activate an org they belong to.
 */
export const moveToOrg = mutation({
  args: { id: v.id("boards"), orgId: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const board = await ctx.db.get(args.id);

    if (!board || board.orgId !== personalWorkspaceId(identity.subject)) {
      throw new Error("Board not found");
    }

    if (
      isPersonalWorkspaceId(args.orgId) ||
      args.orgId !== getActiveOrgId(identity)
    ) {
      throw new ConvexError(ORG_NOT_ACTIVE);
    }

    await ctx.db.patch(board._id, { orgId: args.orgId });

    // Favorites carry the board's workspace for listing; keep them in step.
    const favorites = await ctx.db
      .query("userFavorites")
      .withIndex("by_board", (q) => q.eq("boardId", board._id))
      .collect();

    await Promise.all(
      favorites.map((favorite) =>
        ctx.db.patch(favorite._id, { orgId: args.orgId })
      )
    );

    return board._id;
  },
});

export const favorite = mutation({
  args: { id: v.id("boards") },
  handler: async (ctx, args) => {
    const { identity, board } = await requireBoard(ctx, args.id);
    const userId = identity.subject;

    const existingFavorite = await ctx.db
      .query("userFavorites")
      .withIndex("by_user_board", (q) =>
        q.eq("userId", userId).eq("boardId", board._id)
      )
      .unique();

    if (existingFavorite) {
      throw new Error("Board already favorited");
    }

    await ctx.db.insert("userFavorites", {
      userId,
      boardId: board._id,
      orgId: board.orgId,
    });

    return board._id;
  },
});

export const unfavorite = mutation({
  args: { id: v.id("boards") },
  handler: async (ctx, args) => {
    const { identity, board } = await requireBoard(ctx, args.id);
    const userId = identity.subject;

    const existingFavorite = await ctx.db
      .query("userFavorites")
      .withIndex("by_user_board", (q) =>
        q.eq("userId", userId).eq("boardId", board._id)
      )
      .unique();

    if (!existingFavorite) {
      throw new Error("Favorited board not found");
    }

    await ctx.db.delete(existingFavorite._id);

    return board._id;
  },
});

/**
 * Returns the board, or null when it does not exist, the id is malformed, or
 * the caller is not signed in to the board's org. Never throws, so the board
 * page can show a "not found" state instead of crashing.
 */
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const id = ctx.db.normalizeId("boards", args.id);

    if (!identity || !id) {
      return null;
    }

    return await getAccessibleBoard(ctx, identity, id);
  },
});

const MAX_ORG_IDS = 100;

/**
 * Which of the caller's orgs a board belongs to, so the board page can switch
 * to that org when someone opens a link to a board of another org they are a
 * member of.
 *
 * The client passes the orgs it is a member of (Convex only knows the active
 * org from the token). The answer is the orgId only when it is one of those,
 * otherwise null, so a board id alone never reveals which org owns the board
 * or whether it exists. Membership itself is enforced by Clerk: the client
 * can only switch to an org the user really belongs to.
 */
export const findOrg = query({
  args: { id: v.string(), orgIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const id = ctx.db.normalizeId("boards", args.id);

    if (!identity || !id || args.orgIds.length > MAX_ORG_IDS) {
      return null;
    }

    const board = await ctx.db.get(id);

    // Personal boards need no switch: their owner can always open them
    // (board.get), and nobody else may learn whose they are.
    if (
      !board ||
      isPersonalWorkspaceId(board.orgId) ||
      !args.orgIds.includes(board.orgId)
    ) {
      return null;
    }

    return board.orgId;
  },
});
