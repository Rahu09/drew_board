import type { Metadata } from "next";

import { GuestBoardLoader } from "./_components/guest-board-loader";

export const metadata: Metadata = {
  title: "Try it",
  description:
    "Draw on a whiteboard right now, no account needed. Sign in when you want to save it.",
};

// Guest mode: a board saved in this browser. Public (see proxy.ts).
export default function TryPage() {
  return <GuestBoardLoader />;
}
