"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { useBoardStore } from "@/lib/board-store/context";
import { useGuestBoard } from "@/lib/board-store/local-store";

/**
 * What the guest asked for before signing in. It travels through sign-in as
 * `/try?intent=...`, so it survives a full redirect (e.g. Google sign-in).
 */
export type GuestIntent = "save" | "share";

export const isGuestIntent = (value: string | null): value is GuestIntent =>
  value === "save" || value === "share";

export const signInRedirectUrl = (intent: GuestIntent) =>
  `/try?intent=${intent}`;

/** Saves the guest board as a personal board. Signed-in users only. */
export const useSaveGuestBoard = () => {
  const router = useRouter();
  const { actions } = useBoardStore();
  const guestBoard = useGuestBoard();
  const [pending, setPending] = useState(false);

  const save = async (intent: GuestIntent) => {
    const snapshot = actions.getSnapshot();

    if (snapshot.layerIds.length === 0) {
      toast.info("Add something to the board first, then save it.");
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/guest-board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled", snapshot }),
      });

      if (!response.ok) {
        throw new Error(`Save failed with status ${response.status}`);
      }

      const { id } = (await response.json()) as { id: string };

      // The board now lives in the account; remove the browser copy.
      guestBoard.clear();

      toast.success("Saved to your boards");

      // Share continues on the board: "Share with a team" opens there.
      router.push(intent === "share" ? `/board/${id}?share=1` : `/board/${id}`);
    } catch {
      setPending(false);
      toast.error("Couldn't save the board. Your drawing is still here.");
    }
  };

  return { save, pending };
};
