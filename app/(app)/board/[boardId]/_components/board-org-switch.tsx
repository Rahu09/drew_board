"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";

import { api } from "@/convex/_generated/api";

import { Loading } from "./loading";
import { BoardNotFound } from "./board-not-found";

interface BoardOrgSwitchProps {
  boardId: string;
}

/**
 * Shown when the board isn't visible in the active org. If the board belongs
 * to another org the user is a member of, switch to that org; the board page
 * then picks the board up on its own once the new org reaches Convex.
 * Otherwise show "Board not found".
 */
export const BoardOrgSwitch = ({ boardId }: BoardOrgSwitchProps) => {
  const { organization } = useOrganization();
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { pageSize: 100 },
  });
  const [failedOrgId, setFailedOrgId] = useState<string | null>(null);

  const memberships = userMemberships.data;
  const orgIds = memberships?.map((membership) => membership.organization.id);

  // Includes the active org on purpose: right after a switch, the active org
  // is already the board's org while Convex still has the old token. Then
  // this keeps returning the board's org (keep waiting) instead of null
  // (which would flash "Board not found").
  const targetOrgId = useQuery(
    api.board.findOrg,
    isLoaded && orgIds ? { id: boardId, orgIds } : "skip"
  );

  const needsSwitch =
    typeof targetOrgId === "string" &&
    targetOrgId !== organization?.id &&
    targetOrgId !== failedOrgId;

  useEffect(() => {
    if (!needsSwitch || !setActive) return;

    const switchOrg = () => {
      setActive({ organization: targetOrgId }).catch(() =>
        setFailedOrgId(targetOrgId)
      );
    };

    // Clerk only writes the active org to its cookies from a focused tab
    // (so a background tab can't change another tab's org). Switching from
    // a background tab, e.g. a link opened with middle-click, would change
    // the org in this tab's memory only, and Convex would keep getting
    // tokens for the old org. So wait until the tab has focus.
    if (document.hasFocus()) {
      switchOrg();
      return;
    }

    window.addEventListener("focus", switchOrg, { once: true });
    return () => window.removeEventListener("focus", switchOrg);
  }, [needsSwitch, setActive, targetOrgId]);

  // Still loading the memberships or the lookup.
  if (!isLoaded || !orgIds || targetOrgId === undefined) {
    return <Loading />;
  }

  // Switching, or switched and waiting for Convex to see the new org.
  if (targetOrgId && targetOrgId !== failedOrgId) {
    return <Loading />;
  }

  return <BoardNotFound />;
};
