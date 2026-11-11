"use client";

import { useAuth } from "@clerk/nextjs";

import { Canvas } from "@/components/canvas/canvas";
import { LocalBoardStoreProvider } from "@/lib/board-store/local-store";

import { GuestActions } from "./guest-actions";

const LocalOnlyNotice = () => {
  const { isSignedIn } = useAuth();

  return (
    <p className="absolute top-16 lg:top-auto lg:bottom-3 left-1/2 -translate-x-1/2 w-max max-w-[calc(100%-1rem)] text-center rounded-2xl bg-white/90 px-3 py-1 text-xs text-muted-foreground shadow-sm pointer-events-none">
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
        <Canvas
          home={{ href: "/", label: "Home" }}
          title={
            <span className="px-2 text-sm whitespace-nowrap">Guest board</span>
          }
          topRight={<GuestActions />}
        />
        <LocalOnlyNotice />
      </div>
    </LocalBoardStoreProvider>
  );
};
