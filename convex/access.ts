import type { UserIdentity } from "convex/server";

import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { personalWorkspaceId } from "./workspace";

/**
 * The org the user currently has active in Clerk.
 *
 * Comes from the `org_id` claim of Clerk's "convex" JWT template, which
 * Clerk refreshes whenever the user switches organization. Undefined when
 * the user is in their personal account.
 */
export const getActiveOrgId = (identity: UserIdentity): string | undefined =>
  typeof identity.org_id === "string" && identity.org_id
    ? identity.org_id
    : undefined;

/**
 * Whether the caller may use boards of this workspace (see workspace.ts):
 * their own personal workspace always, an org only while it is active.
 */
export const canAccessWorkspace = (
  identity: UserIdentity,
  workspaceId: string
) =>
  workspaceId === personalWorkspaceId(identity.subject) ||
  workspaceId === getActiveOrgId(identity);

export const requireIdentity = async (ctx: QueryCtx) => {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Unauthorized");
  }

  return identity;
};

/**
 * Throws unless the caller may use the workspace: it is their personal one,
 * or the org that is active in their token.
 */
export const requireWorkspaceAccess = async (
  ctx: QueryCtx,
  workspaceId: string
) => {
  const identity = await requireIdentity(ctx);

  if (!canAccessWorkspace(identity, workspaceId)) {
    throw new Error("Unauthorized");
  }

  return identity;
};

/**
 * Loads a board the caller is allowed to use, or returns null when the board
 * does not exist or belongs to a workspace the caller can't use (another
 * user's personal boards, or an org other than the active one). The cases
 * are deliberately indistinguishable to the caller.
 */
export const getAccessibleBoard = async (
  ctx: QueryCtx,
  identity: UserIdentity,
  id: Id<"boards">
): Promise<Doc<"boards"> | null> => {
  const board = await ctx.db.get(id);

  if (!board || !canAccessWorkspace(identity, board.orgId)) {
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
