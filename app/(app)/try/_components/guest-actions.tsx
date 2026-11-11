"use client";

import { useEffect, useRef } from "react";
import { Save } from "lucide-react";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

import {
  isGuestIntent,
  signInRedirectUrl,
  useSaveGuestBoard,
  type GuestIntent,
} from "./use-save-guest-board";

/**
 * Save and Share. Signed out, they open Clerk's sign-in pop-up; sign-in then
 * returns to /try with the intent, and the board is saved automatically.
 */
export const GuestActions = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const { save, pending } = useSaveGuestBoard();
  const handledIntent = useRef(false);

  const intent = searchParams.get("intent");
  const saveLabel = isSignedIn ? "Save to my boards" : "Sign in to save";

  // Back from sign-in: finish what the guest started, once.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !isGuestIntent(intent)) return;
    if (handledIntent.current) return;

    handledIntent.current = true;
    router.replace("/try");
    void save(intent);
  }, [isLoaded, isSignedIn, intent, router, save]);

  const gated = (target: GuestIntent, button: React.ReactElement) =>
    isSignedIn ? (
      button
    ) : (
      <SignInButton
        mode="modal"
        forceRedirectUrl={signInRedirectUrl(target)}
        signUpForceRedirectUrl={signInRedirectUrl(target)}
      >
        {button}
      </SignInButton>
    );

  return (
    <>
      {gated(
        "save",
        <Button
          variant="outline"
          className="h-9 rounded-lg px-3 shadow-sm"
          disabled={!isLoaded || pending}
          onClick={isSignedIn ? () => save("save") : undefined}
          aria-label={saveLabel}
        >
          <Save className="h-4 w-4" />
          <span className="hidden md:inline">{saveLabel}</span>
        </Button>
      )}
      {gated(
        "share",
        <Button
          className="h-9 rounded-lg bg-indigo-500 px-4 text-white hover:bg-indigo-600"
          disabled={!isLoaded || pending}
          onClick={isSignedIn ? () => save("share") : undefined}
        >
          Share
        </Button>
      )}
      {isSignedIn && (
        <div className="flex items-center">
          <UserButton />
        </div>
      )}
    </>
  );
};
