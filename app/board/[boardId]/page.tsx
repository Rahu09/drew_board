"use client";

import { use } from "react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Room } from "@/components/room";

import { Canvas } from "./_components/canvas";
import { Loading } from "./_components/loading";
import { BoardNotFound } from "./_components/board-not-found";

interface BoardIdPageProps {
  // Next.js 15+ passes route params as a Promise.
  params: Promise<{
    boardId: string;
  }>;
}

const BoarIdPage = ({ params }: BoardIdPageProps) => {
  const { boardId } = use(params);

  // Check the board before connecting to Liveblocks: a deleted, malformed or
  // other-org board would otherwise leave the canvas loading forever. This is
  // reactive, so it also kicks in if someone deletes the board while you are
  // on it.
  const board = useQuery(api.board.get, { id: boardId });

  if (board === undefined) {
    return <Loading />;
  }

  if (board === null) {
    return <BoardNotFound />;
  }

  return (
    <Room roomId={boardId} fallback={<Loading />}>
      <Canvas boardId={boardId} />
    </Room>
  );
};

export default BoarIdPage;
