import type { Metadata } from "next";

import { AuthGate } from "@/components/auth/auth-gate";

import { Navbar } from "./_component/navbar";
import { OrgSidebar } from "./_component/org-sidebar";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <AuthGate>
      <main className="h-full">
        <div className="flex gap-x-3 h-full">
          <OrgSidebar />
          <div className="h-full flex-1 min-w-0 flex flex-col">
            <Navbar />
            {children}
          </div>
        </div>
      </main>
    </AuthGate>
  );
};

export default DashboardLayout;
