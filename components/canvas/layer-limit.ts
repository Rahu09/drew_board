import { toast } from "sonner";

import { MAX_LAYERS } from "@/lib/board-store/types";

/** Shown instead of failing silently when the board is full. */
export const notifyLayerLimit = () => {
  toast.error(
    `This board is full: it can hold ${MAX_LAYERS} shapes. Delete some to add more.`,
    { id: "layer-limit" }
  );
};

/** From this many layers on, the zoom bar shows the count. */
export const LAYER_COUNT_WARNING = MAX_LAYERS - 10;
