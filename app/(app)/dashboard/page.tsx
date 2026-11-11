"use client";

import { use } from "react";

import { useWorkspace } from "@/hooks/use-workspace";

import { BoardList } from "./_component/board-list";

interface DashboardPageProps {
  // Next.js 15+ passes search params as a Promise.
  searchParams: Promise<{
    search?: string;
    favorites?: string;
  }>;
}

const DashboardPage = ({ searchParams }: DashboardPageProps) => {
  const query = use(searchParams);
  const workspace = useWorkspace();

  return (
    <div className="flex-1 h-[calc(100%-80px)] p-6">
      {workspace && <BoardList workspace={workspace} query={query} />}
    </div>
  );
};

export default DashboardPage;
