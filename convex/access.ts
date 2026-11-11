import type { UserIdentity } from "convex/server";

import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

/**
 * The org the user currently has active in Clerk.
 *
 * Comes from the `org_id` claim of Clerk's "convex" JWT template, which
 * Clerk refreshes whenever the user switches organization.
 */
export const getActiveOrgId = (identity: UserIdentity): string | undefined =>
  typeof identity.org_id === "string" ? identity.org_id : undefined;

export const requireIdentity = async (ctx: QueryCtx) => {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Unauthorized");
  }

  return identity;
};

/** Throws unless the caller is signed in with `orgId` as their active org. */
export const requireOrgMember = async (ctx: QueryCtx, orgId: string) => {
  const identity = await requireIdentity(ctx);

  if (getActiveOrgId(identity) !== orgId) {
    throw new Error("Unauthorized");
  }

  return identity;
};

/**
 * Loads a board the caller is allowed to use, or returns null when the board
 * does not exist or belongs to an org other than the caller's active org.
 * The two cases are deliberately indistinguishable to the caller.
 */
export const getAccessibleBoard = async (
  ctx: QueryCtx,
  identity: UserIdentity,
  id: Id<"boards">
): Promise<Doc<"boards"> | null> => {
  const board = await ctx.db.get(id);

  if (!board || board.orgId !== getActiveOrgId(identity)) {
    return null;
  }

  return board;
};

/** Like getAccessibleBoard, but throws instead of returning null. */
export const requireBoard = async (ctx: QueryCtx, id: Id<"boards">) => {
  const identity = await requireIdentity(ctx);
  const board = await getAccessibleBoard(ctx, identity, id);

  if (!board) {
    throw new Error("Board not found");
  }

  return { identity, board };
};
