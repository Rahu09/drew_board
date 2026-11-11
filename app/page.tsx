import Link from "next/link";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";
import { buttonVariants } from "@/components/ui/button";

// Placeholder landing page. The full design comes in Phase 2. It stays a
// server component with no Clerk, Convex or Liveblocks code.
export default function LandingPage() {
  return (
    <main className="min-h-full flex flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Image src="/logo.svg" alt="" width={96} height={64} priority />
      <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
        {siteConfig.name}
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        {siteConfig.description}
      </p>
      <Link
        href="/dashboard"
        className={cn(buttonVariants({ size: "lg" }), "text-base")}
      >
        Go to your boards
      </Link>
      <p className="text-sm text-muted-foreground">
        You&apos;ll be asked to sign in if you aren&apos;t already.
      </p>
    </main>
  );
}
