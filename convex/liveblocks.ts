"use node";

import { v } from "convex/values";
import { Liveblocks, LiveblocksError } from "@liveblocks/node";

import { internalAction } from "./_generated/server";

/**
 * Deletes a board's Liveblocks room (its drawing data) after the board itself
 * is deleted. Scheduled by board.remove.
 *
 * Needs the Liveblocks secret key as LIVEBLOCKS_SECRET_KEY in this Convex
 * deployment's environment variables (Convex dashboard -> Settings ->
 * Environment Variables). Without it, the room is left in place and a
 * warning is logged; deleting the board still works.
 */
export const deleteRoom = internalAction({
  args: { roomId: v.string() },
  handler: async (_ctx, { roomId }) => {
    const secret = process.env.LIVEBLOCKS_SECRET_KEY;

    if (!secret) {
      console.warn(
        `LIVEBLOCKS_SECRET_KEY is not set; Liveblocks room ${roomId} was not deleted.`
      );
      return;
    }

    const liveblocks = new Liveblocks({ secret });

    try {
      await liveblocks.deleteRoom(roomId);
    } catch (error) {
      // A board that was never opened has no room. Nothing to clean up.
      if (error instanceof LiveblocksError && error.status === 404) {
        return;
      }

      throw error;
    }
  },
});
