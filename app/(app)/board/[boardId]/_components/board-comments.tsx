"use client";

import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { Check, Loader, Send, Trash2, X } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import type { Camera, Point } from "@/types/canvas";
import type {
  CommentsListSlotProps,
  CommentsSlotProps,
} from "@/components/canvas/comments-slot";

type Thread = Doc<"commentThreads"> & { comments: Doc<"comments">[] };

const CARD_WIDTH = 288;

/** The thread shown open on the board, shared with the sidebar's list. */
const useOpenThread = create<{
  openId: Id<"commentThreads"> | null;
  setOpenId: (id: Id<"commentThreads"> | null) => void;
}>((set) => ({
  openId: null,
  setOpenId: (openId) => set({ openId }),
}));

const toScreen = (point: Point, camera: Camera): Point => ({
  x: point.x * camera.scale + camera.x,
  y: point.y * camera.scale + camera.y,
});

/** Card position next to a pin, kept on screen. */
const cardPosition = (anchor: Point) => ({
  left: Math.max(
    8,
    Math.min(anchor.x + 20, window.innerWidth - CARD_WIDTH - 8)
  ),
  top: Math.max(60, Math.min(anchor.y - 16, window.innerHeight - 320)),
});

/** "2 minutes ago"; never "in a minute" when the server clock is ahead. */
const timeAgo = (time: number) =>
  formatDistanceToNow(Math.min(time, Date.now()), { addSuffix: true });

const Avatar = ({ name, image }: { name: string; image?: string }) =>
  image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className="h-6 w-6 rounded-full shrink-0" />
  ) : (
    <span className="h-6 w-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center shrink-0">
      {name.charAt(0).toUpperCase()}
    </span>
  );

const SmallAvatar = ({ name, image }: { name: string; image?: string }) =>
  image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className="h-4 w-4 rounded-full shrink-0" />
  ) : (
    <span className="h-4 w-4 rounded-full bg-blue-500 text-white text-[9px] flex items-center justify-center shrink-0">
      {name.charAt(0).toUpperCase()}
    </span>
  );

/** A text box that sends on Enter (Shift+Enter: new line). */
const Composer = ({
  placeholder,
  onSend,
  onCancel,
  autoFocus,
}: {
  placeholder: string;
  onSend: (body: string) => Promise<unknown>;
  onCancel?: () => void;
  autoFocus?: boolean;
}) => {
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);

  // Focus on the next frame: the click that opened the composer would
  // otherwise move focus back to the page right after it appears.
  useEffect(() => {
    if (!autoFocus) return;

    const frame = requestAnimationFrame(() => textarea.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [autoFocus]);

  const send = async () => {
    if (!body.trim() || pending) return;

    setPending(true);
    try {
      await onSend(body);
      setBody("");
    } catch {
      toast.error("Couldn't post the comment");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-end gap-x-1">
      <textarea
        ref={textarea}
        rows={2}
        maxLength={2000}
        value={body}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          } else if (e.key === "Escape") {
            onCancel?.();
          }
        }}
        className="flex-1 resize-none rounded-md border px-2 py-1.5 text-sm outline-hidden focus:border-blue-500"
      />
      <Button
        size="icon"
        className="h-8 w-8 shrink-0"
        disabled={!body.trim() || pending}
        onClick={() => void send()}
        aria-label="Send"
      >
        {pending ? <Loader className="animate-spin" /> : <Send />}
      </Button>
    </div>
  );
};

const ThreadCard = ({
  thread,
  camera,
  onClose,
}: {
  thread: Thread;
  camera: Camera;
  onClose: () => void;
}) => {
  const { userId } = useAuth();
  const reply = useMutation(api.comments.reply);
  const resolve = useMutation(api.comments.resolve);
  const removeThread = useMutation(api.comments.removeThread);
  const position = cardPosition(toScreen(thread, camera));

  return (
    <div
      data-comment-ui
      className="absolute z-20 bg-white rounded-lg shadow-lg border p-3 space-y-3"
      style={{ ...position, width: CARD_WIDTH }}
    >
      <div className="flex items-center justify-end gap-x-1 -mt-1 -mr-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Resolve"
          title="Resolve"
          onClick={() =>
            resolve({ threadId: thread._id })
              .then(onClose)
              .catch(() => toast.error("Couldn't resolve the thread"))
          }
        >
          <Check />
        </Button>
        {thread.authorId === userId && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Delete thread"
            title="Delete thread"
            onClick={() =>
              removeThread({ threadId: thread._id })
                .then(onClose)
                .catch(() => toast.error("Couldn't delete the thread"))
            }
          >
            <Trash2 />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Close"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <ul className="space-y-3 max-h-60 overflow-y-auto">
        {thread.comments.map((comment) => (
          <li key={comment._id} className="flex gap-x-2">
            <Avatar name={comment.authorName} image={comment.authorImage} />
            <div className="min-w-0">
              <p className="text-xs">
                <span className="font-semibold">{comment.authorName}</span>{" "}
                <span className="text-muted-foreground">
                  {timeAgo(comment._creationTime)}
                </span>
              </p>
              <p className="text-sm whitespace-pre-wrap break-words">
                {comment.body}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <Composer
        placeholder="Reply"
        onSend={(body) => reply({ threadId: thread._id, body })}
        onCancel={onClose}
      />
    </div>
  );
};

/**
 * Comment pins and threads of a live board, drawn over the canvas. New
 * threads start where the user clicks with the Comment tool.
 */
export const BoardComments = ({
  boardId,
  camera,
  draft,
  onDraftDone,
}: CommentsSlotProps & { boardId: string }) => {
  const threads = useQuery(api.comments.list, { boardId });
  const createThread = useMutation(api.comments.createThread);
  const { openId, setOpenId } = useOpenThread();

  // A click anywhere else closes the open thread.
  useEffect(() => {
    if (!openId) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest("[data-comment-ui]")) {
        setOpenId(null);
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [openId, setOpenId]);

  // Leaving the board closes it, so it isn't open on the next board.
  useEffect(() => () => setOpenId(null), [setOpenId]);

  const openThread = threads?.find((thread) => thread._id === openId);

  return (
    <div>
      {threads?.map((thread) => {
        const point = toScreen(thread, camera);
        const first = thread.comments[0];

        return (
          <button
            key={thread._id}
            data-comment-ui
            type="button"
            aria-label={`Comment by ${first?.authorName ?? "someone"}`}
            onClick={() => setOpenId(thread._id)}
            className="absolute z-10 flex items-center gap-x-1 rounded-full rounded-bl-none bg-white shadow-md border p-1 pr-2 -translate-y-full hover:scale-105 transition-transform"
            style={{ left: point.x, top: point.y }}
          >
            <Avatar
              name={first?.authorName ?? "?"}
              image={first?.authorImage}
            />
            <span className="text-xs font-semibold">
              {thread.comments.length}
            </span>
          </button>
        );
      })}

      {openThread && (
        <ThreadCard
          thread={openThread}
          camera={camera}
          onClose={() => setOpenId(null)}
        />
      )}

      {draft && (
        <div
          data-comment-ui
          className="absolute z-20 bg-white rounded-lg shadow-lg border p-3"
          style={{ ...cardPosition(toScreen(draft, camera)), width: CARD_WIDTH }}
        >
          <Composer
            autoFocus
            placeholder="Add a comment"
            onCancel={onDraftDone}
            onSend={async (body) => {
              const threadId = await createThread({
                boardId: boardId as Id<"boards">,
                x: draft.x,
                y: draft.y,
                body,
              });
              onDraftDone();
              setOpenId(threadId);
            }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Every open thread of the board, newest first, for the sidebar. Picking
 * one moves the view to it and opens it.
 */
export const BoardCommentsList = ({
  boardId,
  focus,
}: CommentsListSlotProps & { boardId: string }) => {
  const threads = useQuery(api.comments.list, { boardId });
  const { openId, setOpenId } = useOpenThread();

  if (threads === undefined) {
    return (
      <div className="flex justify-center py-8">
        <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-muted-foreground">
        No comments yet. Pick the comment tool (C) and click the board to
        start one.
      </p>
    );
  }

  const newestFirst = [...threads].sort(
    (a, b) => b._creationTime - a._creationTime
  );

  return (
    <ul className="divide-y divide-neutral-100">
      {newestFirst.map((thread) => {
        const [first, ...replies] = thread.comments;
        if (!first) return null;

        return (
          <li key={thread._id}>
            <button
              type="button"
              data-comment-ui
              onClick={() => {
                focus(thread);
                setOpenId(thread._id);
              }}
              className={`w-full rounded-md px-2 py-3 text-left hover:bg-neutral-50 ${
                openId === thread._id ? "bg-indigo-50" : ""
              }`}
            >
              <div className="flex items-center gap-x-2">
                <Avatar name={first.authorName} image={first.authorImage} />
                <p className="min-w-0 truncate text-sm">
                  <span className="font-semibold">{first.authorName}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {timeAgo(first._creationTime)}
                  </span>
                </p>
              </div>
              <p className="mt-1 line-clamp-3 text-sm text-neutral-700 break-words">
                {first.body}
              </p>
              {replies.length > 0 && (
                <ul className="mt-2 space-y-2 border-l-2 border-neutral-200 pl-3">
                  {replies.map((reply) => (
                    <li key={reply._id}>
                      <div className="flex items-center gap-x-1.5">
                        <SmallAvatar
                          name={reply.authorName}
                          image={reply.authorImage}
                        />
                        <p className="min-w-0 truncate text-xs">
                          <span className="font-semibold">
                            {reply.authorName}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {timeAgo(reply._creationTime)}
                          </span>
                        </p>
                      </div>
                      <p className="mt-0.5 line-clamp-3 text-sm text-neutral-700 break-words">
                        {reply.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
};
