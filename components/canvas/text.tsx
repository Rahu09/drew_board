import { useLayoutEffect, useRef } from "react";

import { TextLayer } from "@/types/canvas";
import { colorToCss } from "@/lib/utils";
import { useBoardStore } from "@/lib/board-store/context";

import { PlainTextEditable } from "./plain-text-editable";
import { useCanvasReadOnly } from "./read-only-context";
import { overflowAt, textLayerFontSize } from "./text-metrics";
import { layerFontFamily, layerTextAlign } from "./fonts";

interface TextProps {
  id: string;
  layer: TextLayer;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  selectionColor?: string;
}

/** How much taller the box must get to show all of its text. */
const overflowOf = (container: Element | null, fontSize: number) => {
  const editable = container?.querySelector<HTMLElement>("[contenteditable]");
  return editable ? overflowAt(editable, fontSize) : 0;
};

export const Text = ({
  layer,
  onPointerDown,
  id,
  selectionColor,
}: TextProps) => {
  const { x, y, width, height, fill, value } = layer;
  const fontSize = textLayerFontSize(layer);
  const { actions } = useBoardStore();
  const readOnly = useCanvasReadOnly();
  const ref = useRef<SVGForeignObjectElement>(null);

  // The box grows so no line is cut off: after a resize that made it too
  // small or too narrow, or an edit by someone else. Only the person who
  // has it selected writes the new height, so clients don't all write it.
  useLayoutEffect(() => {
    if (readOnly || !actions.getSelection().includes(id)) return;

    const grow = overflowOf(ref.current, fontSize);
    if (grow > 0) {
      actions.updateLayer(id, { height: height + grow });
    }
  }, [actions, fontSize, height, id, readOnly, value, width, layer.fontFamily]);

  return (
    <g>
      <foreignObject
        ref={ref}
        data-layer-id={id}
        x={x}
        y={y}
        width={width}
        height={height}
        onPointerDown={(e) => onPointerDown(e, id)}
      >
        <PlainTextEditable
          value={value}
          fallback="Text"
          readOnly={readOnly}
          onChange={(text) => {
            // One change for the text and the height it needs, so a single
            // undo takes back both.
            const grow = overflowOf(ref.current, fontSize);
            actions.updateLayer(
              id,
              grow > 0 ? { value: text, height: height + grow } : { value: text }
            );
          }}
          style={{
            fontSize,
            fontFamily: layerFontFamily(layer.fontFamily),
            textAlign: layerTextAlign(layer.textAlign),
            color: fill ? colorToCss(fill) : "#000",
          }}
        />
      </foreignObject>
      {selectionColor && (
        <rect
          x={x - 1}
          y={y - 1}
          width={width + 2}
          height={height + 2}
          fill="none"
          stroke={selectionColor}
          strokeWidth={1}
          pointerEvents="none"
        />
      )}
    </g>
  );
};
