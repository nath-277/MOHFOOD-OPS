import React from "react";
import Image from "next/image";

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
    sm: { img: 34, text: "text-base", sub: "text-[10px]" },
    md: { img: 44, text: "text-xl", sub: "text-xs" },
    lg: { img: 60, text: "text-2xl", sub: "text-sm" },
  };

  const { img, text, sub } = sizeMap[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Official Circular Logo Badge */}
      <div className="relative shrink-0 flex items-center justify-center">
        <Image
          src="/Moh-logo.png"
          alt="Moh Food Logo"
          width={img}
          height={img}
          className="object-contain"
          priority
        />
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-1.5">
          <span className={`font-black text-slate-900 tracking-tight leading-none ${text}`}>
            Moh <span className="text-[#8E1538]">Food</span>
          </span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
            OPS
          </span>
        </div>
        {showTagline && (
          <span className={`text-slate-400 font-medium ${sub} mt-0.5 leading-none`}>
            Be nourished • Operations Platform
          </span>
        )}
      </div>
    </div>
  );
};
