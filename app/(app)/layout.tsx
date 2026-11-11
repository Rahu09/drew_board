import { Suspense } from "react";

import { Loading } from "@/components/auth/loading";
import { ModalProvider } from "@/providers/modal-provider";
import { ConvexClientProvider } from "@/providers/convex-client-provider";

// Shared by every route that talks to Clerk and Convex (dashboard, boards).
// The public landing page lives outside this group, so it ships none of it.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <ConvexClientProvider>
        <ModalProvider />
        {children}
      </ConvexClientProvider>
    </Suspense>
  );
}
