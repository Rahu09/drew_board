"use client";

import { createContext, useContext } from "react";

/**
 * The canvas zoom, for things drawn on the canvas that should keep their
 * screen size at any zoom: selection handles and other users' cursors.
 */
export const CameraScaleContext = createContext(1);

export const useCameraScale = () => useContext(CameraScaleContext);
