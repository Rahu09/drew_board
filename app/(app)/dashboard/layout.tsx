import { Suspense } from "react";
import type { Metadata } from "next";

import { Navbar } from "./_component/navbar";
import { BoardListSkeleton } from "./_component/board-list";
import { OrgSidebar } from "./_component/org-sidebar";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  // No <AuthGate>: the sidebar, navbar and list skeleton are server-rendered
  // and shown at once. The board list itself waits for the session (see
  // board-list.tsx); proxy.ts has already turned signed-out visitors away.
  //
  // The page is prerendered without a query string, so whatever reads it
  // (the page, and parts of the sidebar and navbar) sits in its own
  // <Suspense> with a look-alike fallback. Without those, the whole page
  // would fall back to the app layout's full-screen logo.
  return (
    <main className="h-full">
      <div className="flex gap-x-3 h-full">
        <OrgSidebar />
        <div className="h-full flex-1 min-w-0 flex flex-col">
          <Navbar />
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 sm:p-6 sm:pt-2">
            <Suspense fallback={<BoardListSkeleton />}>{children}</Suspense>
          </div>
        </div>
      </div>
    </main>
  );
};

export default DashboardLayout;
