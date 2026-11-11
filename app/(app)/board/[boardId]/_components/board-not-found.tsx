import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";

export const BoardNotFound = () => {
  return (
    <main className="h-full w-full flex flex-col items-center justify-center bg-neutral-100 p-6 text-center">
      <Image src="/empty-search.svg" height={140} width={140} alt="" />
      <h2 className="text-2xl font-semibold mt-6">Board not found</h2>
      <p className="text-muted-foreground text-sm mt-2 max-w-sm">
        It may have been deleted, or it belongs to an organization
        you aren&apos;t a member of.
      </p>
      <Button asChild size="lg" className="mt-6">
        <Link href="/dashboard">Back to boards</Link>
      </Button>
    </main>
  );
};
