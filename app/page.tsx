import { auth } from "@clerk/nextjs/server";

import { CanvasDemo } from "./_landing/canvas-demo";
import { CtaButtons } from "./_landing/cta-buttons";
import { Features } from "./_landing/features";
import { SiteFooter } from "./_landing/site-footer";
import { SiteHeader } from "./_landing/site-header";

// Public landing page. Server components only: no Clerk, Convex or
// Liveblocks code reaches the browser. auth() reads the session on the
// server (proxy.ts runs clerkMiddleware on "/"), so the page is rendered per
// request to show the right buttons.
export default async function LandingPage() {
  const { userId } = await auth();
  const signedIn = userId !== null;

  return (
    <div className="min-h-full bg-background">
      <SiteHeader signedIn={signedIn} />
      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(#e5e5e5_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
          />
          <div className="mx-auto max-w-3xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24">
            <p className="inline-flex items-center gap-x-2 rounded-full border bg-background px-3 py-1 text-sm text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Real-time collaborative whiteboard
            </p>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Sketch it out,{" "}
              <span className="bg-linear-to-r from-sky-500 to-orange-500 bg-clip-text text-transparent">
                together
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
              Board is a shared canvas for your team. Drop sticky notes, draw
              shapes and freehand, and watch everyone&apos;s cursor move live.
            </p>
            <CtaButtons signedIn={signedIn} className="mt-10" />
            {!signedIn && (
              <p className="mt-4 text-sm text-muted-foreground">
                Try it in your browser. Sign in when you want to save and
                share.
              </p>
            )}
          </div>
          <div className="mx-auto max-w-5xl px-4 pb-8 sm:px-6">
            <CanvasDemo />
          </div>
        </section>

        <Features />

        <section className="px-4 pb-20 sm:px-6 sm:pb-28">
          <div className="mx-auto max-w-6xl rounded-2xl bg-blue-950 dark:ring-1 dark:ring-blue-900 px-6 py-14 text-center text-white sm:py-20">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Your next idea needs a canvas
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100/80">
              Open a board and start drawing in seconds.
            </p>
            <CtaButtons signedIn={signedIn} inverted className="mt-8" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
