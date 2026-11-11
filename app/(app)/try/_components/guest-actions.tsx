"use client";

import { useEffect, useRef } from "react";
import { Save, Share2 } from "lucide-react";
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
    <div className="absolute top-2 right-2 h-12 bg-white rounded-md px-1.5 flex items-center gap-x-1 shadow-md">
      {gated(
        "share",
        <Button
          variant="board"
          disabled={!isLoaded || pending}
          onClick={isSignedIn ? () => save("share") : undefined}
          aria-label="Share"
        >
          <Share2 className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      )}
      {gated(
        "save",
        <Button
          disabled={!isLoaded || pending}
          onClick={isSignedIn ? () => save("save") : undefined}
          aria-label={saveLabel}
        >
          <Save className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">{saveLabel}</span>
        </Button>
      )}
      {isSignedIn && (
        <div className="pl-1 flex items-center">
          <UserButton />
        </div>
      )}
    </div>
  );
};
