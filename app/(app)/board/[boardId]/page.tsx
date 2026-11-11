"use client";

import { use } from "react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Room } from "@/components/room";
import { Canvas } from "@/components/canvas/canvas";
import { CursorsPresence } from "@/components/canvas/cursors-presence";
import { LiveblocksBoardStoreProvider } from "@/lib/board-store/liveblocks-store";

import { BoardMenuItems, BoardTitle, Info } from "./_components/info";
import { useShareDialog } from "@/store/use-share-dialog";
import { Loading } from "./_components/loading";
import { ThumbnailSync } from "./_components/thumbnail-sync";
import { BoardOrgSwitch } from "./_components/board-org-switch";
import {
  BoardComments,
  BoardCommentsList,
} from "./_components/board-comments";
import { useUploadBoardImage } from "@/hooks/use-upload-board-image";

const openShare = () => useShareDialog.getState().setOpen(true);

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
  const uploadImage = useUploadBoardImage(boardId);

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
        <ThumbnailSync boardId={board._id} missing={!board.thumbnailId} />
        <Canvas
          home={{ href: "/dashboard", label: "Go to boards" }}
          title={<BoardTitle boardId={boardId} />}
          menuItems={<BoardMenuItems boardId={boardId} />}
          onShare={openShare}
          topRight={<Info boardId={boardId} />}
          overlay={<CursorsPresence />}
          uploadImage={uploadImage}
          comments={(slot) => <BoardComments boardId={boardId} {...slot} />}
          commentsList={(slot) => (
            <BoardCommentsList boardId={boardId} {...slot} />
          )}
          exportName={board.title}
        />
      </LiveblocksBoardStoreProvider>
    </Room>
  );
};

export default BoarIdPage;
