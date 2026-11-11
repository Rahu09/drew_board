"use client";

import { toast } from "sonner";
import { useOrganization } from "@clerk/nextjs";
import { Eye, Link2, Users } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useShareModal } from "@/store/use-share-modal";
import { useShareLinkModal } from "@/store/use-share-link-modal";
import { useShareDialog } from "@/store/use-share-dialog";
import { useOthers } from "@/liveblocks.config";
import { isPersonalWorkspaceId } from "@/convex/workspace";

interface ShareDialogProps {
  board: { _id: string; title: string; orgId: string };
}

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-xl font-semibold text-indigo-600">{children}</h3>
);

/**
 * Share, at the top right of a board: live collaboration (everyone in the
 * board's team edits it together) or a read-only link anyone can open.
 */
export const ShareDialog = ({ board }: ShareDialogProps) => {
  const { isOpen: open, setOpen } = useShareDialog();
  // Everyone here now, you included, shown on the button.
  const people = useOthers((others) => others.length) + 1;
  const { organization } = useOrganization();
  const shareModal = useShareModal();
  const shareLinkModal = useShareLinkModal();
  const isPersonal = isPersonalWorkspaceId(board.orgId);

  const copyLink = () => {
    navigator.clipboard
      .writeText(`${window.location.origin}/board/${board._id}`)
      .then(() => toast.success("Link copied"))
      .catch(() => toast.error("Failed to copy link"));
  };

  // The next dialogs open once this one has closed.
  const then = (next: () => void) => {
    setOpen(false);
    requestAnimationFrame(next);
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        // Phones have "Live collaboration…" in the menu instead.
        className="relative h-9 rounded-lg bg-indigo-500 px-4 text-white hover:bg-indigo-600 max-sm:hidden"
      >
        Share
        {people > 1 && (
          <span
            aria-label={`${people} people here`}
            className="absolute -bottom-1.5 -right-1.5 min-w-5 h-5 rounded-full border-2 border-white bg-emerald-400 px-1 text-[11px] font-semibold leading-4 text-white"
          >
            {people}
          </span>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg px-8 py-10 text-center data-[state=open]:slide-in-from-right-16 data-[state=open]:slide-in-from-top-16 data-[state=closed]:slide-out-to-right-16 data-[state=closed]:slide-out-to-top-16">
          <DialogTitle className="sr-only">Share this board</DialogTitle>
          <DialogDescription className="sr-only">
            Edit it live with your team, or share a read-only link.
          </DialogDescription>

          <section className="space-y-3">
            <Heading>Live collaboration</Heading>
            {isPersonal ? (
              <>
                <p className="text-sm text-neutral-600">
                  This board is in your personal space, so only you can open
                  it. Move it to a team to edit it together, live.
                </p>
                <Button
                  className="mt-2 bg-indigo-500 hover:bg-indigo-600"
                  onClick={() =>
                    then(() => shareModal.onOpen(board._id, board.title))
                  }
                >
                  <Users />
                  Share with a team
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-neutral-600">
                  Everyone in{" "}
                  <span className="font-medium text-neutral-800">
                    {organization?.name ?? "this team"}
                  </span>{" "}
                  can open this board and edit it with you, live. Send them
                  the link.
                </p>
                <Button
                  className="mt-2 bg-indigo-500 hover:bg-indigo-600"
                  onClick={copyLink}
                >
                  <Link2 />
                  Copy board link
                </Button>
              </>
            )}
          </section>

          <div className="my-6 flex items-center gap-x-4 text-sm text-neutral-500">
            <div className="h-px flex-1 bg-neutral-200" />
            Or
            <div className="h-px flex-1 bg-neutral-200" />
          </div>

          <section className="space-y-3">
            <Heading>Read-only link</Heading>
            <p className="text-sm text-neutral-600">
              Anyone with the link can look at the board without signing in,
              but not change it.
            </p>
            <Button
              className="mt-2 bg-indigo-500 hover:bg-indigo-600"
              onClick={() => then(() => shareLinkModal.onOpen(board._id))}
            >
              <Eye />
              Read-only link
            </Button>
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
};
