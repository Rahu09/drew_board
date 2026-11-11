"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { useTheme } from "next-themes";

interface ConvexClientProviderProps {
  children: React.ReactNode;
}

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

const convex = new ConvexReactClient(convexUrl);

// Clerk's own components (account menu, org switcher, sign-in) in the dark
// theme: the colors of the dark tokens in globals.css.
const darkAppearance = {
  variables: {
    colorBackground: "#020817",
    colorForeground: "#f8fafc",
    colorMuted: "#1e293b",
    colorMutedForeground: "#94a3b8",
    colorInput: "#020817",
    colorInputForeground: "#f8fafc",
    colorBorder: "#1e293b",
    colorNeutral: "#ffffff",
    colorPrimary: "#6366f1",
  },
};

/**
 * Clerk + Convex for the app routes. It does not require sign-in by itself:
 * pages that need a user wrap their content in <AuthGate>.
 */
export const ConvexClientProvider = ({
  children,
}: ConvexClientProviderProps) => {
  const { resolvedTheme } = useTheme();

  return (
    <ClerkProvider
      appearance={resolvedTheme === "dark" ? darkAppearance : undefined}
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <ConvexProviderWithClerk useAuth={useAuth} client={convex}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
};
