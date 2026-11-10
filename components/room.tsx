"use client";

import { ReactNode } from "react";
import { LiveList, LiveMap } from "@liveblocks/client";
import {
  ClientSideSuspense,
  LiveblocksProvider,
} from "@liveblocks/react/suspense";

import { RoomProvider } from "@/liveblocks.config";

interface roomProps {
  children: ReactNode;
  roomId: string;
  fallback: NonNullable<ReactNode> | null;
}

export const Room = ({ children, roomId, fallback }: roomProps) => {
  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth" throttle={16}>
      <RoomProvider
        id={roomId}
        initialPresence={{
          cursor: null,
          selection: [],
          pencilDraft: null,
          penColor: null,
        }}
        initialStorage={{
          layers: new LiveMap(),
          layerIds: new LiveList([]),
        }}
      >
        <ClientSideSuspense fallback={fallback}>{children}</ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
};
