import { DiamondLayer } from "@/types/canvas";

import { Shape } from "./shape";

interface DiamondProps {
  id: string;
  layer: DiamondLayer;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  selectionColor?: string;
}

export const Diamond = (props: DiamondProps) => <Shape {...props} />;
