"use client";

import qs from "query-string";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowDownUp, Check } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { Workspace } from "@/hooks/use-workspace";
import type { BoardListItem } from "@/hooks/use-board-mutations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { EmptySearch } from "./empty-search";
import { EmptyFavorites } from "./empty-favorites";
import { EmptyBoards } from "./empty-boards";
import { BoardCard } from "./board-card";
import { NewBoardButton } from "./new-board-button";

const SORTS = {
  edited: {
    label: "Last edited",
    compare: (a: BoardListItem, b: BoardListItem) =>
      (b.lastEditedAt ?? b._creationTime) - (a.lastEditedAt ?? a._creationTime),
  },
  newest: {
    label: "Newest first",
    compare: (a: BoardListItem, b: BoardListItem) =>
      b._creationTime - a._creationTime,
  },
  oldest: {
    label: "Oldest first",
    compare: (a: BoardListItem, b: BoardListItem) =>
      a._creationTime - b._creationTime,
  },
  name: {
    label: "Name (A–Z)",
    compare: (a: BoardListItem, b: BoardListItem) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
  },
} as const;

export type BoardSort = keyof typeof SORTS;

const DEFAULT_SORT: BoardSort = "edited";

export const parseSort = (value: string | undefined): BoardSort =>
  value && value in SORTS ? (value as BoardSort) : DEFAULT_SORT;

const GRID =
  "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-5 mt-6 pb-10";

/** "Last edited ▾": how the boards are ordered (kept in the URL). */
const SortMenu = ({ sort }: { sort: BoardSort }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const choose = (next: BoardSort) =>
    router.replace(
      qs.stringifyUrl(
        {
          url: pathname,
          query: {
            ...qs.parse(searchParams.toString()),
            sort: next === DEFAULT_SORT ? null : next,
          },
        },
        { skipNull: true, skipEmptyString: true }
      ),
      { scroll: false }
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Sort boards: ${SORTS[sort].label}`}
          className="flex h-9 shrink-0 items-center gap-x-2 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent"
        >
          <ArrowDownUp className="h-4 w-4" />
          <span className="hidden sm:inline">{SORTS[sort].label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {(Object.keys(SORTS) as BoardSort[]).map((key) => (
          <DropdownMenuItem
            key={key}
            onSelect={() => choose(key)}
            className="cursor-pointer justify-between"
          >
            {SORTS[key].label}
            {key === sort && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/** All / Favorites, for screens without the sidebar. */
const ListTabs = ({ favorites }: { favorites: boolean }) => {
  const tab = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    );

  return (
    <nav
      aria-label="Boards"
      className="lg:hidden mb-4 inline-flex rounded-lg bg-muted p-1"
    >
      <Link
        href="/dashboard"
        aria-current={!favorites ? "page" : undefined}
        className={tab(!favorites)}
      >
        All boards
      </Link>
      <Link
        href="/dashboard?favorites=true"
        aria-current={favorites ? "page" : undefined}
        className={tab(favorites)}
      >
        Favorites
      </Link>
    </nav>
  );
};

interface BoardListProps {
  workspace: Workspace;
  query: {
    search?: string;
    favorites?: string;
  };
  sort: BoardSort;
}

export const BoardList = ({ workspace, query, sort }: BoardListProps) => {
  const orgId = workspace.id;
  const data = useQuery(api.boards.get, {
    orgId,
    ...query,
  });
  const title = query.search
    ? `Results for “${query.search}”`
    : query.favorites
      ? "Favorite boards"
      : workspace.isPersonal
        ? "Your boards"
        : "Team boards";
  const tabs = <ListTabs favorites={!!query.favorites} />;

  // undefined: still loading. null: the org switch has not reached Convex yet.
  if (data === undefined || data === null) {
    return (
      <div aria-busy>
        {tabs}
        <h1 className="text-2xl sm:text-3xl">{title}</h1>
        <div className={GRID}>
          <NewBoardButton orgId={orgId} disabled />
          <BoardCard.Skeleton />
          <BoardCard.Skeleton />
          <BoardCard.Skeleton />
          <BoardCard.Skeleton />
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="h-full flex flex-col">
        {tabs}
        {query.search ? (
          <EmptySearch />
        ) : query.favorites ? (
          <EmptyFavorites />
        ) : (
          <EmptyBoards workspace={workspace} />
        )}
      </div>
    );
  }

  const boards = [...data].sort(SORTS[sort].compare);

  return (
    <div>
      {tabs}
      <div className="flex items-center justify-between gap-x-4">
        <h1 className="text-2xl sm:text-3xl truncate">{title}</h1>
        <SortMenu sort={sort} />
      </div>
      <ul className={GRID} aria-label={title}>
        <li className="contents">
          <NewBoardButton orgId={orgId} />
        </li>
        {boards.map((board) => (
          <li key={board._id} className="contents">
            <BoardCard board={board} />
          </li>
        ))}
      </ul>
    </div>
  );
};
