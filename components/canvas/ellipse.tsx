import { EllipseLayer } from "@/types/canvas";

import { Shape } from "./shape";

interface EllipseProps {
  id: string;
  layer: EllipseLayer;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  selectionColor?: string;
}

export const Ellipse = (props: EllipseProps) => <Shape {...props} />;
