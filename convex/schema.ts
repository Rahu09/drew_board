import { v } from "convex/values";
import { defineSchema, defineTable } from "convex/server";

export default defineSchema({
  boards: defineTable({
    title: v.string(),
    // The board's workspace: a Clerk org id, or "user:<userId>" for a
    // personal board (see workspace.ts).
    orgId: v.string(),
    authorId: v.string(),
    authorName: v.string(),
    imageUrl: v.string(),
    // Secret of the board's read-only link (/view/<token>), when it has one.
    shareToken: v.optional(v.string()),
    // A small picture of the board for the dashboard (see thumbnails.ts),
    // and who last changed it and when. All unset until the first edit.
    thumbnailId: v.optional(v.id("_storage")),
    lastEditedAt: v.optional(v.number()),
    lastEditorId: v.optional(v.string()),
    lastEditorName: v.optional(v.string()),
    // Sort keys for the paginated dashboard lists (see boards.ts, sort.ts):
    // when the board was created or last edited, and its lowercased title.
    // Boards from before these fields get them from migrations.ts.
    activityAt: v.optional(v.number()),
    titleKey: v.optional(v.string()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_activity", ["orgId", "activityAt"])
    .index("by_org_title", ["orgId", "titleKey"])
    .index("by_share_token", ["shareToken"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["orgId"],
    }),
  // Files uploaded for a board's image layers, deleted with the board.
  boardImages: defineTable({
    boardId: v.id("boards"),
    storageId: v.id("_storage"),
  }).index("by_board", ["boardId"]),
  // A comment pin on a board, at canvas coordinates x/y.
  commentThreads: defineTable({
    boardId: v.id("boards"),
    x: v.number(),
    y: v.number(),
    resolved: v.boolean(),
    authorId: v.string(),
  }).index("by_board_resolved", ["boardId", "resolved"]),
  comments: defineTable({
    threadId: v.id("commentThreads"),
    boardId: v.id("boards"),
    authorId: v.string(),
    authorName: v.string(),
    authorImage: v.optional(v.string()),
    body: v.string(),
  })
    .index("by_thread", ["threadId"])
    .index("by_board", ["boardId"]),
  userFavorites: defineTable({
    // The favorited board's workspace (same format as boards.orgId).
    orgId: v.string(),
    userId: v.string(),
    boardId: v.id("boards"),
  })
    .index("by_board", ["boardId"])
    .index("by_user_org", ["userId", "orgId"])
    .index("by_user_board", ["userId", "boardId"])
    .index("by_user_board_org", ["userId", "boardId", "orgId"]),
});
