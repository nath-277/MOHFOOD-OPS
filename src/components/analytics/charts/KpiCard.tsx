"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  badge?: { text: string; variant: "success" | "warning" | "danger" | "neutral" };
  icon?: LucideIcon;
  iconBg?: string;
}

export function KpiCard({ title, value, subtitle, badge, icon: Icon, iconBg }: KpiCardProps) {
  const badgeClasses = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    neutral: "bg-slate-100 text-slate-600 border-slate-200",
  }[badge?.variant || "neutral"];

  return (
    <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg || "bg-slate-100 text-slate-600"}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-black text-slate-900 tracking-tight">{value}</span>
        {badge && (
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${badgeClasses}`}>
            {badge.text}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1.5 text-[11px] text-slate-500 font-medium leading-tight">{subtitle}</p>}
    </div>
  );
}
