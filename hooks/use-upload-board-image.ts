"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Uploads an image to Convex storage for a board and returns its URL, for
 * an image layer. The server checks the type and size (convex/images.ts).
 */
export const useUploadBoardImage = (boardId: string) => {
  const generateUploadUrl = useMutation(api.images.generateUploadUrl);
  const addImage = useMutation(api.images.addImage);

  return useCallback(
    async (file: File) => {
      const id = boardId as Id<"boards">;
      const uploadUrl = await generateUploadUrl({ boardId: id });
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };

      return await addImage({ boardId: id, storageId });
    },
    [addImage, boardId, generateUploadUrl]
  );
};
