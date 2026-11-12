"use client";

import { useState, useSyncExternalStore } from "react";
import { ExternalLink, Globe } from "lucide-react";
import { toast } from "sonner";

import { EmbedLayer } from "@/types/canvas";
import { useBoardStore } from "@/lib/board-store/context";

import { hostOf, isWebKit, toEmbedUrl } from "./embed-url";
import { useCanvasReadOnly } from "./read-only-context";

interface EmbedProps {
  id: string;
  layer: EmbedLayer;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  selectionColor?: string;
}

const BAR_HEIGHT = 30;

const subscribeNever = () => () => {};

/**
 * A web page shown in the board. While it is only selected it is a picture
 * you can move and resize: a click on the frame would otherwise go into the
 * page. Double-click (or "Interact") hands the mouse to the page.
 */
export const Embed = ({
  id,
  layer,
  onPointerDown,
  selectionColor,
}: EmbedProps) => {
  const { x, y, width, height, src } = layer;
  const store = useBoardStore();
  const { actions } = store;
  const readOnly = useCanvasReadOnly();
  const selection = store.useSelection();
  const isSole = selection.length === 1 && selection[0] === id;
  const [live, setLive] = useState(false);
  const [draft, setDraft] = useState("");
  // The server and the first client render agree (not WebKit).
  const webkit = useSyncExternalStore(subscribeNever, isWebKit, () => false);

  // Back to a picture when something else is picked.
  const [wasSole, setWasSole] = useState(isSole);
  if (wasSole !== isSole) {
    setWasSole(isSole);
    if (!isSole) setLive(false);
  }

  const submit = () => {
    const embed = toEmbedUrl(draft);

    if (!embed) {
      toast.error("Paste a web link (https://…)");
      return;
    }

    actions.updateLayer(id, { src: embed });
  };

  // Nothing to show yet: ask for a link.
  if (!src) {
    return (
      <g onPointerDown={(e) => onPointerDown(e, id)}>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={10}
          fill="#f8f9fa"
          stroke={selectionColor ?? "#ced4da"}
          strokeWidth={2}
          strokeDasharray="6 4"
        />
        <foreignObject x={x} y={y} width={width} height={height}>
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: 16,
              boxSizing: "border-box",
              color: "#495057",
              fontSize: 14,
            }}
          >
            <span>Paste a link to embed (YouTube, Vimeo, Figma, a web page…)</span>
            {!readOnly && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{ display: "flex", gap: 6, width: "100%", maxWidth: 420 }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="https://"
                  aria-label="Link to embed"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 34,
                    border: "1px solid #ced4da",
                    borderRadius: 6,
                    padding: "0 10px",
                    fontSize: 14,
                    background: "white",
                    color: "#212529",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    height: 34,
                    padding: "0 14px",
                    border: "none",
                    borderRadius: 6,
                    background: "#6366f1",
                    color: "white",
                    fontSize: 14,
                  }}
                >
                  Embed
                </button>
              </form>
            )}
          </div>
        </foreignObject>
      </g>
    );
  }

  return (
    <g>
      {webkit ? (
        <g onPointerDown={(e) => onPointerDown(e, id)}>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            rx={10}
            fill="#f8f9fa"
            stroke="#ced4da"
            strokeWidth={2}
          />
          <foreignObject x={x} y={y} width={width} height={height}>
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: 12,
                boxSizing: "border-box",
                color: "#495057",
                fontSize: 14,
                textAlign: "center",
              }}
            >
              <Globe width={28} height={28} />
              <span>{hostOf(src)}</span>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                onPointerDown={(e) => e.stopPropagation()}
                style={{ color: "#4f46e5", textDecoration: "underline" }}
              >
                Open in a new tab
              </a>
            </div>
          </foreignObject>
        </g>
      ) : (
        <>
          <rect x={x} y={y} width={width} height={height} fill="white" />
          <foreignObject x={x} y={y} width={width} height={height}>
            <iframe
              src={src}
              title={`Embedded page: ${hostOf(src)}`}
              loading="lazy"
              // YouTube and others refuse a frame that says nothing about
              // who embeds it. Only the site's address is sent, not the path
              // (so never the board's id).
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms"
              allow="fullscreen; picture-in-picture; encrypted-media; clipboard-write"
              style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            />
          </foreignObject>
          {!live && (
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              fill="transparent"
              onPointerDown={(e) => onPointerDown(e, id)}
              onDoubleClick={() => setLive(true)}
            />
          )}
        </>
      )}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke={selectionColor ?? "#ced4da"}
        strokeWidth={selectionColor ? 2 : 1}
        pointerEvents="none"
      />
      {isSole && !webkit && (
        <foreignObject x={x} y={y - BAR_HEIGHT - 4} width={Math.max(width, 260)} height={BAR_HEIGHT}>
          <div
            onPointerDown={(e) => e.stopPropagation()}
            style={{ display: "flex", gap: 6, alignItems: "center", height: "100%" }}
          >
            <button
              type="button"
              onClick={() => setLive((value) => !value)}
              style={{
                height: 26,
                padding: "0 10px",
                border: "1px solid #ced4da",
                borderRadius: 6,
                background: live ? "#e0e7ff" : "white",
                color: "#212529",
                fontSize: 13,
              }}
            >
              {live ? "Stop interacting" : "Interact"}
            </button>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                height: 26,
                padding: "0 10px",
                border: "1px solid #ced4da",
                borderRadius: 6,
                background: "white",
                color: "#212529",
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              <ExternalLink width={13} height={13} />
              Open
            </a>
          </div>
        </foreignObject>
      )}
    </g>
  );
};
