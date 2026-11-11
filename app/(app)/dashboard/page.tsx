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
  const workspace = useWorkspace();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 sm:p-6 sm:pt-2">
      {workspace && (
        <BoardList
          workspace={workspace}
          query={{ search, favorites }}
          sort={parseSort(sort)}
        />
      )}
    </div>
  );
};

export default DashboardPage;
