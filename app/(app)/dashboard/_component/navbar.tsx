"use client";

import Link from "next/link";
import Image from "next/image";
import {
  UserButton,
  OrganizationSwitcher,
  useOrganization,
} from "@clerk/nextjs";

import { SearchInput } from "./search-input";
import { InviteButton } from "./invite-button";
import { ThemeToggle } from "@/components/theme-toggle";

export const Navbar = () => {
  const { organization } = useOrganization();

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:p-5">
      {/* Below lg the sidebar with the logo is hidden. */}
      <Link href="/" aria-label="Board home page" className="lg:hidden shrink-0">
        <Image src="/logo.svg" alt="" height={36} width={36} />
      </Link>
      {/* Its own row below lg, after the org switcher and account. */}
      <div className="order-last basis-full lg:order-none lg:basis-auto lg:flex-1">
        <SearchInput />
      </div>
      <div className="block lg:hidden flex-1 min-w-0">
        <OrganizationSwitcher
          appearance={{
            elements: {
              rootBox: {
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                maxWidth: "376px",
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
      </div>
      {organization && <InviteButton />}
      <ThemeToggle />
      <UserButton />
    </header>
  );
};
