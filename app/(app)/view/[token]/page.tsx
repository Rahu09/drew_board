import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Liveblocks } from "@liveblocks/node";
import { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";
import { parseSnapshot } from "@/lib/board-store/validate";
import type { BoardSnapshot } from "@/lib/board-store/types";

import { SharedBoardLoader } from "./_components/shared-board-loader";

interface ViewPageProps {
  params: Promise<{ token: string }>;
}

const EMPTY_BOARD: BoardSnapshot = { layers: {}, layerIds: [] };
/** The board behind a read-only link, or null. Once per request. */
const getSharedBoard = cache(async (token: string) => {
  // No auth: the secret token in the link is the permission.
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  return await convex.query(api.board.getShared, { token });
});

/**
 * The board as last saved in Liveblocks. Read through the REST API, so
 * viewers don't join the room (no live updates, no extra Liveblocks users).
 * A board nobody has drawn on yet has no room: that is an empty board.
 */
const getBoardContent = async (boardId: string) => {
  const liveblocks = new Liveblocks({
    secret: process.env.LIVEBLOCKS_API_KEY!,
  });

  try {
    const storage = await liveblocks.getStorageDocument(boardId, "json");
    return parseSnapshot(storage) ?? EMPTY_BOARD;
  } catch {
    return EMPTY_BOARD;
  }
};

export async function generateMetadata({
  params,
}: ViewPageProps): Promise<Metadata> {
  const { token } = await params;
  const board = await getSharedBoard(token);

  return {
    title: board?.title ?? "Board not found",
    // Links are private: keep them out of search engines and link previews.
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

// Read-only link: anyone with it can look at the board. Public (proxy.ts).
export default async function ViewPage({ params }: ViewPageProps) {
  const { token } = await params;
  const board = await getSharedBoard(token);

  if (!board) {
    notFound();
  }

  const snapshot = await getBoardContent(board._id);

  return <SharedBoardLoader title={board.title} snapshot={snapshot} />;
}
