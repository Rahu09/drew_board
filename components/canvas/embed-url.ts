// Turns a link pasted into a web embed into the address of something that
// can be shown in an iframe. Known sites (YouTube, Vimeo, Spotify, Loom,
// Figma) have their own embed address; any other https page is used as it
// is (many sites refuse to be shown in a frame; that is theirs to decide).

const MAX_URL_LENGTH = 2048;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/** The embed address for a link, or null when it isn't a usable link. */
export const toEmbedUrl = (input: string): string | null => {
  const text = input.trim();
  if (!text || text.length > MAX_URL_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }

  // The board is served over https, which can't show http frames. Anything
  // that is not a web address (javascript:, data:, file:) is refused.
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.protocol !== "https:" || !url.hostname.includes(".")) return null;

  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  if (YOUTUBE_HOSTS.has(host) || host === "youtu.be") {
    const id =
      host === "youtu.be"
        ? path.slice(1)
        : url.searchParams.get("v") ??
          /^\/(?:embed|shorts|live)\/([\w-]+)/.exec(path)?.[1] ??
          "";

    if (/^[\w-]{6,20}$/.test(id.split("/")[0])) {
      return `https://www.youtube-nocookie.com/embed/${id.split("/")[0]}`;
    }
    return null;
  }

  if (host === "vimeo.com" || host === "www.vimeo.com") {
    const id = /\/(\d{5,})(?:\/|$)/.exec(path)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }

  const spotify = /^\/(track|album|playlist|artist|episode|show)\/(\w+)/.exec(path);
  if (host === "open.spotify.com" && spotify) {
    return `https://open.spotify.com/embed/${spotify[1]}/${spotify[2]}`;
  }

  const loom = /^\/share\/(\w+)/.exec(path);
  if ((host === "loom.com" || host === "www.loom.com") && loom) {
    return `https://www.loom.com/embed/${loom[1]}`;
  }

  if (
    (host === "figma.com" || host === "www.figma.com") &&
    /^\/(file|design|proto|board|slides)\//.test(path)
  ) {
    return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url.toString())}`;
  }

  return url.toString();
};

/**
 * Safari and every iPhone browser (WebKit) draw frames inside the board's
 * SVG in the wrong place or not at all, so there an embed is shown as a
 * link card instead.
 */
export const isWebKit = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;

  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (/Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/.test(ua))
  );
};

/** The host of an embed address, for labels. */
export const hostOf = (src: string) => {
  try {
    return new URL(src).hostname.replace(/^www\./, "");
  } catch {
    return src;
  }
};
