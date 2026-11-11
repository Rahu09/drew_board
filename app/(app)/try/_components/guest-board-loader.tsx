"use client";

import dynamic from "next/dynamic";
import { Loader } from "lucide-react";

// The guest board reads localStorage as it starts, so it only renders in the
// browser.
const GuestBoard = dynamic(
  () => import("./guest-board").then((mod) => mod.GuestBoard),
  {
    ssr: false,
    loading: () => (
      <main className="h-full w-full bg-neutral-100 flex items-center justify-center">
        <Loader className="h-6 w-6 text-muted-foreground animate-spin" />
      </main>
    ),
  }
);

export const GuestBoardLoader = () => <GuestBoard />;
