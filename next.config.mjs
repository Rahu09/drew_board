/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
  async redirects() {
    // The dashboard used to live at "/". Old links like "/?favorites=true"
    // or "/?search=x" go to the dashboard; the query string is kept.
    return ["favorites", "search"].map((key) => ({
      source: "/",
      has: [{ type: "query", key }],
      destination: "/dashboard",
      permanent: false,
    }));
  },
};

export default nextConfig;
