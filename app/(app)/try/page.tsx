import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Try it",
};

// Placeholder until guest mode (Phase 3) lands, so the landing page's
// "Start drawing" button doesn't lead to a 404.
export default function TryPage() {
  return (
    <main className="h-full flex flex-col items-center justify-center gap-4 bg-neutral-100 px-4 text-center">
      <Image src="/note.svg" alt="" width={110} height={110} />
      <h1 className="text-2xl font-semibold">Guest boards are coming soon</h1>
      <p className="max-w-sm text-muted-foreground">
        Soon you&apos;ll be able to draw here without an account. For now,
        sign in to create a board.
      </p>
      <div className="mt-2 flex gap-3">
        <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
          Sign in
        </Link>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
