"use client";

import { memo } from "react";
import { shallow } from "@liveblocks/client";

import { useOthersConnectionIds, useOthersMapped } from "@/liveblocks.config";

import { colorToCss, connectionIdToColor } from "@/lib/utils";

import { Cursor } from "./cursor";
import { Path } from "./path";
import { LaserPath } from "./laser";

const Cursors = () => {
  const ids = useOthersConnectionIds();

  return (
    <>
      {ids.map((connectionId) => (
        <Cursor key={connectionId} connectionId={connectionId} />
      ))}
    </>
  );
};

const Drafts = () => {
  const others = useOthersMapped(
    (other) => ({
      pencilDraft: other.presence.pencilDraft,
      penColor: other.presence.penColor,
    }),
    shallow
  );

  return (
    <>
      {others.map(([key, other]) => {
        if (other.pencilDraft) {
          return (
            <Path
              key={key}
              x={0}
              y={0}
              points={other.pencilDraft}
              fill={other.penColor ? colorToCss(other.penColor) : "#000"}
            />
          );
        }

        return null;
      })}
    </>
  );
};

/** Other users' laser pointer trails. */
const Lasers = () => {
  const others = useOthersMapped((other) => other.presence.laser);

  return (
    <>
      {others.map(([connectionId, laser]) =>
        laser ? (
          <LaserPath
            key={connectionId}
            trail={laser}
            color={connectionIdToColor(connectionId)}
          />
        ) : null
      )}
    </>
  );
};

export const CursorsPresence = memo(() => {
  return (
    <>
      <Drafts />
      <Lasers />
      <Cursors />
    </>
  );
});

CursorsPresence.displayName = "CursorsPresence";
