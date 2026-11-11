import type { LiveList, LiveMap, LiveObject } from "@liveblocks/client";

import { Layer, Color, View } from "@/types/canvas";

// Liveblocks v2+ types the whole app through this global interface instead of
// generics passed to createRoomContext.
declare global {
  interface Liveblocks {
    // Presence represents the properties that exist on every user in the Room
    // and that will automatically be kept in sync. Must be JSON-serializable.
    Presence: {
      cursor: { x: number; y: number } | null;
      selection: string[];
      pencilDraft: [x: number, y: number, pressure: number][] | null;
      penColor: Color | null;
      /** What this user is looking at, so others can follow them. */
      view: View | null;
      /** Laser pointer trail, oldest point first. */
      laser: [x: number, y: number][] | null;
    };

    // Storage represents the shared document that persists in the Room, even
    // after all users leave.
    Storage: {
      layers: LiveMap<string, LiveObject<Layer>>;
      layerIds: LiveList<string>;
      /** Canvas color, "#rrggbb"; none is white. */
      background?: string;
    };

    // Static/readonly metadata on each user, as provided by
    // app/api/liveblocks-auth/route.ts.
    UserMeta: {
      id?: string;
      info?: {
        name?: string;
        picture?: string;
      };
    };
  }
}

// Room-level hooks (suspense versions), use inside `RoomProvider`.
export {
  RoomProvider,
  useRoom,
  useMyPresence,
  useUpdateMyPresence,
  useSelf,
  useOthers,
  useOthersMapped,
  useOthersListener,
  useOthersConnectionIds,
  useOther,
  useBroadcastEvent,
  useEventListener,
  useErrorListener,
  useStorage,
  useHistory,
  useUndo,
  useRedo,
  useCanUndo,
  useCanRedo,
  useMutation,
  useStatus,
  useLostConnectionListener,
} from "@liveblocks/react/suspense";
