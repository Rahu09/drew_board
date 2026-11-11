import { useAuth, useOrganization } from "@clerk/nextjs";

import { personalWorkspaceId } from "@/convex/workspace";

export type Workspace = {
  /** The active org's id, or the user's personal workspace id. */
  id: string;
  isPersonal: boolean;
};

/**
 * The workspace whose boards the dashboard shows: the active organization,
 * or the user's personal boards when no organization is active.
 * Null while Clerk is still loading.
 */
export const useWorkspace = (): Workspace | null => {
  const { userId } = useAuth();
  const { isLoaded, organization } = useOrganization();

  if (!isLoaded || !userId) {
    return null;
  }

  return organization
    ? { id: organization.id, isPersonal: false }
    : { id: personalWorkspaceId(userId), isPersonal: true };
};
