import { ConvexError, v } from "convex/values";

import { mutation } from "./_generated/server";
import { requireBoard } from "./access";

// Thumbnails are small (see components/canvas/export.ts); anything bigger
// or of another type is refused.
const MAX_THUMBNAIL_BYTES = 512 * 1024;
const THUMBNAIL_TYPES = ["image/png", "image/webp"];

/** An upload URL for a new thumbnail of a board the caller can use. */
export const generateUploadUrl = mutation({
  args: { id: v.id("boards") },
  handler: async (ctx, args) => {
    await requireBoard(ctx, args.id);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Replaces the board's thumbnail with an uploaded file, or removes it
 * (null: the board is empty). With `edited`, the caller also becomes the
 * board's last editor; without, it only refreshes the picture (a board
 * opened that had none yet).
 */
export const set = mutation({
  args: {
    id: v.id("boards"),
    storageId: v.union(v.id("_storage"), v.null()),
    edited: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { identity, board } = await requireBoard(ctx, args.id);

    if (args.storageId) {
      const file = await ctx.db.system.get(args.storageId);

      if (
        !file ||
        !file.contentType ||
        !THUMBNAIL_TYPES.includes(file.contentType) ||
        file.size > MAX_THUMBNAIL_BYTES
      ) {
        if (file) await ctx.storage.delete(args.storageId);
        throw new ConvexError("INVALID_THUMBNAIL");
      }
    }

    if (board.thumbnailId && board.thumbnailId !== args.storageId) {
      await ctx.storage.delete(board.thumbnailId);
    }

    await ctx.db.patch(board._id, {
      thumbnailId: args.storageId ?? undefined,
      ...(args.edited && {
        lastEditedAt: Date.now(),
        lastEditorId: identity.subject,
        lastEditorName: identity.name ?? identity.email ?? "Anonymous",
      }),
    });
  },
});
