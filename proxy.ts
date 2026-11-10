import { clerkMiddleware } from "@clerk/nextjs/server";

// Every route requires a signed-in user (same behavior as the old
// `authMiddleware({})` from Clerk v4). Signed-out page visits are redirected
// to the Clerk sign-in page.
export default clerkMiddleware(async (auth) => {
  await auth.protect();
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
