"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { Copy, Loader } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useShareLinkModal } from "@/store/use-share-link-modal";

/** A new secret for a link: 32 random bytes, base64url (43 characters). */
const newShareToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

/**
 * Turns a board's read-only link on or off. Anyone with the link can look
 * at the board without signing in, but not change it. Turning the link off
 * and on again makes a new link; the old one stops working.
 */
export const ShareLinkModal = () => {
  const { isOpen, boardId, onClose } = useShareLinkModal();
  const board = useQuery(
    api.board.get,
    isOpen && boardId ? { id: boardId } : "skip"
  );
  const setShareLink = useMutation(api.board.setShareLink);
  const [pending, setPending] = useState(false);

  const token = board?.shareToken;
  const url =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/view/${token}`
      : "";

  const toggle = async () => {
    setPending(true);
    try {
      await setShareLink({
        id: boardId as Id<"boards">,
        token: token ? null : newShareToken(),
      });
      toast.success(token ? "Link turned off" : "Link turned on");
    } catch {
      toast.error("Couldn't change the link");
    } finally {
      setPending(false);
    }
  };

  const copy = () => {
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Link copied"))
      .catch(() => toast.error("Failed to copy link"));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Read-only link</DialogTitle>
          <DialogDescription>
            Anyone with the link can view this board without signing in. They
            can&apos;t edit it, and they see it as it was last saved.
          </DialogDescription>
        </DialogHeader>
        {board === undefined ? (
          <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : board === null ? (
          <p className="text-sm text-muted-foreground">
            This board isn&apos;t available.
          </p>
        ) : (
          <div className="space-y-4">
            {token && (
              <div className="flex gap-x-2">
                <Input
                  readOnly
                  value={url}
                  aria-label="Read-only link"
                  onFocus={(e) => e.target.select()}
                />
                <Button onClick={copy} aria-label="Copy link">
                  <Copy />
                  Copy
                </Button>
              </div>
            )}
            <div className="flex justify-end">
              <Button
                variant={token ? "outline" : "default"}
                disabled={pending}
                onClick={() => void toggle()}
              >
                {pending && <Loader className="animate-spin" />}
                {token ? "Turn off the link" : "Create a read-only link"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
