import { v } from "convex/values";

// How the dashboard can order a workspace's boards. Each order is backed by
// an index (see schema.ts), so lists can be read a page at a time.
//
// This file has no Convex server imports, so the Next.js app can use it too.

export const boardSort = v.union(
  v.literal("edited"),
  v.literal("newest"),
  v.literal("oldest"),
  v.literal("name")
);

export type BoardSort = "edited" | "newest" | "oldest" | "name";

/** boards.titleKey: the title as it is compared when sorting by name. */
export const titleSortKey = (title: string) => title.trim().toLowerCase();
