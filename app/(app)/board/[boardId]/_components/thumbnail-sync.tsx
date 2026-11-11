"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useRoom } from "@/liveblocks.config";
import { useBoardStore } from "@/lib/board-store/context";
import type { BoardSnapshot } from "@/lib/board-store/types";
import { boardToThumbnail } from "@/components/canvas/export";

/** How long after the last change the thumbnail is redrawn. */
const DELAY = 2_000;

const contentKey = (snapshot: BoardSnapshot) =>
  JSON.stringify([snapshot.layerIds, snapshot.layers, snapshot.background]);

interface ThumbnailSyncProps {
  boardId: Id<"boards">;
  /** The board has no thumbnail yet: make one now, if it has content. */
  missing: boolean;
}

/**
 * Keeps the board's dashboard thumbnail (and "last edited by") up to date:
 * a while after this user's own changes, and when they leave the board.
 * Other people's changes are their own browsers' job.
 */
export const ThumbnailSync = ({ boardId, missing }: ThumbnailSyncProps) => {
  const room = useRoom();
  const { actions } = useBoardStore();
  const generateUploadUrl = useMutation(api.thumbnails.generateUploadUrl);
  const setThumbnail = useMutation(api.thumbnails.set);
  // Only whether it was missing when the board opened matters.
  const [wasMissing] = useState(missing);

  useEffect(() => {
    let sent = contentKey(actions.getSnapshot());
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = false;

    // Reads the board right away (it may be gone after an await), then
    // uploads in the background.
    const sync = (edited: boolean) => {
      pending = false;
      const snapshot = actions.getSnapshot();
      const key = contentKey(snapshot);
      if (edited && key === sent) return;
      sent = key;

      void (async () => {
        const blob = await boardToThumbnail(snapshot);
        if (!blob) {
          await setThumbnail({ id: boardId, storageId: null, edited });
          return;
        }

        const url = await generateUploadUrl({ id: boardId });
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": blob.type },
          body: blob,
        });
        if (!response.ok) throw new Error("Thumbnail upload failed");

        const { storageId } = (await response.json()) as {
          storageId: Id<"_storage">;
        };
        await setThumbnail({ id: boardId, storageId, edited });
      })().catch((error) => {
        // Not worth bothering the user: the next change tries again.
        console.warn("Could not update the board thumbnail", error);
      });
    };

    if (wasMissing && actions.getSnapshot().layerIds.length > 0) {
      sync(false);
    }

    // "history" fires for this user's own changes only (and selections,
    // which the content check skips).
    const unsubscribe = room.subscribe("history", () => {
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(() => sync(true), DELAY);
    });

    return () => {
      unsubscribe();
      clearTimeout(timer);
      if (pending) sync(true);
    };
  }, [actions, boardId, generateUploadUrl, room, setThumbnail, wasMissing]);

  return null;
};
