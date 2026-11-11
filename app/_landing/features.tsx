import {
  Download,
  Keyboard,
  MessageCircle,
  MousePointer2,
  Pencil,
  Shapes,
  Smartphone,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
}

const features: Feature[] = [
  {
    icon: MousePointer2,
    title: "Live cursors",
    description:
      "See who is on the board, where they are pointing and what they have selected. Click a teammate to follow their view.",
    color: "bg-violet-100 text-violet-700",
  },
  {
    icon: Shapes,
    title: "Hand-drawn shapes",
    description:
      "Rectangles, ellipses, arrows, sticky notes and text with a sketchy, hand-drawn look. Choose colors, fills, fonts and how rough the lines are.",
    color: "bg-amber-100 text-amber-700",
  },
  {
    icon: Pencil,
    title: "Pen, eraser and laser",
    description:
      "Sketch freehand with a smooth pen, rub things out with the eraser, and point things out with a laser that fades away.",
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    icon: MessageCircle,
    title: "Comments",
    description:
      "Pin a comment anywhere on the board, reply in a thread and resolve it when it is done.",
    color: "bg-sky-100 text-sky-700",
  },
  {
    icon: Download,
    title: "Images and export",
    description:
      "Drop images onto the board. Export it as a PNG or SVG, or save it as a file you can open again later.",
    color: "bg-rose-100 text-rose-700",
  },
  {
    icon: Users,
    title: "Yours, or your team's",
    description:
      "Keep personal boards, move one into a team when it is ready to share, or send a read-only link to anyone.",
    color: "bg-orange-100 text-orange-700",
  },
  {
    icon: Zap,
    title: "No sign-up to start",
    description:
      "Open a board and draw right away. It stays in your browser until you sign in to save it.",
    color: "bg-indigo-100 text-indigo-700",
  },
  {
    icon: Smartphone,
    title: "Phone and dark mode",
    description:
      "A touch layout with pinch to zoom for small screens, and a dark theme for late sessions.",
    color: "bg-teal-100 text-teal-700",
  },
  {
    icon: Keyboard,
    title: "Quick to get around",
    description:
      "A shortcut for every tool, a command palette, undo and redo. On the dashboard, search, sort and star your boards.",
    color: "bg-fuchsia-100 text-fuchsia-700",
  },
];

export const Features = () => {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2
          id="features-heading"
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Everything a whiteboard needs, nothing it doesn&apos;t
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          A fast, focused canvas for brainstorming, planning and sketching,
          on your own or with your team.
        </p>
      </div>
      <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, description, color }) => (
          <li
            key={title}
            className="rounded-xl border bg-card p-6"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-muted-foreground">{description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};
