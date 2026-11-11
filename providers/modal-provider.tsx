"use client";

import { useEffect, useState } from "react";

import { RenameModal } from "@/components/modals/rename-modals";
import { ShareModal } from "@/components/modals/share-modal";

export const ModalProvider = () => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Intentional mount gate to avoid hydration mismatches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <RenameModal />
      <ShareModal />
    </>
  );
};
