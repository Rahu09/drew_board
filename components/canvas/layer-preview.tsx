"use client";

import { memo } from "react";

import { colorToCss } from "@/lib/utils";
import { Layer, LayerType } from "@/types/canvas";
import { useBoardStore } from "@/lib/board-store/context";
import { Rectangle } from "./rectangle";
import { Ellipse } from "./ellipse";
import { Note } from "./note";
import { Text } from "./text";
import { Path } from "./path";
import { Arrow } from "./arrow";
import { ImageView } from "./image-layer";
import { Diamond } from "./diamond";
import { Frame } from "./frame";
import { Embed } from "./embed";
import { Table } from "./table/table-layer";

interface LayerPreviewProps {
  id: string;
  onLayerPointerDown: (e: React.PointerEvent, layerId: string) => void;
  selectionColor?: string;
}

/** One layer of the board, read from the store. */
export const LayerPreview = memo(
  ({ id, onLayerPointerDown, selectionColor }: LayerPreviewProps) => {
    const layer = useBoardStore().useLayer(id);

    if (!layer) {
      return null;
    }

    return (
      <LayerView
        id={id}
        layer={layer}
        onLayerPointerDown={onLayerPointerDown}
        selectionColor={selectionColor}
      />
    );
  }
);

LayerPreview.displayName = "LayerPreview";

/**
 * Draws a layer, see-through as its opacity says. The group's `data-layer`
 * is how the eraser finds the layer under the pointer.
 */
export const LayerView = (props: LayerPreviewProps & { layer: Layer }) => {
  const { opacity } = props.layer;

  return (
    <g
      data-layer={props.id}
      opacity={
        opacity === undefined || opacity >= 100
          ? undefined
          : Math.max(opacity, 0) / 100
      }
    >
      <LayerShape {...props} />
    </g>
  );
};

/** Draws a layer; also used for the shape being dragged out. */
const LayerShape = ({
  id,
  layer,
  onLayerPointerDown,
  selectionColor,
}: LayerPreviewProps & { layer: Layer }) => {
    switch (layer.type) {
      case LayerType.Path:
        return (
          <Path
            key={id}
            points={layer.points}
            onPointerDown={(e) => onLayerPointerDown(e, id)}
            x={layer.x}
            y={layer.y}
            fill={layer.fill ? colorToCss(layer.fill) : "#000"}
            stroke={selectionColor}
          />
        );
      case LayerType.Note:
        return (
          <Note
            id={id}
            layer={layer}
            onPointerDown={onLayerPointerDown}
            selectionColor={selectionColor}
          />
        );
      case LayerType.Text:
        return (
          <Text
            id={id}
            layer={layer}
            onPointerDown={onLayerPointerDown}
            selectionColor={selectionColor}
          />
        );
      case LayerType.Ellipse:
        return (
          <Ellipse
            id={id}
            layer={layer}
            onPointerDown={onLayerPointerDown}
            selectionColor={selectionColor}
          />
        );
      case LayerType.Diamond:
        return (
          <Diamond
            id={id}
            layer={layer}
            onPointerDown={onLayerPointerDown}
            selectionColor={selectionColor}
          />
        );
      case LayerType.Frame:
        return (
          <Frame
            id={id}
            layer={layer}
            onPointerDown={onLayerPointerDown}
            selectionColor={selectionColor}
          />
        );
      case LayerType.Embed:
        return (
          <Embed
            id={id}
            layer={layer}
            onPointerDown={onLayerPointerDown}
            selectionColor={selectionColor}
          />
        );
      case LayerType.Table:
        return (
          <Table
            id={id}
            layer={layer}
            onPointerDown={onLayerPointerDown}
            selectionColor={selectionColor}
          />
        );
      case LayerType.Line:
      case LayerType.Arrow:
        return (
          <Arrow
            id={id}
            layer={layer}
            onPointerDown={onLayerPointerDown}
            selectionColor={selectionColor}
          />
        );
      case LayerType.Image:
        return (
          <ImageView
            id={id}
            layer={layer}
            onPointerDown={onLayerPointerDown}
            selectionColor={selectionColor}
          />
        );
      case LayerType.Rectangle:
        return (
          <Rectangle
            id={id}
            layer={layer}
            onPointerDown={onLayerPointerDown}
            selectionColor={selectionColor}
          />
        );
      default:
        console.warn("Unknown layer type");
        return null;
    }
};
