import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { getAccessibleBoard, requireBoard, requireIdentity } from "./access";

const MAX_BODY_LENGTH = 2_000;
const MAX_OPEN_THREADS = 200;

const validateBody = (raw: string) => {
  const body = raw.trim();

  if (!body || body.length > MAX_BODY_LENGTH) {
    throw new ConvexError("INVALID_COMMENT");
  }

  return body;
};

/** The thread, if the caller can use its board. */
const requireThread = async (ctx: MutationCtx, id: Id<"commentThreads">) => {
  const thread = await ctx.db.get(id);

  if (!thread) {
    throw new Error("Thread not found");
  }

  const { identity } = await requireBoard(ctx, thread.boardId);
  return { identity, thread };
};

/** Open (unresolved) threads of a board with their comments, oldest first. */
export const list = query({
  args: { boardId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const id = ctx.db.normalizeId("boards", args.boardId);

    if (!identity || !id || !(await getAccessibleBoard(ctx, identity, id))) {
      return [];
    }

    const threads = await ctx.db
      .query("commentThreads")
      .withIndex("by_board_resolved", (q) =>
        q.eq("boardId", id).eq("resolved", false)
      )
      .take(MAX_OPEN_THREADS);

    return await Promise.all(
      threads.map(async (thread) => ({
        ...thread,
        comments: await ctx.db
          .query("comments")
          .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
          .collect(),
      }))
    );
  },
});

/** Starts a thread at canvas point x/y with its first comment. */
export const createThread = mutation({
  args: {
    boardId: v.id("boards"),
    x: v.number(),
    y: v.number(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const { identity, board } = await requireBoard(ctx, args.boardId);
    const body = validateBody(args.body);

    if (!Number.isFinite(args.x) || !Number.isFinite(args.y)) {
      throw new ConvexError("INVALID_POSITION");
    }

    const open = await ctx.db
      .query("commentThreads")
      .withIndex("by_board_resolved", (q) =>
        q.eq("boardId", board._id).eq("resolved", false)
      )
      .take(MAX_OPEN_THREADS);

    if (open.length >= MAX_OPEN_THREADS) {
      throw new ConvexError("TOO_MANY_THREADS");
    }

    const threadId = await ctx.db.insert("commentThreads", {
      boardId: board._id,
      x: args.x,
      y: args.y,
      resolved: false,
      authorId: identity.subject,
    });

    await ctx.db.insert("comments", {
      threadId,
      boardId: board._id,
      authorId: identity.subject,
      authorName: identity.name ?? identity.email ?? "Anonymous",
      authorImage: identity.pictureUrl,
      body,
    });

    return threadId;
  },
});

export const reply = mutation({
  args: { threadId: v.id("commentThreads"), body: v.string() },
  handler: async (ctx, args) => {
    const { identity, thread } = await requireThread(ctx, args.threadId);

    return await ctx.db.insert("comments", {
      threadId: thread._id,
      boardId: thread.boardId,
      authorId: identity.subject,
      authorName: identity.name ?? identity.email ?? "Anonymous",
      authorImage: identity.pictureUrl,
      body: validateBody(args.body),
    });
  },
});

/** Anyone on the board can resolve a thread; it then disappears. */
export const resolve = mutation({
  args: { threadId: v.id("commentThreads") },
  handler: async (ctx, args) => {
    const { thread } = await requireThread(ctx, args.threadId);
    await ctx.db.patch(thread._id, { resolved: true });
  },
});

/** Deletes a thread and its replies. Only its author can. */
export const removeThread = mutation({
  args: { threadId: v.id("commentThreads") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const { thread } = await requireThread(ctx, args.threadId);

    if (thread.authorId !== identity.subject) {
      throw new ConvexError("NOT_THREAD_AUTHOR");
    }

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .collect();

    await Promise.all(comments.map((comment) => ctx.db.delete(comment._id)));
    await ctx.db.delete(thread._id);
  },
});
