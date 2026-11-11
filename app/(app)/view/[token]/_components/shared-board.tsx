"use client";

import { Eye } from "lucide-react";

import { Canvas } from "@/components/canvas/canvas";
import { LocalBoardStoreProvider } from "@/lib/board-store/local-store";
import type { BoardSnapshot } from "@/lib/board-store/types";

const SharedTitle = ({ title }: { title: string }) => (
  <div className="min-w-0 px-2 flex items-center gap-x-2">
    <h1 className="text-sm truncate">{title}</h1>
    <span className="shrink-0 inline-flex items-center gap-x-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-muted-foreground">
      <Eye className="h-3 w-3" />
      View only
    </span>
  </div>
);

/** A board opened from a read-only link, as it was when the page loaded. */
export const SharedBoard = ({
  title,
  snapshot,
}: {
  title: string;
  snapshot: BoardSnapshot;
}) => (
  <LocalBoardStoreProvider initial={snapshot} persist={false}>
    <Canvas
      readOnly
      home={{ href: "/", label: "Home" }}
      title={<SharedTitle title={title} />}
      exportName={title}
    />
  </LocalBoardStoreProvider>
);
