import React from "react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = "md",
  showTagline = true,
  className = "",
}) => {
  const sizeMap = {
    sm: { container: "h-10", text: "text-lg", sub: "text-[9px]" },
    md: { container: "h-14", text: "text-2xl", sub: "text-xs" },
    lg: { container: "h-20", text: "text-4xl", sub: "text-sm" },
  };

  const { container, text, sub } = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Brand Icon Badge */}
      <div
        className={`${container} aspect-square rounded-2xl bg-gradient-to-br from-[#D81B60] via-[#C2185B] to-[#AD1457] p-1 flex items-center justify-center shadow-md relative overflow-hidden border-2 border-white/20`}
      >
        {/* Avocado lime accent arc at the top */}
        <div className="absolute top-0 right-0 left-0 h-2 bg-[#84BD00] rounded-t-2xl opacity-90" />
        
        {/* Center Cream Circle */}
        <div className="w-full h-full rounded-xl bg-[#FFFDF9] flex flex-col items-center justify-center relative shadow-inner">
          <span className="font-extrabold text-[#D81B60] leading-none tracking-tight text-center text-sm font-serif">
            MOH
          </span>
          <span className="text-[7px] font-bold text-[#008153] uppercase tracking-widest leading-none mt-0.5">
            FOOD
          </span>
        </div>
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className={`font-black text-[#2B1B24] tracking-tight ${text}`}>
            Moh <span className="text-[#D81B60]">Food</span>
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#E8F5E9] text-[#008153] border border-[#008153]/20">
            OPS
          </span>
        </div>
        {showTagline && (
          <span className={`italic font-medium text-[#7CB342] ${sub} -mt-0.5`}>
            Be nourished • Lagos & Ogun Operations
          </span>
        )}
      </div>
    </div>
  );
};
