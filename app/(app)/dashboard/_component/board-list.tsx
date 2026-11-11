"use client";

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Workspace } from "@/hooks/use-workspace";
import { EmptySearch } from "./empty-search";
import { EmptyFavorites } from "./empty-favorites";
import { EmptyBoards } from "./empty-boards";

import { BoardCard } from "./board-card";
import { NewBoardButton } from "./new-board-button";

interface BoardListProps {
  workspace: Workspace;
  query: {
    search?: string;
    favorites?: string;
  };
}

export const BoardList = ({ workspace, query }: BoardListProps) => {
  const orgId = workspace.id;
  const data = useQuery(api.boards.get, {
    orgId,
    ...query,
  });
  const title = query.favorites
    ? "Favorite boards"
    : workspace.isPersonal
      ? "Your boards"
      : "Team boards";

  // undefined: still loading. null: the org switch has not reached Convex yet.
  if (data === undefined || data === null) {
    return (
      <div>
        <h2 className="text-3xl">{title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5 mt-8 pb-10">
          <NewBoardButton orgId={orgId} disabled />
          <BoardCard.Skeleton />
          <BoardCard.Skeleton />
          <BoardCard.Skeleton />
          <BoardCard.Skeleton />
        </div>
      </div>
    );
  }

  if (!data?.length && query.search) {
    return (
      <div>
        <EmptySearch />
      </div>
    );
  }

  if (!data?.length && query.favorites) {
    return (
      <div>
        <EmptyFavorites />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div>
        <EmptyBoards workspace={workspace} />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5 mt-8 pb-10">
        <NewBoardButton orgId={orgId} />
        {data?.map((board) => (
          <BoardCard
            key={board._id}
            id={board._id}
            title={board.title}
            imageUrl={board.imageUrl}
            authorId={board.authorId}
            authorName={board.authorName}
            createdAt={board._creationTime}
            orgId={board.orgId}
            isFavorite={board.isFavorite}
          />
        ))}
      </div>
    </div>
  );
};
