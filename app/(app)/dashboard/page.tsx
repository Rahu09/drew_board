"use client";

import { use } from "react";

import { useWorkspace } from "@/hooks/use-workspace";

import { BoardList, parseSort } from "./_component/board-list";

interface DashboardPageProps {
  // Next.js 15+ passes search params as a Promise.
  searchParams: Promise<{
    search?: string;
    favorites?: string;
    sort?: string;
  }>;
}

const DashboardPage = ({ searchParams }: DashboardPageProps) => {
  const { search, favorites, sort } = use(searchParams);
  // Null until Clerk has loaded: the list then shows its skeleton, so the
  // page has its final layout from the first (server-rendered) paint.
  const workspace = useWorkspace();

  return (
    <BoardList
      workspace={workspace}
      query={{ search: search?.trim() || undefined, favorites: !!favorites }}
      sort={parseSort(sort)}
    />
  );
};

export default DashboardPage;
