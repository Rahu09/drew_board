"use client";

import qs from "query-string";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef } from "react";
import { useConvexAuth, usePaginatedQuery, useQuery } from "convex/react";
import { ArrowDownUp, Check, Loader } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { BoardSort } from "@/convex/sort";
import { Skeleton } from "@/components/ui/skeleton";
import type { Workspace } from "@/hooks/use-workspace";
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

// The server sorts (convex/boards.ts): each order has its own index, so the
// list can be loaded a page at a time.
const SORTS: Record<BoardSort, string> = {
  edited: "Last edited",
  newest: "Newest first",
  oldest: "Oldest first",
  name: "Name (A–Z)",
};

const DEFAULT_SORT: BoardSort = "edited";

export const parseSort = (value: string | undefined): BoardSort =>
  value && value in SORTS ? (value as BoardSort) : DEFAULT_SORT;

/** Boards per page: four rows of the widest grid. */
const PAGE_SIZE = 24;

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
          aria-label={`Sort boards: ${SORTS[sort]}`}
          className="flex h-9 shrink-0 items-center gap-x-2 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent"
        >
          <ArrowDownUp className="h-4 w-4" />
          <span className="hidden sm:inline">{SORTS[sort]}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {(Object.keys(SORTS) as BoardSort[]).map((key) => (
          <DropdownMenuItem
            key={key}
            onSelect={() => choose(key)}
            className="cursor-pointer justify-between"
          >
            {SORTS[key]}
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

/**
 * The end of the loaded boards: loads the next page when it scrolls into
 * (or near) view, or when pressed.
 */
const LoadMore = ({
  loading,
  onLoadMore,
}: {
  loading: boolean;
  onLoadMore: () => void;
}) => {
  const ref = useRef<HTMLButtonElement>(null);
  const load = useEffectEvent(onLoadMore);

  // A new observer after each page reports straight away whether the button
  // is still in view, so a short page keeps loading until the screen is full.
  useEffect(() => {
    const button = ref.current;
    if (!button || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) load();
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(button);

    return () => observer.disconnect();
  }, [loading]);

  return (
    <div className="flex justify-center pb-10">
      <button
        ref={ref}
        type="button"
        disabled={loading}
        onClick={onLoadMore}
        className="flex h-9 items-center gap-x-2 rounded-md border px-4 text-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none"
      >
        {loading && <Loader className="h-4 w-4 animate-spin" />}
        {loading ? "Loading boards…" : "Load more boards"}
      </button>
    </div>
  );
};

/**
 * The list before its boards are known: the real layout with placeholder
 * cards. Also what the server sends for the dashboard (see layout.tsx).
 */
export const BoardListSkeleton = ({
  title,
  favorites = false,
  children,
}: {
  title?: string | null;
  favorites?: boolean;
  children?: React.ReactNode;
}) => (
  <div aria-busy>
    <ListTabs favorites={favorites} />
    {title ? (
      <h1 className="text-2xl sm:text-3xl truncate">{title}</h1>
    ) : (
      <Skeleton className="h-8 sm:h-9 w-44" />
    )}
    <div className={GRID}>
      <NewBoardButton orgId="" disabled />
      <BoardCard.Skeleton />
      <BoardCard.Skeleton />
      <BoardCard.Skeleton />
      <BoardCard.Skeleton />
    </div>
    {children}
  </div>
);

interface BoardListProps {
  /** Null while Clerk is still loading. */
  workspace: Workspace | null;
  query: {
    search?: string;
    favorites: boolean;
  };
  sort: BoardSort;
}

export const BoardList = ({ workspace, query, sort }: BoardListProps) => {
  const { search, favorites } = query;
  const orgId = workspace?.id;
  // Convex only knows the user once it has the Clerk token, and only allows
  // an org once the token names it (just after a switch it still names the
  // old one). Until then the list is "loading", not asked for.
  const { isAuthenticated } = useConvexAuth();
  const canList = useQuery(
    api.boards.access,
    isAuthenticated && orgId ? { orgId } : "skip"
  );
  // Only the plain list can be sorted: favorites come most recently
  // favorited first, search results best match first.
  const sortable = !search && !favorites;
  const { results, status, loadMore } = usePaginatedQuery(
    api.boards.list,
    canList && orgId
      ? {
          orgId,
          ...(search ? { search } : {}),
          ...(favorites ? { favorites } : {}),
          ...(sortable ? { sort } : {}),
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  const title = search
    ? `Results for “${search}”`
    : favorites
      ? "Favorite boards"
      : !workspace
        ? null
        : workspace.isPersonal
          ? "Your boards"
          : "Team boards";
  const tabs = <ListTabs favorites={favorites} />;
  const more = status === "CanLoadMore" || status === "LoadingMore";
  const loadMoreButton = more && (
    <LoadMore
      loading={status === "LoadingMore"}
      onLoadMore={() => loadMore(PAGE_SIZE)}
    />
  );

  // Nothing to show yet. (A page can come back empty with more to load:
  // search within favorites filters each page of matches.)
  if (!canList || status === "LoadingFirstPage" || (!results.length && more)) {
    return (
      <BoardListSkeleton title={title} favorites={favorites}>
        {loadMoreButton}
      </BoardListSkeleton>
    );
  }

  if (!results.length) {
    return (
      <div className="h-full flex flex-col">
        {tabs}
        {search ? (
          <EmptySearch />
        ) : favorites ? (
          <EmptyFavorites />
        ) : (
          workspace && <EmptyBoards workspace={workspace} />
        )}
      </div>
    );
  }

  return (
    <div>
      {tabs}
      <div className="flex items-center justify-between gap-x-4">
        <h1 className="text-2xl sm:text-3xl truncate">{title}</h1>
        {sortable && <SortMenu sort={sort} />}
      </div>
      <ul className={cn(GRID, more && "pb-6")} aria-label={title ?? undefined}>
        <li className="contents">
          <NewBoardButton orgId={orgId ?? ""} />
        </li>
        {results.map((board) => (
          <li key={board._id} className="contents">
            <BoardCard board={board} />
          </li>
        ))}
      </ul>
      {loadMoreButton}
    </div>
  );
};
