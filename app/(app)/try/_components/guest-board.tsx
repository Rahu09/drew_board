"use client";

import { useAuth } from "@clerk/nextjs";

import { Canvas } from "@/components/canvas/canvas";
import { LocalBoardStoreProvider } from "@/lib/board-store/local-store";

import { GuestInfo } from "./guest-info";
import { GuestActions } from "./guest-actions";

const LocalOnlyNotice = () => {
  const { isSignedIn } = useAuth();

  return (
    <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-xs text-muted-foreground shadow-sm pointer-events-none">
      {isSignedIn
        ? "This board is only in this browser. Save it to keep it in your account."
        : "Saved in this browser only. Sign in to keep it and share it."}
    </p>
  );
};

/** A board that lives in this browser's storage. Client-only. */
export const GuestBoard = () => {
  return (
    <LocalBoardStoreProvider>
      <div className="relative h-full w-full">
        <Canvas header={<GuestInfo />} topRight={<GuestActions />} />
        <LocalOnlyNotice />
      </div>
    </LocalBoardStoreProvider>
  );
};
