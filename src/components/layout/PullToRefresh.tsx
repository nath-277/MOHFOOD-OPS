"use client";

import React, { useState, useRef } from "react";
import { RotateCw, ArrowDown } from "lucide-react";
import { usePwa } from "@/components/layout/pwa-provider";

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<void> | void;
  className?: string;
}

const PULL_THRESHOLD = 110; // px required to trigger reload
const MAX_PULL = 135; // px max elastic pull distance
const MIN_DRAG_TRIGGER = 30; // px minimum drag before showing pull indicator

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  className = "",
}) => {
  const { refreshApp } = usePwa();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);

  // Helper to detect if touch event started inside an active modal, dialog, or form element
  const shouldBlockPull = (target: HTMLElement | null): boolean => {
    if (!target) return false;

    // 1. Target element is or is inside an interactive, fixed, or modal component
    if (
      target.closest(
        '[role="dialog"], [data-modal], .fixed, input, textarea, select, button, form, [data-prevent-pull]'
      )
    ) {
      return true;
    }

    // 2. An overlay or dialog is currently present anywhere in the DOM
    if (
      typeof document !== "undefined" &&
      document.querySelector(
        '[role="dialog"], [data-modal="true"], .fixed.inset-0, [data-modal-open="true"]'
      )
    ) {
      return true;
    }

    // 3. Any intermediate ancestor is scrollable and not at top
    let parent: HTMLElement | null = target;
    const container = containerRef.current;
    while (parent && parent !== container) {
      if (parent.scrollTop > 0) return true;
      parent = parent.parentElement;
    }

    return false;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isRefreshing) return;

    const target = e.target as HTMLElement | null;
    if (shouldBlockPull(target)) {
      startYRef.current = null;
      isPullingRef.current = false;
      return;
    }

    // Check if the scrollable container or window is at the top
    const container = containerRef.current;
    const isAtTop = container ? container.scrollTop <= 0 : window.scrollY <= 0;

    if (isAtTop) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    } else {
      startYRef.current = null;
      isPullingRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isPullingRef.current || startYRef.current === null || isRefreshing) return;

    const target = e.target as HTMLElement | null;
    if (shouldBlockPull(target)) {
      setPullDistance(0);
      isPullingRef.current = false;
      startYRef.current = null;
      return;
    }

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    // Only handle downward drag from the top once exceeding minimum threshold
    if (diff > MIN_DRAG_TRIGGER) {
      // Apply rubber-band dampening curve
      const distance = Math.min(MAX_PULL, (diff - MIN_DRAG_TRIGGER) * 0.42);
      setPullDistance(distance);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPullingRef.current || isRefreshing) return;

    isPullingRef.current = false;
    startYRef.current = null;

    if (pullDistance >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(50); // Keep indicator visible while refreshing

      // Native haptic pulse on mobile if supported
      try {
        if (typeof window !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(25);
        }
      } catch {
        // ignore
      }

      try {
        if (onRefresh) {
          await onRefresh();
        } else {
          await refreshApp();
        }
      } catch (err) {
        console.warn("[MOH-OPS] Pull-to-refresh failed:", err);
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 500);
      }
    } else {
      setPullDistance(0);
    }
  };

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative ${className}`}
    >
      {/* Floating pull indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 shadow-md text-slate-700 text-xs font-semibold transition-all duration-150 pointer-events-none"
          style={{
            transform: `translate(-50%, ${Math.max(0, pullDistance - 20)}px)`,
            opacity: Math.max(0.2, progress),
          }}
        >
          {isRefreshing ? (
            <>
              <RotateCw className="w-3.5 h-3.5 text-[#CF0458] animate-spin shrink-0" />
              <span className="text-[11px] font-bold text-[#CF0458]">Refreshing MOH-OPS...</span>
            </>
          ) : pullDistance >= PULL_THRESHOLD ? (
            <>
              <RotateCw className="w-3.5 h-3.5 text-[#CF0458] shrink-0" />
              <span className="text-[11px] font-bold text-slate-900">Release to reload</span>
            </>
          ) : (
            <>
              <ArrowDown
                className="w-3.5 h-3.5 text-slate-500 transition-transform shrink-0"
                style={{ transform: `rotate(${progress * 180}deg)` }}
              />
              <span className="text-[11px] text-slate-500">Pull down to refresh</span>
            </>
          )}
        </div>
      )}

      {children}
    </div>
  );
};
