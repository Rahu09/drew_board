import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Pages anyone can open. Everything else (the dashboard, boards and API
// routes) requires sign-in: signed-out page visits are sent to Clerk's
// sign-in page and come back afterwards.
const isPublicRoute = createRouteMatcher([
  "/",
  // Guest mode (Phase 3).
  "/try(.*)",
  // In case sign-in/sign-up pages are added to the app later; today they are
  // hosted by Clerk.
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Generated metadata images (app/opengraph-image.tsx, app/apple-icon.tsx).
  // They have no file extension, so the matcher below doesn't skip them.
  "/opengraph-image(.*)",
  "/apple-icon(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
