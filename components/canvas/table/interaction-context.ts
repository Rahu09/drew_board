"use client";

import { createContext, useContext } from "react";

/**
 * Whether a selected table should treat clicks as cell clicks. The canvas
 * turns it off while a tool other than select is in use, so a click on a
 * table with the rectangle tool still starts a rectangle.
 */
export const TableInteractionContext = createContext(true);

export const useTableInteraction = () => useContext(TableInteractionContext);
