"use client";

import { useEffect, useRef } from "react";

/**
 * useModalBackHandler
 *
 * Provides a native mobile/PWA experience for modals:
 * - When `isOpen` becomes true, pushes a history state `{ mohModal: true }`.
 * - When the user triggers the Android back gesture or browser back button (`popstate`),
 *   calls `onClose()`.
 * - When the modal is closed by UI interaction (e.g. clicking "X" or "Cancel"),
 *   safely cleans up the pushed history entry without triggering an exit or navigation loop.
 */
export function useModalBackHandler(isOpen: boolean, onClose: () => void) {
  const isPushedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isOpen) {
      window.history.pushState({ mohModal: true }, "");
      isPushedRef.current = true;

      const handlePopState = () => {
        if (isPushedRef.current) {
          isPushedRef.current = false;
          onCloseRef.current();
        }
      };

      window.addEventListener("popstate", handlePopState);

      return () => {
        window.removeEventListener("popstate", handlePopState);
        if (isPushedRef.current) {
          isPushedRef.current = false;
          if (window.history.state?.mohModal) {
            window.history.back();
          }
        }
      };
    }
  }, [isOpen]);
}
