import { ImageLayer } from "@/types/canvas";

interface ImageViewProps {
  id: string;
  layer: ImageLayer;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  selectionColor?: string;
}

export const ImageView = ({
  id,
  layer,
  onPointerDown,
  selectionColor,
}: ImageViewProps) => {
  const { x, y, width, height, src } = layer;

  return (
    <g onPointerDown={(e) => onPointerDown(e, id)}>
      <image
        href={src}
        x={x}
        y={y}
        width={width}
        height={height}
        preserveAspectRatio="none"
        // Only https URLs get here (see lib/board-store/validate.ts and the
        // upload in components/canvas/use-image-upload.ts).
        crossOrigin="anonymous"
      />
      {selectionColor && (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="none"
          stroke={selectionColor}
          strokeWidth={2}
          pointerEvents="none"
        />
      )}
    </g>
  );
};
