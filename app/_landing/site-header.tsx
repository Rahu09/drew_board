import Link from "next/link";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

import { logoFont } from "./fonts";

interface SiteHeaderProps {
  signedIn: boolean;
}

export const SiteHeader = ({ signedIn }: SiteHeaderProps) => {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-x-2">
          <Image src="/logo.svg" alt="" width={45} height={30} />
          <span className={cn("text-xl font-semibold", logoFont.className)}>
            Board
          </span>
        </Link>
        <nav className="flex items-center gap-x-2">
          <ThemeToggle />
          {signedIn ? (
            <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/dashboard"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Sign in
              </Link>
              <Link
                href="/try"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "hidden sm:inline-flex"
                )}
              >
                Start drawing
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};
