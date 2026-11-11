import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import type { OptimisticLocalStore } from "convex/browser";
import type { FunctionReturnType } from "convex/server";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/*
 * Board mutations that show their result on the dashboard (and the board's
 * top bar) right away, before the server answers. Convex rolls the change
 * back by itself if the mutation fails.
 */

type BoardList = NonNullable<FunctionReturnType<typeof api.boards.get>>;
export type BoardListItem = BoardList[number];
type ListArgs = { orgId: string; search?: string; favorites?: string };

/** Ids of boards still being created; their cards can't be opened yet. */
export const OPTIMISTIC_ID_PREFIX = "optimistic:";

/** Rewrites every loaded board list. */
const updateLists = (
  store: OptimisticLocalStore,
  update: (list: BoardList, args: ListArgs) => BoardList
) => {
  for (const { args, value } of store.getAllQueries(api.boards.get)) {
    if (value) store.setQuery(api.boards.get, args, update(value, args));
  }
};

const findBoard = (store: OptimisticLocalStore, id: string) => {
  for (const { value } of store.getAllQueries(api.boards.get)) {
    const board = value?.find((item) => item._id === id);
    if (board) return board;
  }
};

export const useFavoriteBoard = () =>
  useMutation(api.board.favorite).withOptimisticUpdate((store, { id }) => {
    const board = findBoard(store, id);

    updateLists(store, (list, args) => {
      const marked = list.map((item) =>
        item._id === id ? { ...item, isFavorite: true } : item
      );
      // Newest favorite first, as the server lists them.
      return args.favorites &&
        !args.search &&
        board &&
        args.orgId === board.orgId &&
        !list.some((item) => item._id === id)
        ? [{ ...board, isFavorite: true }, ...marked]
        : marked;
    });
  });

export const useUnfavoriteBoard = () =>
  useMutation(api.board.unfavorite).withOptimisticUpdate((store, { id }) => {
    updateLists(store, (list, args) =>
      args.favorites
        ? list.filter((item) => item._id !== id)
        : list.map((item) =>
            item._id === id ? { ...item, isFavorite: false } : item
          )
    );
  });

export const useRenameBoard = () =>
  useMutation(api.board.update).withOptimisticUpdate((store, { id, title }) => {
    const trimmed = title.trim();
    if (!trimmed) return;

    updateLists(store, (list) =>
      list.map((item) => (item._id === id ? { ...item, title: trimmed } : item))
    );

    const board = store.getQuery(api.board.get, { id });
    if (board) store.setQuery(api.board.get, { id }, { ...board, title: trimmed });
  });

export const useRemoveBoard = () =>
  useMutation(api.board.remove).withOptimisticUpdate((store, { id }) => {
    updateLists(store, (list) => list.filter((item) => item._id !== id));
  });

/** A card for a board the server is still creating. */
const addCreatingBoard = (
  store: OptimisticLocalStore,
  { orgId, title }: { orgId: string; title: string },
  userId: string | null | undefined
) => {
  const now = Date.now();
  const board: BoardListItem = {
    _id: `${OPTIMISTIC_ID_PREFIX}${now}` as Id<"boards">,
    _creationTime: now,
    title,
    orgId,
    authorId: userId ?? "",
    authorName: "You",
    imageUrl: "",
    isFavorite: false,
    thumbnailUrl: null,
  };

  updateLists(store, (list, args) =>
    args.orgId === orgId && !args.favorites && !args.search
      ? [board, ...list]
      : list
  );
};

export const useCreateBoard = () => {
  const { userId } = useAuth();

  return useMutation(api.board.create).withOptimisticUpdate((store, args) =>
    addCreatingBoard(store, args, userId)
  );
};

/**
 * Creates an "Untitled" board in the workspace (its card shows at once) and
 * opens it once it exists.
 */
export const useCreateAndOpenBoard = (orgId: string) => {
  const router = useRouter();
  const create = useCreateBoard();
  const [pending, setPending] = useState(false);

  const createAndOpen = () => {
    setPending(true);
    create({ orgId, title: "Untitled" })
      .then((id) => router.push(`/board/${id}`))
      .catch(() => {
        setPending(false);
        toast.error("Failed to create board");
      });
  };

  return { createAndOpen, pending };
};
