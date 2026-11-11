import { auth } from "@clerk/nextjs/server";
import { Liveblocks } from "@liveblocks/node";
import { ConvexHttpClient } from "convex/browser";
import type { PlainLsonObject } from "@liveblocks/client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { personalWorkspaceId } from "@/convex/workspace";
import { parseSnapshot } from "@/lib/board-store/validate";
import type { BoardSnapshot } from "@/lib/board-store/types";

// Saves a guest board (from /try) as a personal board of the signed-in user:
// creates the board in Convex, then writes its content into the new board's
// Liveblocks room (the room id is the board id, see components/room.tsx).

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_API_KEY!,
});

// 100 layers with long pen strokes fit comfortably.
const MAX_BODY_BYTES = 2_000_000;
const MAX_TITLE_LENGTH = 60;

/** The Liveblocks Storage document for a board (see liveblocks.config.ts). */
const toStorageDocument = ({
  layers,
  layerIds,
}: BoardSnapshot): PlainLsonObject => ({
  liveblocksType: "LiveObject",
  data: {
    layers: {
      liveblocksType: "LiveMap",
      data: Object.fromEntries(
        layerIds.map((id) => [
          id,
          { liveblocksType: "LiveObject", data: layers[id] },
        ])
      ),
    },
    layerIds: { liveblocksType: "LiveList", data: layerIds },
  },
});

export async function POST(request: Request) {
  const { userId, getToken } = await auth();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const raw = await request.text();

  if (raw.length > MAX_BODY_BYTES) {
    return new Response("Board too large", { status: 413 });
  }

  let body: { snapshot?: unknown; title?: unknown };

  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const snapshot = parseSnapshot(body.snapshot);

  if (!snapshot) {
    return new Response("Invalid board", { status: 400 });
  }

  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, MAX_TITLE_LENGTH)
      : "Untitled";

  // Act as the user, so Convex applies its normal access rules.
  const token = await getToken({ template: "convex" });

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token);

  const boardId: Id<"boards"> = await convex.mutation(api.board.create, {
    orgId: personalWorkspaceId(userId),
    title,
  });

  try {
    // Access is granted per session in /api/liveblocks-auth, so the room
    // itself gives nobody access.
    await liveblocks.createRoom(boardId, { defaultAccesses: [] });
    await liveblocks.initializeStorageDocument(
      boardId,
      toStorageDocument(snapshot)
    );
  } catch (error) {
    console.error("Saving guest board to Liveblocks failed", error);

    // Don't leave an empty board behind. This also schedules deleting the
    // Liveblocks room, if it was created.
    await convex
      .mutation(api.board.remove, { id: boardId })
      .catch((removeError) =>
        console.error("Removing the half-saved board failed", removeError)
      );

    return new Response("Could not save the board", { status: 502 });
  }

  return Response.json({ id: boardId });
}
