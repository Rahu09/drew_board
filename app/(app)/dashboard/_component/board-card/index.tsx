"use client";

import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { MoreHorizontal } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { cn } from "@/lib/utils";
import { Actions } from "@/components/actions";
import { Skeleton } from "@/components/ui/skeleton";
import {
  OPTIMISTIC_ID_PREFIX,
  useFavoriteBoard,
  useUnfavoriteBoard,
  type BoardListItem,
} from "@/hooks/use-board-mutations";

import { Footer } from "./footer";
import { Overlay } from "./overlay";

interface BoardCardProps {
  board: BoardListItem;
}

export const BoardCard = ({ board }: BoardCardProps) => {
  const { userId } = useAuth();
  const favorite = useFavoriteBoard();
  const unfavorite = useUnfavoriteBoard();
  const id = board._id;
  // Just created: shown at once, but there's no board to open yet.
  const isPending = id.startsWith(OPTIMISTIC_ID_PREFIX);

  const person = (personId: string | undefined, name: string | undefined) =>
    personId === userId ? "You" : (name ?? "Someone");
  const metaLabel = board.lastEditedAt
    ? `Edited by ${person(board.lastEditorId, board.lastEditorName)}, ${formatDistanceToNow(board.lastEditedAt, { addSuffix: true })}`
    : `Created by ${person(board.authorId, board.authorName)}, ${formatDistanceToNow(board._creationTime, { addSuffix: true })}`;

  const toggleFavorite = () => {
    if (board.isFavorite) {
      unfavorite({ id }).catch(() => toast.error("Failed to unfavorite"));
    } else {
      favorite({ id }).catch(() => toast.error("Failed to favorite"));
    }
  };

  return (
    <div
      className={cn(
        "group relative aspect-100/127 rounded-lg border bg-card flex flex-col overflow-hidden",
        "has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-indigo-500 has-[a:focus-visible]:ring-offset-2 ring-offset-background",
        isPending && "opacity-60 pointer-events-none"
      )}
      aria-busy={isPending || undefined}
    >
      {/*
        The whole card opens the board (first in tab order); the buttons sit
        above this link, not inside it, where keyboards and screen readers
        couldn't use them.
      */}
      {!isPending && (
        <Link
          href={`/board/${id}`}
          aria-label={board.title}
          className="absolute inset-0 z-[1] rounded-lg outline-none"
        />
      )}
      <div className="relative flex-1 bg-amber-50">
        {board.thumbnailUrl ? (
          <Image
            src={board.thumbnailUrl}
            alt=""
            fill
            unoptimized
            className="object-cover bg-white"
          />
        ) : (
          board.imageUrl && (
            <Image src={board.imageUrl} alt="" fill className="object-cover" />
          )
        )}
        <Overlay />
      </div>
      <Footer
        id={id}
        title={board.title}
        metaLabel={metaLabel}
        isFavorite={board.isFavorite}
        onToggleFavorite={toggleFavorite}
      />
      <Actions id={id} title={board.title} orgId={board.orgId} side="right">
        <button
          type="button"
          aria-label={`Actions for ${board.title}`}
          className="absolute top-1.5 right-1.5 z-10 rounded-md bg-black/25 px-2 py-1 outline-none hover:bg-black/40 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="text-white drop-shadow opacity-90 hover:opacity-100" />
        </button>
      </Actions>
    </div>
  );
};

BoardCard.Skeleton = function BoardCardSkeleton() {
  return (
    <div className="aspect-100/127 rounded-lg overflow-hidden">
      <Skeleton className="h-full w-full" />
    </div>
  );
};
