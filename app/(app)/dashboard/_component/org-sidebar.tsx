"use client";

import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { Poppins } from "next/font/google";
import { LayoutDashboard, Star } from "lucide-react";
import {
  ClerkLoading,
  OrganizationSwitcher,
  useOrganization,
} from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const font = Poppins({
  subsets: ["latin"],
  weight: ["600"],
});

/** "Team boards" / "Favorite boards"; `favorites` null: neither is marked. */
const NavLinks = ({ favorites }: { favorites: boolean | null }) => {
  const { isLoaded, organization } = useOrganization();

  return (
    <div className="space-y-1 w-full">
      <Button
        variant={favorites === false ? "secondary" : "ghost"}
        asChild
        size="lg"
        className="font-normal justify-start px-2 w-full"
      >
        <Link
          href="/dashboard"
          aria-current={favorites === false ? "page" : undefined}
        >
          <LayoutDashboard className="h-4 w-4 mr-2" />
          {!isLoaded ? "Boards" : organization ? "Team boards" : "Your boards"}
        </Link>
      </Button>
      <Button
        variant={favorites ? "secondary" : "ghost"}
        asChild
        size="lg"
        className="font-normal justify-start px-2 w-full"
      >
        <Link
          href={{
            pathname: "/dashboard",
            query: { favorites: true },
          }}
          aria-current={favorites ? "page" : undefined}
        >
          <Star className="h-4 w-4 mr-2" />
          Favorite boards
        </Link>
      </Button>
    </div>
  );
};

/** The links with the current one marked, which the URL's query says. */
const CurrentNavLinks = () => {
  const searchParams = useSearchParams();

  return <NavLinks favorites={!!searchParams.get("favorites")} />;
};

export const OrgSidebar = () => {
  return (
    <nav
      aria-label="Dashboard"
      className="hidden lg:flex flex-col space-y-6 w-[206px] pl-5 pt-5"
    >
      <Link href="/" aria-label="Board home page">
        <div className="flex items-center gap-x-2">
          <Image src="/logo.svg" alt="Logo" height={60} width={60} />
          <span className={cn("font-semibold text-2xl", font.className)}>
            Board
          </span>
        </div>
      </Link>
      {/* Clerk's own components render nothing until Clerk has loaded. */}
      <ClerkLoading>
        <Skeleton className="h-10 w-full" />
      </ClerkLoading>
      <OrganizationSwitcher
        appearance={{
          elements: {
            rootBox: {
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
            },
            organizationSwitcherTrigger: {
              padding: "6px",
              width: "100%",
              borderRadius: "8px",
              border: "1px solid hsl(var(--border))",
              justifyContent: "space-between",
              backgroundColor: "hsl(var(--background))",
            },
          },
        }}
      />
      <Suspense fallback={<NavLinks favorites={null} />}>
        <CurrentNavLinks />
      </Suspense>
    </nav>
  );
};
