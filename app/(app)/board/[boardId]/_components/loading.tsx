"use client";

import { Loader } from "lucide-react";

import { ToolbarSkeleton } from "@/components/canvas/toolbar";

/** The board's layout, empty, while it loads. */
export const Loading = () => {
  return (
    <main className="h-full w-full relative bg-white touch-none flex items-center justify-center">
      <Loader className="h-6 w-6 text-muted-foreground animate-spin" />
      <div className="absolute top-2 left-2 h-11 w-[180px] rounded-xl border border-neutral-200 bg-white shadow-md" />
      <div className="absolute top-2 right-2 flex items-center gap-x-2">
        <div className="h-9 w-[76px] rounded-lg bg-indigo-100" />
        <div className="h-9 w-9 rounded-lg bg-neutral-100" />
      </div>
      <div className="absolute left-2 bottom-[62px] lg:bottom-2 flex gap-x-2">
        <div className="h-9 w-[124px] rounded-lg bg-[#ececf4]" />
        <div className="h-9 w-[76px] rounded-lg bg-[#ececf4]" />
      </div>
      <ToolbarSkeleton />
    </main>
  );
};
