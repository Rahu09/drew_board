"use client";

import Link from "next/link";
import Image from "next/image";
import { Poppins } from "next/font/google";
import { Eraser } from "lucide-react";

import { cn } from "@/lib/utils";
import { Hint } from "@/components/hints";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/confirm-modal";
import { useBoardStore } from "@/lib/board-store/context";

const font = Poppins({
  subsets: ["latin"],
  weight: ["600"],
});

const TabSeparator = () => <div className="text-neutral-300 px-1.5">|</div>;

/** Top-left panel of the guest board: home link, title, clear. */
export const GuestInfo = () => {
  const store = useBoardStore();
  const layerCount = store.useLayerCount();

  return (
    <div className="absolute top-2 left-2 bg-white rounded-md px-1.5 h-12 flex items-center shadow-md">
      <Hint label="Home" side="bottom" sideOffset={10}>
        <Button asChild variant="board" className="px-2">
          <Link href="/">
            <Image src="/logo.svg" alt="Board Logo" height={40} width={40} />
            <span
              className={cn(
                "hidden sm:inline font-semibold text-xl ml-2 text-black",
                font.className
              )}
            >
              Board
            </span>
          </Link>
        </Button>
      </Hint>
      <TabSeparator />
      <span className="px-2 text-base">Guest board</span>
      <TabSeparator />
      <ConfirmModal
        header="Clear the board?"
        description="This removes everything on it. You can undo it while this page is open."
        onConfirm={() =>
          store.actions.deleteLayers(store.actions.getSnapshot().layerIds)
        }
      >
        <div>
          <Hint label="Clear board" side="bottom" sideOffset={10}>
            <Button
              size="icon"
              variant="board"
              disabled={layerCount === 0}
              aria-label="Clear board"
            >
              <Eraser />
            </Button>
          </Hint>
        </div>
      </ConfirmModal>
    </div>
  );
};
