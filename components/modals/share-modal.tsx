"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader, Plus, Users } from "lucide-react";
import { ConvexError } from "convex/values";
import { useMutation } from "convex/react";
import { useClerk, useOrganizationList } from "@clerk/nextjs";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ORG_NOT_ACTIVE } from "@/convex/workspace";
import { useShareModal } from "@/store/use-share-modal";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs the move once Convex sees the newly active org. setActive resolves
 * before the Convex client has re-authenticated with the new org's token,
 * so the first tries can be refused with ORG_NOT_ACTIVE.
 */
const retryUntilOrgActive = async <T,>(run: () => Promise<T>) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const notActiveYet =
        error instanceof ConvexError && error.data === ORG_NOT_ACTIVE;

      if (!notActiveYet || attempt === 8) throw error;
      await sleep(250 * attempt);
    }
  }
};

/**
 * Shares a personal board by moving it into one of the user's
 * organizations, or creating one first.
 */
export const ShareModal = () => {
  const clerk = useClerk();
  const { isOpen, onClose, initialValues } = useShareModal();
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { pageSize: 100 },
  });
  const moveToOrg = useMutation(api.board.moveToOrg);
  const [pendingOrgId, setPendingOrgId] = useState<string | null>(null);

  const memberships = userMemberships.data ?? [];

  const onMove = async (org: { id: string; name: string }) => {
    if (!setActive) return;

    setPendingOrgId(org.id);

    try {
      // The board moves into the active org (see board.moveToOrg).
      await setActive({ organization: org.id });
      await retryUntilOrgActive(() =>
        moveToOrg({ id: initialValues.id as Id<"boards">, orgId: org.id })
      );

      onClose();
      toast.success(`Moved to ${org.name}. Everyone in it can open the board.`, {
        action: {
          label: "Invite people",
          onClick: () => clerk.openOrganizationProfile(),
        },
      });
    } catch {
      toast.error("Couldn't move the board. It is still in your personal boards.");
    } finally {
      setPendingOrgId(null);
    }
  };

  const onCreateTeam = () => {
    const boardId = initialValues.id;

    onClose();
    // Back on the board with this dialog open, to move it into the new team.
    clerk.openCreateOrganization({
      afterCreateOrganizationUrl: `/board/${boardId}?share=1`,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share with a team</DialogTitle>
          <DialogDescription>
            &ldquo;{initialValues.title}&rdquo; is a personal board, so only you
            can see it. Move it to a team and everyone in the team can open and
            edit it. It then leaves your personal boards.
          </DialogDescription>
        </DialogHeader>

        {!isLoaded || userMemberships.isLoading ? (
          <div className="flex justify-center py-4">
            <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ul className="space-y-1">
            {memberships.map(({ organization }) => (
              <li key={organization.id}>
                <Button
                  variant="ghost"
                  className="w-full justify-start h-auto py-2"
                  disabled={pendingOrgId !== null}
                  onClick={() =>
                    onMove({ id: organization.id, name: organization.name })
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={organization.imageUrl}
                    alt=""
                    className="h-7 w-7 rounded-md mr-3"
                  />
                  <span className="flex-1 text-left truncate">
                    Move to {organization.name}
                  </span>
                  {pendingOrgId === organization.id ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </li>
            ))}
            <li>
              <Button
                variant="ghost"
                className="w-full justify-start h-auto py-2"
                disabled={pendingOrgId !== null}
                onClick={onCreateTeam}
              >
                <span className="h-7 w-7 rounded-md mr-3 border border-dashed flex items-center justify-center">
                  <Plus className="h-4 w-4" />
                </span>
                Create a team
              </Button>
            </li>
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
};
