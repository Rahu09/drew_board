// A board belongs to a "workspace": an organization or a single user.
//
// The boards and userFavorites tables store it in their `orgId` field:
// - an organization: the Clerk org id ("org_...")
// - personal boards: "user:" + the Clerk user id
// Clerk org ids always start with "org_", so the two never collide.
//
// This file has no Convex imports, so the Next.js app can use it too.

const PERSONAL_PREFIX = "user:";

export const personalWorkspaceId = (userId: string) =>
  `${PERSONAL_PREFIX}${userId}`;

export const isPersonalWorkspaceId = (workspaceId: string) =>
  workspaceId.startsWith(PERSONAL_PREFIX);

/**
 * ConvexError data of board.moveToOrg when the target org is not active in
 * the caller's token yet (the client switches org first; see the share
 * modal).
 */
export const ORG_NOT_ACTIVE = "ORG_NOT_ACTIVE";
