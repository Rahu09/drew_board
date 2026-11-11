import { RectangleLayer } from "@/types/canvas";

import { Shape } from "./shape";

interface RectangleProps {
  id: string;
  layer: RectangleLayer;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  selectionColor?: string;
}

export const Rectangle = (props: RectangleProps) => <Shape {...props} />;
