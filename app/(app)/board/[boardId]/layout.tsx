import type { Metadata } from "next";

import { AuthGate } from "@/components/auth/auth-gate";

import { Loading } from "./_components/loading";

export const metadata: Metadata = {
  title: "Whiteboard",
  robots: { index: false, follow: false },
};

export default function BoardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The board's empty layout is server-rendered and stays up while the
  // session, the board and the room load: no full-screen spinner first.
  return <AuthGate fallback={<Loading />}>{children}</AuthGate>;
}
