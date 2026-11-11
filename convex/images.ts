import { ConvexError, v } from "convex/values";

import { mutation } from "./_generated/server";
import { requireBoard } from "./access";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// No SVG: it can carry scripts if someone opens the file URL directly.
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/** An upload URL for an image on a board the caller can use. */
export const generateUploadUrl = mutation({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    await requireBoard(ctx, args.boardId);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Registers an uploaded file as one of the board's images (so it is deleted
 * with the board) and returns its URL for the image layer. Anything that is
 * not a small PNG, JPEG, GIF or WebP is deleted and refused.
 */
export const addImage = mutation({
  args: { boardId: v.id("boards"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const { board } = await requireBoard(ctx, args.boardId);
    const file = await ctx.db.system.get(args.storageId);

    if (!file) {
      throw new ConvexError("IMAGE_NOT_FOUND");
    }

    if (
      !file.contentType ||
      !IMAGE_TYPES.includes(file.contentType) ||
      file.size > MAX_IMAGE_BYTES
    ) {
      await ctx.storage.delete(args.storageId);
      throw new ConvexError("INVALID_IMAGE");
    }

    await ctx.db.insert("boardImages", {
      boardId: board._id,
      storageId: args.storageId,
    });

    const url = await ctx.storage.getUrl(args.storageId);

    if (!url) {
      throw new ConvexError("IMAGE_NOT_FOUND");
    }

    return url;
  },
});
