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

export const Navbar = () => {
  const { organization } = useOrganization();

  return (
    <div className="flex items-center gap-x-4 p-5">
      {/* Below lg the sidebar with the logo is hidden. */}
      <Link href="/" aria-label="Board home page" className="lg:hidden shrink-0">
        <Image src="/logo.svg" alt="" height={36} width={36} />
      </Link>
      <div className="hidden lg:flex lg:flex-1">
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
                border: "1px solid #E5E7EB",
                justifyContent: "space-between",
                backgroundColor: "white",
              },
            },
          }}
        />
      </div>
      {organization && <InviteButton />}
      <UserButton />
    </div>
  );
};
