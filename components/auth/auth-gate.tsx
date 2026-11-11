"use client";

import { AuthLoading, Authenticated } from "convex/react";

import { Loading } from "@/components/auth/loading";

interface AuthGateProps {
  children: React.ReactNode;
  /**
   * Shown while the token loads. Give the page's own skeleton, so it is
   * server-rendered in place instead of a full-screen spinner.
   */
  fallback?: React.ReactNode;
}

/**
 * Renders its children only once Convex has a valid Clerk token. proxy.ts
 * already sends signed-out visitors to sign-in, so this only covers the short
 * wait while the token loads.
 */
export const AuthGate = ({ children, fallback }: AuthGateProps) => {
  return (
    <>
      <Authenticated>{children}</Authenticated>
      <AuthLoading>{fallback ?? <Loading />}</AuthLoading>
    </>
  );
};
