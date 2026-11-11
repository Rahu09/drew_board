"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useQuery } from "convex/react";
import { Eye, Link2, Pencil, Trash2, Users } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Hint } from "@/components/hints";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/confirm-modal";
import { api } from "@/convex/_generated/api";
import { useRename } from "@/store/use-rename";
import { useRemoveBoard } from "@/hooks/use-board-mutations";
import { InlineTitleInput } from "@/components/inline-title";
import { useShareModal } from "@/store/use-share-modal";
import { useShareLinkModal } from "@/store/use-share-link-modal";
import { isPersonalWorkspaceId } from "@/convex/workspace";
import { Participants } from "@/components/canvas/participants";
import { MenuRow, runAfterMenuClose } from "@/components/canvas/main-menu";

import { ShareDialog } from "./share-dialog";

interface InfoProps {
  boardId: string;
}

/** Top left, after the menu button: the board's name (click to rename). */
export const BoardTitle = ({ boardId }: InfoProps) => {
  const isEditing = useRename((state) => state.editingId === boardId);
  const startRename = useRename((state) => state.start);
  const data = useQuery(api.board.get, { id: boardId });

  if (!data) {
    return <div className="mx-2 h-4 w-24 rounded bg-neutral-100" />;
  }

  if (isEditing) {
    return (
      <InlineTitleInput
        id={data._id}
        title={data.title}
        className="mx-1 h-8 w-[40vw] sm:w-60 text-sm"
      />
    );
  }

  return (
    <Hint label="Rename" side="bottom" sideOffset={10}>
      <button
        type="button"
        onClick={() => startRename(data._id)}
        className="h-9 min-w-0 max-w-[40vw] sm:max-w-60 truncate rounded-lg px-2 text-sm hover:bg-neutral-100"
      >
        {data.title}
      </button>
    </Hint>
  );
};

/** The board's own items in the menu: links, rename, delete. */
export const BoardMenuItems = ({ boardId }: InfoProps) => {
  const data = useQuery(api.board.get, { id: boardId });
  const startRename = useRename((state) => state.start);
  const shareModal = useShareModal();
  const shareLinkModal = useShareLinkModal();
  const removeBoard = useRemoveBoard();
  const router = useRouter();

  if (!data) return null;

  const copyLink = () => {
    navigator.clipboard
      .writeText(`${window.location.origin}/board/${data._id}`)
      .then(() => toast.success("Link copied"))
      .catch(() => toast.error("Failed to copy link"));
  };

  const remove = () => {
    // Leave first, so the page doesn't flash "Board not found".
    router.push("/dashboard");
    removeBoard({ id: data._id })
      .then(() => toast.success("Board deleted"))
      .catch(() => toast.error("Failed to delete board"));
  };

  return (
    <>
      <MenuRow icon={Link2} label="Copy board link" onSelect={copyLink} />
      <MenuRow
        icon={Eye}
        label="Read-only link"
        onSelect={() => shareLinkModal.onOpen(data._id)}
      />
      {isPersonalWorkspaceId(data.orgId) && (
        <MenuRow
          icon={Users}
          label="Share with a team"
          onSelect={() => shareModal.onOpen(data._id, data.title)}
        />
      )}
      <MenuRow
        icon={Pencil}
        label="Rename"
        onSelect={() => runAfterMenuClose(() => startRename(data._id))}
      />
      <ConfirmModal
        header="Delete board?"
        description="This will delete the board and all of its contents."
        onConfirm={remove}
      >
        <Button
          variant="ghost"
          className="h-9 w-full justify-start gap-x-3 px-2.5 font-normal text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          Delete board
        </Button>
      </ConfirmModal>
    </>
  );
};

/**
 * Top right of a live board: who else is here, and Share. (The canvas adds
 * the sidebar button after it.)
 */
export const Info = ({ boardId }: InfoProps) => {
  const data = useQuery(api.board.get, {
    id: boardId,
  });

  useShareOnLoad(data);

  if (!data) return <InfoSkeleton />;

  return (
    <>
      <Participants />
      <ShareDialog board={data} />
    </>
  );
};

/**
 * Opens "Share with a team" for links ending in ?share=1 (Share on /try,
 * or back from creating a team), once the board has loaded.
 */
const useShareOnLoad = (
  board: { _id: string; title: string; orgId: string } | null | undefined
) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { onOpen } = useShareModal();
  const wantsShare = searchParams.get("share") === "1";

  useEffect(() => {
    if (!wantsShare || !board) return;

    router.replace(pathname);
    if (isPersonalWorkspaceId(board.orgId)) {
      onOpen(board._id, board.title);
    }
  }, [wantsShare, board, router, pathname, onOpen]);
};

export const InfoSkeleton = () => {
  return <div className="h-9 w-[76px] rounded-lg bg-indigo-100" />;
};
