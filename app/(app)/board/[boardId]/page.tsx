"use client";

import { use } from "react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Room } from "@/components/room";
import { Canvas } from "@/components/canvas/canvas";
import { Participants } from "@/components/canvas/participants";
import { CursorsPresence } from "@/components/canvas/cursors-presence";
import { LiveblocksBoardStoreProvider } from "@/lib/board-store/liveblocks-store";

import { Info } from "./_components/info";
import { Loading } from "./_components/loading";
import { BoardOrgSwitch } from "./_components/board-org-switch";

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

  // Not visible in the active org: switch to the board's org if the user is
  // a member of it, otherwise show "Board not found".
  if (board === null) {
    return <BoardOrgSwitch boardId={boardId} />;
  }

  return (
    <Room roomId={boardId} fallback={<Loading />}>
      <LiveblocksBoardStoreProvider>
        <Canvas
          header={<Info boardId={boardId} />}
          topRight={<Participants />}
          overlay={<CursorsPresence />}
        />
      </LiveblocksBoardStoreProvider>
    </Room>
  );
};

export default BoarIdPage;
