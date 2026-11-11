import { auth, currentUser } from "@clerk/nextjs/server";
import { Liveblocks } from "@liveblocks/node";
import { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_API_KEY!,
});

export async function POST(request: Request) {
  const { userId, getToken } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return new Response("Unauthorized", { status: 403 });
  }

  const { room } = await request.json();

  if (typeof room !== "string" || !room) {
    return new Response("Missing room", { status: 400 });
  }

  // Ask Convex as the signed-in user, so board.get applies the same org check
  // as the rest of the app. A client per request: setAuth is per-client state
  // and must not be shared between concurrent requests.
  const token = await getToken({ template: "convex" });

  if (!token) {
    return new Response("Unauthorized", { status: 403 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token);

  const board = await convex.query(api.board.get, { id: room });

  if (!board) {
    return new Response("Unauthorized", { status: 403 });
  }

  const userInfo = {
    name: user.firstName || "Teammate",
    picture: user.imageUrl,
  };

  const session = liveblocks.prepareSession(user.id, { userInfo });
  session.allow(room, session.FULL_ACCESS);

  const { status, body } = await session.authorize();
  return new Response(body, { status });
}
