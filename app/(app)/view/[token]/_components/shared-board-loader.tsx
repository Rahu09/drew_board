"use client";

import dynamic from "next/dynamic";
import { Loader } from "lucide-react";

import type { BoardSnapshot } from "@/lib/board-store/types";

// Like the guest board, the canvas only renders in the browser.
const SharedBoard = dynamic(
  () => import("./shared-board").then((mod) => mod.SharedBoard),
  {
    ssr: false,
    loading: () => (
      <main className="h-full w-full bg-white flex items-center justify-center">
        <Loader className="h-6 w-6 text-muted-foreground animate-spin" />
      </main>
    ),
  }
);

export const SharedBoardLoader = (props: {
  title: string;
  snapshot: BoardSnapshot;
}) => <SharedBoard {...props} />;
