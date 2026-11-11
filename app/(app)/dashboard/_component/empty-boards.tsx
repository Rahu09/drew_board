"use client";

import Image from "next/image";
import type { Workspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { useCreateAndOpenBoard } from "@/hooks/use-board-mutations";

interface EmptyBoardsProps {
  workspace: Workspace;
}

export const EmptyBoards = ({ workspace }: EmptyBoardsProps) => {
  const { createAndOpen: onClick, pending } = useCreateAndOpenBoard(workspace.id);

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-10">
      <Image src="/note.svg" height={110} width={110} alt="Empty" />
      <h2 className="text-2xl font-semibold mt-6">Create your first board!</h2>
      <p className="text-muted-foreground text-sm mt-2">
        {workspace.isPersonal
          ? "Start by creating a board of your own"
          : "Start by creating a board for your organization"}
      </p>

      <div className="mt-6">
        <Button disabled={pending} onClick={onClick} size="lg">
          Create board
        </Button>
      </div>
    </div>
  );
};
