// Shared site details for metadata, Open Graph and the landing page.

const resolveSiteUrl = () => {
  // Set this when the app gets a custom domain.
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Provided by Vercel at build time: the production domain of the project.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  return "http://localhost:3000";
};

export const siteConfig = {
  name: "Board",
  title: "Board: a real-time collaborative whiteboard",
  description:
    "Sketch, plan and brainstorm together on an infinite whiteboard. Shapes, sticky notes, text and a freehand pen, with live cursors for your whole team.",
  url: resolveSiteUrl(),
};
