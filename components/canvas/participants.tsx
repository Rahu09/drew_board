"use client";

import { shallow } from "@liveblocks/client";
import { ChevronDown, Eye } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, connectionIdToColor } from "@/lib/utils";
import { useOthers, useSelf } from "@/liveblocks.config";

import { useFollow } from "./follow";

const MAX_SHOWN_USERS = 3;

type Person = {
  connectionId: number;
  name: string;
  picture?: string;
};

const toPerson = (user: {
  connectionId: number;
  info?: { name?: string; picture?: string };
}): Person => ({
  connectionId: user.connectionId,
  name: user.info?.name || "Teammate",
  picture: user.info?.picture,
});

/** A round avatar: the user's picture, or their initial on their color. */
const Avatar = ({
  person,
  size = "md",
  ring,
}: {
  person: Person;
  size?: "sm" | "md";
  /** Highlighted (being followed). */
  ring?: boolean;
}) => {
  const color = connectionIdToColor(person.connectionId);

  return (
    <span
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full border-2 border-white flex items-center justify-center font-semibold text-white",
        size === "md" ? "h-8 w-8 text-xs" : "h-7 w-7 text-[11px]",
        ring && "outline-2 outline-offset-1"
      )}
      style={{ backgroundColor: color, outlineColor: color }}
    >
      {person.picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.picture} alt="" className="h-full w-full object-cover" />
      ) : (
        person.name.charAt(0).toUpperCase()
      )}
    </span>
  );
};

/**
 * Who is on the board, next to Share: overlapping avatars that open a list
 * where you can follow someone's view. Nothing when you're alone.
 */
export const Participants = () => {
  const others = useOthers((users) => users.map(toPerson), shallow);
  const self = useSelf(toPerson, shallow);
  const { target, follow, stop } = useFollow();

  if (others.length === 0) return null;

  const hidden = others.length - MAX_SHOWN_USERS;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${others.length + 1} people on this board`}
          className="hidden sm:flex h-9 shrink-0 items-center gap-x-1 rounded-full pl-0.5 pr-1.5 hover:bg-neutral-100 data-[state=open]:bg-neutral-100"
        >
          <span className="flex -space-x-2">
            {others.slice(0, MAX_SHOWN_USERS).map((person) => (
              <Avatar
                key={person.connectionId}
                person={person}
                ring={target?.connectionId === person.connectionId}
              />
            ))}
            {hidden > 0 && (
              <span className="relative h-8 w-8 rounded-full border-2 border-white bg-neutral-200 text-xs font-semibold text-neutral-700 flex items-center justify-center">
                +{hidden}
              </span>
            )}
            <Avatar person={self} />
          </span>
          <ChevronDown className="h-4 w-4 text-neutral-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 p-1.5">
        <p className="px-2 pb-2 pt-1 text-center text-xs text-muted-foreground">
          Click on someone to follow their view
        </p>
        <div className="flex items-center gap-x-3 rounded-sm px-2 py-1.5 text-sm">
          <Avatar person={self} size="sm" />
          <span className="flex-1 truncate">{self.name}</span>
          <span className="text-xs text-muted-foreground">(You)</span>
        </div>
        {others.map((person) => {
          const following = target?.connectionId === person.connectionId;

          return (
            <DropdownMenuItem
              key={person.connectionId}
              onSelect={() =>
                following
                  ? stop()
                  : follow({
                      connectionId: person.connectionId,
                      name: person.name,
                      color: connectionIdToColor(person.connectionId),
                    })
              }
              className={cn(
                "cursor-pointer gap-x-3 px-2 py-1.5",
                following && "bg-indigo-50"
              )}
            >
              <Avatar person={person} size="sm" />
              <span className="flex-1 truncate">{person.name}</span>
              {following && (
                <span className="flex items-center gap-x-1 text-xs text-indigo-600">
                  <Eye className="h-3.5 w-3.5" />
                  Following
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
