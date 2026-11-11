import type { Metadata } from "next";

import { AuthGate } from "@/components/auth/auth-gate";

export const metadata: Metadata = {
  title: "Whiteboard",
  robots: { index: false, follow: false },
};

export default function BoardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGate>{children}</AuthGate>;
}
