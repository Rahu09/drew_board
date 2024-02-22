"use client";

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { EmptySearch } from "./empty-search";
import { EmptyFavorites } from "./empty-favorites";
import { EmptyBoards } from "./empty-boards";

// import { BoardCard } from "./board-card";
// import { EmptySearch } from "./empty-search";
// import { EmptyBoards } from "./empty-boards";
// import { EmptyFavorites } from "./empty-favorites";
// import { NewBoardButton } from "./new-board-button";

interface BoardListProps {
  orgId: string;
  query: {
    search?: string;
    favorites?: string;
  };
}

export const BoardList = ({ orgId, query }: BoardListProps) => {
  const data = [];

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
        <EmptyBoards />
      </div>
    );
  }

  return <div>{JSON.stringify(query)}</div>;
};
