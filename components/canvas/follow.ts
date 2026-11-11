import { create } from "zustand";

/** The user whose view this user is following, if any. */
export type FollowTarget = {
  connectionId: number;
  name: string;
  color: string;
};

/**
 * Following another user's view on a live board (set from the list of
 * collaborators, read by the canvas).
 */
export const useFollow = create<{
  target: FollowTarget | null;
  follow: (target: FollowTarget) => void;
  stop: () => void;
}>((set) => ({
  target: null,
  follow: (target) => set({ target }),
  stop: () => set({ target: null }),
}));
