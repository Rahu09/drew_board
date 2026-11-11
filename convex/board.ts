import { v } from "convex/values";

import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import {
  getAccessibleBoard,
  requireBoard,
  requireOrgMember,
} from "./access";

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
    orgId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireOrgMember(ctx, args.orgId);

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

    await ctx.db.delete(board._id);

    // The Liveblocks room id is the board id (see components/room.tsx).
    await ctx.scheduler.runAfter(0, internal.liveblocks.deleteRoom, {
      roomId: board._id,
    });
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
