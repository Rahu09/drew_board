import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { useRename } from "@/store/use-rename";
import { InlineTitleInput } from "@/components/inline-title";

interface FooterProps {
  id: string;
  title: string;
  /** "Edited by You, 2 minutes ago". */
  metaLabel: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export const Footer = ({
  id,
  title,
  metaLabel,
  isFavorite,
  onToggleFavorite,
}: FooterProps) => {
  const isEditing = useRename((state) => state.editingId === id);

  return (
    <div className="relative bg-card p-3">
      {isEditing ? (
        <InlineTitleInput
          id={id}
          title={title}
          className="relative z-10 -my-0.5 h-6 w-[calc(100%-20px)] text-[13px]"
        />
      ) : (
        <p className="text-[13px] truncate max-w-[calc(100%-20px)]">{title}</p>
      )}
      <p className="text-[11px] text-muted-foreground truncate">{metaLabel}</p>
      <button
        type="button"
        onClick={onToggleFavorite}
        aria-label={isFavorite ? `Unfavorite ${title}` : `Favorite ${title}`}
        aria-pressed={isFavorite}
        className={cn(
          "absolute top-3 right-3 z-10 rounded text-muted-foreground transition hover:text-blue-600 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
          !isFavorite &&
            "lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 focus-visible:opacity-100"
        )}
      >
        <Star
          className={cn("h-4 w-4", isFavorite && "fill-blue-600 text-blue-600")}
        />
      </button>
    </div>
  );
};
