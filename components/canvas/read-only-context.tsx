"use client";

import { createContext, useContext } from "react";

/** True on read-only boards (share links): nothing can be edited. */
export const CanvasReadOnlyContext = createContext(false);

export const useCanvasReadOnly = () => useContext(CanvasReadOnlyContext);
