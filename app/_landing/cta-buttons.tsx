import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface CtaButtonsProps {
  signedIn: boolean;
  /** Use on dark backgrounds. */
  inverted?: boolean;
  className?: string;
}

export const CtaButtons = ({
  signedIn,
  inverted = false,
  className,
}: CtaButtonsProps) => {
  const primary = cn(
    buttonVariants({ size: "lg" }),
    "h-12 px-6 text-base gap-x-2",
    inverted && "bg-white text-blue-950 hover:bg-white/90"
  );
  const secondary = cn(
    buttonVariants({ variant: "outline", size: "lg" }),
    "h-12 px-6 text-base",
    inverted &&
      "border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
  );

  return (
    <div
      className={cn(
        "flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center",
        className
      )}
    >
      {signedIn ? (
        <Link href="/dashboard" className={primary}>
          Go to dashboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <>
          <Link href="/try" className={primary}>
            Start drawing, no sign-up
            <ArrowRight className="h-4 w-4" />
          </Link>
          {/* Signed-out visits to /dashboard go through Clerk's sign-in and
              come back to the dashboard. */}
          <Link href="/dashboard" className={secondary}>
            Sign in
          </Link>
        </>
      )}
    </div>
  );
};
