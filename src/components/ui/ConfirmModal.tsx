"use client";

import React, { useEffect, useCallback } from "react";
import { AlertTriangle, Info, CheckCircle2, RefreshCw } from "lucide-react";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info" | "primary";
  icon?: React.ReactNode;
  confirmIcon?: React.ReactNode;
  isLoading?: boolean;
  children?: React.ReactNode;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  icon,
  confirmIcon,
  isLoading = false,
  children,
}: ConfirmModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    },
    [onClose, isLoading]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Determine icon & color themes
  const getIconContainerStyle = () => {
    switch (variant) {
      case "danger":
        return "bg-rose-50 text-rose-600";
      case "warning":
        return "bg-amber-50 text-amber-600";
      case "info":
        return "bg-blue-50 text-blue-600";
      case "primary":
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getDefaultIcon = () => {
    if (icon) return icon;
    switch (variant) {
      case "danger":
      case "warning":
        return <AlertTriangle className="w-5 h-5" />;
      case "info":
        return <Info className="w-5 h-5" />;
      case "primary":
      default:
        return <CheckCircle2 className="w-5 h-5" />;
    }
  };

  const getConfirmBtnStyle = () => {
    switch (variant) {
      case "danger":
        return "bg-rose-600 text-white hover:bg-rose-700 shadow-xs";
      case "warning":
        return "bg-amber-600 text-white hover:bg-amber-700 shadow-xs";
      case "info":
        return "bg-blue-600 text-white hover:bg-blue-700 shadow-xs";
      case "primary":
      default:
        return "bg-slate-900 text-white hover:bg-slate-800 shadow-xs";
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom duration-350 ease-out">
        {/* Mobile slide indicator handle */}
        <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto mb-1 shrink-0" />

        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getIconContainerStyle()}`}
          >
            {getDefaultIcon()}
          </div>
          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900 leading-snug">{title}</h3>
            <div className="text-xs text-slate-500 leading-relaxed">{description}</div>
          </div>
        </div>

        {children && <div className="pt-1">{children}</div>}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${getConfirmBtnStyle()}`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                {confirmIcon}
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
