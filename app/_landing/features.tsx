import {
  Building2,
  MousePointer2,
  Pencil,
  Search,
  Shapes,
  Undo2,
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
      "See who is on the board, where they are pointing and what they have selected, as it happens.",
    color: "bg-violet-100 text-violet-700",
  },
  {
    icon: Shapes,
    title: "Notes, shapes and text",
    description:
      "Drop sticky notes, rectangles, ellipses and text, then move, resize and recolor them.",
    color: "bg-amber-100 text-amber-700",
  },
  {
    icon: Pencil,
    title: "Freehand pen",
    description:
      "Sketch arrows, circles and doodles with a smooth pen that feels like drawing on paper.",
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    icon: Undo2,
    title: "Undo and redo",
    description:
      "Try things out without worry. Every change can be undone, even mid-session.",
    color: "bg-sky-100 text-sky-700",
  },
  {
    icon: Building2,
    title: "Built for teams",
    description:
      "Boards belong to your organization. Invite teammates and switch between teams in one click.",
    color: "bg-orange-100 text-orange-700",
  },
  {
    icon: Search,
    title: "Find boards fast",
    description:
      "Search boards by title and star the ones you come back to.",
    color: "bg-rose-100 text-rose-700",
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
          A fast, focused canvas for brainstorming, planning and sketching
          with your team.
        </p>
      </div>
      <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, description, color }) => (
          <li
            key={title}
            className="rounded-xl border border-neutral-200 bg-white p-6"
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
