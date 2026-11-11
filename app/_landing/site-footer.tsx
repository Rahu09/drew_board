import Link from "next/link";
import Image from "next/image";

import { cn } from "@/lib/utils";

import { logoFont } from "./fonts";

export const SiteFooter = () => {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <Link href="/" className="flex items-center gap-x-2 text-foreground">
          <Image src="/logo.svg" alt="" width={30} height={20} />
          <span className={cn("font-semibold", logoFont.className)}>Board</span>
        </Link>
        <p>A real-time collaborative whiteboard.</p>
      </div>
    </footer>
  );
};
