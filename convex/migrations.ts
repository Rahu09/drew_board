import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { titleSortKey } from "./sort";

const BATCH = 200;

/**
 * Fills in the sort keys (activityAt, titleKey) of boards created before
 * they existed. Until it has run, those boards are listed last under "Last
 * edited" and first under "Name". Safe to run more than once; it continues
 * by itself in batches.
 *
 *   npx convex run migrations:backfillBoardSortKeys
 */
export const backfillBoardSortKeys = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const { page, isDone, continueCursor } = await ctx.db
      .query("boards")
      .paginate({ numItems: BATCH, cursor: args.cursor ?? null });

    let updated = 0;

    for (const board of page) {
      const activityAt = board.lastEditedAt ?? board._creationTime;
      const titleKey = titleSortKey(board.title);

      if (board.activityAt !== activityAt || board.titleKey !== titleKey) {
        await ctx.db.patch(board._id, { activityAt, titleKey });
        updated += 1;
      }
    }

    if (!isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillBoardSortKeys,
        { cursor: continueCursor }
      );
    }

    return { updated, isDone };
  },
});
