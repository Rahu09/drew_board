"use client";

import { useEffect, useState } from "react";

import { ShareModal } from "@/components/modals/share-modal";
import { ShareLinkModal } from "@/components/modals/share-link-modal";

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
      <ShareModal />
      <ShareLinkModal />
    </>
  );
};
