"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { usePathname, useRouter } from "next/navigation";
import { Eye, Link2, Pencil, Trash2, Users } from "lucide-react";
import { DropdownMenuContentProps } from "@radix-ui/react-dropdown-menu";

import { ConfirmModal } from "@/components/confirm-modal";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "./ui/button";
import { useRename } from "@/store/use-rename";
import { useRemoveBoard } from "@/hooks/use-board-mutations";
import type { Id } from "@/convex/_generated/dataModel";
import { useShareModal } from "@/store/use-share-modal";
import { useShareLinkModal } from "@/store/use-share-link-modal";
import { isPersonalWorkspaceId } from "@/convex/workspace";

interface ActionsProps {
  children: React.ReactNode;
  side?: DropdownMenuContentProps["side"];
  sideOffset?: DropdownMenuContentProps["sideOffset"];
  id: string;
  title: string;
  /** The board's workspace; personal boards get "Share with a team". */
  orgId: string;
}

export const Actions = ({
  children,
  side,
  sideOffset,
  id,
  title,
  orgId,
}: ActionsProps) => {
  const startRename = useRename((state) => state.start);
  const shareModal = useShareModal();
  const shareLinkModal = useShareLinkModal();
  const remove = useRemoveBoard();
  // Rename starts once the menu has closed (it would take the focus back).
  const renaming = useRef(false);
  const onCopyLink = () => {
    navigator.clipboard
      .writeText(`${window.location.origin}/board/${id}`)
      .then(() => toast.success("Link copied"))
      .catch(() => toast.error("Failed to copy link"));
  };
  const router = useRouter();
  const pathname = usePathname();

  const onDelete = () => {
    // Deleting the board that is open: go back to the dashboard first, so the
    // page doesn't flash "Board not found" when the board disappears.
    if (pathname === `/board/${id}`) {
      router.push("/dashboard");
    }

    remove({ id: id as Id<"boards"> })
      .then(() => toast.success("Board deleted"))
      .catch(() => toast.error("Failed to delete board"));
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        onClick={(e) => e.stopPropagation()}
        onCloseAutoFocus={(e) => {
          if (!renaming.current) return;
          renaming.current = false;
          e.preventDefault();
          startRename(id);
        }}
        side={side}
        sideOffset={sideOffset}
        className="w-60"
      >
        <DropdownMenuItem onClick={onCopyLink} className="p-3 cursor-pointer">
          <Link2 className="h-4 w-4 mr-2" />
          Copy board link
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => shareLinkModal.onOpen(id)}
          className="p-3 cursor-pointer"
        >
          <Eye className="h-4 w-4 mr-2" />
          Read-only link
        </DropdownMenuItem>
        {isPersonalWorkspaceId(orgId) && (
          <DropdownMenuItem
            onClick={() => shareModal.onOpen(id, title)}
            className="p-3 cursor-pointer"
          >
            <Users className="h-4 w-4 mr-2" />
            Share with a team
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => {
            renaming.current = true;
          }}
          className="p-3 cursor-pointer"
        >
          <Pencil className="h-4 w-4 mr-2" />
          Rename
        </DropdownMenuItem>
        <ConfirmModal
          header="Delete board?"
          description="This will delete the board and all of its contents."
          onConfirm={onDelete}
        >
          <Button
            variant="ghost"
            className="p-3 cursor-pointer text-sm w-full justify-start font-normal"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </ConfirmModal>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
